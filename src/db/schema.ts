import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// Core Better Auth tables. Application tables (products, orders, ...) go here too.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * The indexes on the three tables below are the ones Better Auth declares on
 * its own core schema (`index: true` in @better-auth/core's `get-tables`).
 * They are not optional niceties: every session read joins back to `user`, and
 * revoking or listing a user's sessions scans by `user_id`.
 */
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    idToken: text("id_token"),
    /** Bcrypt-style hash for email/password sign-ins; null for social accounts. */
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

/* ------------------------------------------------------------------------ *
 * Catalogue
 * ------------------------------------------------------------------------ */

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  position: integer("position").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Money is stored in cents; `formatPrice` in `src/lib/format.ts` expects cents. */
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    sku: text("sku").notNull().unique(),
    colour: text("colour").notNull(),
    priceCents: integer("price_cents").notNull(),
    badge: text("badge"),
    description: text("description").notNull(),
    /** Ordered display-only bullets; never queried, so jsonb rather than a table. */
    details: jsonb("details").$type<string[]>().notNull(),
    /** Size options for the picker; empty for one-size pieces. Not in the tutorial. */
    sizes: jsonb("sizes").$type<string[]>().default([]).notNull(),
    stockQuantity: integer("stock_quantity").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("products_category_id_idx").on(table.categoryId),
    index("products_created_at_idx").on(table.createdAt.desc()),
    check("products_price_cents_check", sql`${table.priceCents} >= 0`),
    check("products_stock_quantity_check", sql`${table.stockQuantity} >= 0`),
  ],
);

/** `position` 0 is the packshot every grid and rail shows. */
export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    /** Alt belongs to the usage: the same frame is reused with different copy. */
    alt: text("alt").notNull(),
    position: integer("position").default(0).notNull(),
  },
  (table) => [
    index("product_images_product_id_idx").on(table.productId),
    unique("product_images_product_id_position_key").on(
      table.productId,
      table.position,
    ),
  ],
);

/* ------------------------------------------------------------------------ *
 * Bag
 * ------------------------------------------------------------------------ */

/** One bag per customer; the unique userId stops a race making a second. */
export const carts = pgTable("carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * No price column: amounts are read live from products.price_cents when the
 * bag renders and again at checkout, so a stale bag can't carry a stale price.
 */
export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** One of products.sizes; null for one-size pieces. Not in the tutorial. */
    size: text("size"),
    quantity: integer("quantity").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("cart_items_cart_id_idx").on(table.cartId),
    /* Adding the same piece in the same size bumps the quantity instead of
       adding a line. NULLS NOT DISTINCT makes that hold for size = null too. */
    unique("cart_items_cart_id_product_id_size_key")
      .on(table.cartId, table.productId, table.size)
      .nullsNotDistinct(),
    check("cart_items_quantity_check", sql`${table.quantity} > 0`),
  ],
);

/* ------------------------------------------------------------------------ *
 * Orders
 * ------------------------------------------------------------------------ */

/** One row per paid Stripe Checkout Session, written by the webhook. */
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /* restrict, not cascade: an order is a record of money taken, so a
       customer with orders can't be deleted by accident. */
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    /**
     * Stripe retries webhooks and can send two success events for one
     * session; this unique turns every repeat into a no-op.
     */
    stripeCheckoutSessionId: text("stripe_checkout_session_id")
      .notNull()
      .unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    /** The address Stripe charged, which may differ from user.email. */
    email: text("email").notNull(),
    /** What Stripe charged; never recomputed from the lines. */
    totalCents: integer("total_cents").notNull(),
    currency: text("currency").default("usd").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("orders_user_id_idx").on(table.userId),
    index("orders_created_at_idx").on(table.createdAt.desc()),
  ],
);

/**
 * A snapshot of each line at purchase time. Products get re-priced, renamed
 * and deleted; the receipt must still show what was bought and paid.
 */
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /* set null: deleting a product must not erase the line it was sold on. */
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    productSlug: text("product_slug").notNull(),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    colour: text("colour").notNull(),
    /** The size bought; null for one-size pieces. Not in the tutorial. */
    size: text("size"),
    imageUrl: text("image_url"),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    /* What Stripe charged for the line, not unit × quantity. */
    lineTotalCents: integer("line_total_cents").notNull(),
  },
  (table) => [index("order_items_order_id_idx").on(table.orderId)],
);

/* ------------------------------------------------------------------------ *
 * Relations
 * ------------------------------------------------------------------------ */

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  images: many(productImages),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const cartsRelations = relations(carts, ({ many }) => ({
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));
