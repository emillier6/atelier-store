import type { Metadata } from "next";
import Link from "next/link";
import { OrderLines, orderNumber } from "@/components/orders/order-lines";
import { signOut } from "@/lib/auth-actions";
import { formatPrice } from "@/lib/format";
import { getOrdersForUser } from "@/lib/orders";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Account" };

const orderDate = new Intl.DateTimeFormat("en-US", { dateStyle: "long" });

export default async function AccountPage() {
  const user = await requireUser("/account");
  const orders = await getOrdersForUser(user.id);

  return (
    <main className="flex-1 section">
      <div className="container-page">
        <div className="mx-auto stack max-w-xl gap-12">
          <header className="stack gap-6">
            <h1 className="type-display">Account</h1>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="stack gap-1">
                <p className="text-body">{user.name}</p>
                <p className="type-meta">{user.email}</p>
              </div>
              <div className="cluster gap-3">
                {user.role === "admin" && (
                  <Link href="/admin" className="btn btn-outline btn-sm">
                    Admin
                  </Link>
                )}
                <form action={signOut}>
                  <button type="submit" className="btn btn-outline btn-sm">
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </header>

          <section aria-labelledby="orders" className="stack gap-6">
            <h2 id="orders" className="type-label">
              Orders
            </h2>

            {orders.length === 0 ? (
              <div className="stack items-start gap-6 hairline-t pt-6">
                <p className="text-body">You haven&apos;t placed an order yet.</p>
                <Link href="/new-arrivals" className="btn btn-outline">
                  See what has just arrived
                </Link>
              </div>
            ) : (
              <ol className="stack gap-10">
                {orders.map((order) => (
                  <li key={order.id} className="stack gap-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                      <h3 className="text-body-sm font-semibold">
                        Order {orderNumber(order.id)}
                      </h3>
                      <p className="type-price">
                        {formatPrice(order.totalCents)}
                      </p>
                    </div>
                    <p className="type-meta">
                      Placed on{" "}
                      <time dateTime={order.createdAt.toISOString()}>
                        {orderDate.format(order.createdAt)}
                      </time>
                    </p>
                    <OrderLines lines={order.items} />
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
