import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  products,
  stockAdjustments,
  type StockAdjustmentReason,
} from "@/db/schema";
import {
  type AdminStockReason,
  MAX_STOCK,
} from "@/lib/admin-stock-form-state";
import { requireAdmin } from "@/lib/session";

/*
 * Admin stock tools: the panel's read and the two writes. Each write is one
 * SQL statement whose CTE updates products.stock_quantity and inserts the
 * matching stock_adjustments row, so the count and its history can't
 * disagree, and the update's WHERE re-checks the row after any concurrent
 * write has committed (Postgres re-evaluates it under the row lock). No
 * interactive transaction needed, and the count is never clamped.
 */

const HISTORY_LIMIT = 20;

export type StockHistoryRow = {
  id: string;
  createdAt: Date;
  reason: StockAdjustmentReason;
  delta: number;
  stockAfter: number;
  orderId: string | null;
  admin: { name: string; email: string } | null;
};

const adminPath = (productId: string) => `/admin/products/${productId}`;

/** Current stock and the latest history rows, or null for an unknown id. */
export async function getStockPanel(productId: string) {
  await requireAdmin(adminPath(productId));

  const product = await db.query.products.findFirst({
    columns: { id: true, stockQuantity: true },
    where: eq(products.id, productId),
  });
  if (!product) return null;

  const rows = await db.query.stockAdjustments.findMany({
    columns: {
      id: true,
      createdAt: true,
      reason: true,
      delta: true,
      stockAfter: true,
      orderId: true,
    },
    where: eq(stockAdjustments.productId, productId),
    orderBy: [desc(stockAdjustments.createdAt), desc(stockAdjustments.id)],
    limit: HISTORY_LIMIT,
    with: { user: { columns: { name: true, email: true } } },
  });

  const history: StockHistoryRow[] = rows.map(({ user, ...row }) => ({
    ...row,
    admin: user ?? null,
  }));

  return { stock: product.stockQuantity, history };
}

export type StockWriteResult =
  | { ok: true; stock: number; productSlug: string; categorySlug: string }
  /** Nothing written; `current` is null when the product doesn't exist. */
  | { ok: false; current: number | null };

type WrittenRow = {
  stock_after: number;
  product_slug: string;
  category_slug: string;
};

async function currentStock(productId: string) {
  const row = await db.query.products.findFirst({
    columns: { stockQuantity: true },
    where: eq(products.id, productId),
  });
  return row?.stockQuantity ?? null;
}

async function finish(
  productId: string,
  rows: Record<string, unknown>[],
): Promise<StockWriteResult> {
  const [row] = rows as WrittenRow[];
  if (row) {
    return {
      ok: true,
      stock: Number(row.stock_after),
      productSlug: row.product_slug,
      categorySlug: row.category_slug,
    };
  }
  return { ok: false, current: await currentStock(productId) };
}

/**
 * Sets stock to `quantity` only if it is still `expected` (what the admin
 * saw), so a sale or another admin's change in between isn't overwritten.
 * Fails when the count moved or when quantity equals expected.
 */
export async function setStock(input: {
  productId: string;
  expected: number;
  quantity: number;
  reason: AdminStockReason;
}): Promise<StockWriteResult> {
  const admin = await requireAdmin(adminPath(input.productId));
  const result = await db.execute(sql`
    with upd as (
      update products
      set stock_quantity = ${input.quantity}::int, updated_at = now()
      where id = ${input.productId}::uuid
        and stock_quantity = ${input.expected}::int
        and ${input.quantity}::int <> ${input.expected}::int
      returning id, slug, category_id, stock_quantity
    ),
    ins as (
      insert into stock_adjustments
        (product_id, delta, stock_after, reason, user_id)
      select upd.id, ${input.quantity}::int - ${input.expected}::int,
        upd.stock_quantity, ${input.reason}::text, ${admin.id}::text
      from upd
      returning stock_after
    )
    select ins.stock_after, upd.slug as product_slug, c.slug as category_slug
    from ins, upd join categories c on c.id = upd.category_id
  `);
  return finish(input.productId, result.rows);
}

/**
 * Adds `delta` (negative removes). Fails instead of clamping when the
 * result would go below zero.
 */
export async function adjustStock(input: {
  productId: string;
  delta: number;
  reason: AdminStockReason;
}): Promise<StockWriteResult> {
  const admin = await requireAdmin(adminPath(input.productId));
  const result = await db.execute(sql`
    with upd as (
      update products
      set stock_quantity = stock_quantity + ${input.delta}::int,
        updated_at = now()
      where id = ${input.productId}::uuid
        and ${input.delta}::int <> 0
        and stock_quantity + ${input.delta}::int between 0 and ${MAX_STOCK}::int
      returning id, slug, category_id, stock_quantity
    ),
    ins as (
      insert into stock_adjustments
        (product_id, delta, stock_after, reason, user_id)
      select upd.id, ${input.delta}::int, upd.stock_quantity,
        ${input.reason}::text, ${admin.id}::text
      from upd
      returning stock_after
    )
    select ins.stock_after, upd.slug as product_slug, c.slug as category_slug
    from ins, upd join categories c on c.id = upd.category_id
  `);
  return finish(input.productId, result.rows);
}
