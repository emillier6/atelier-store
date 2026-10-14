import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin | Atelier Store" },
  robots: { index: false, follow: false },
};

/*
 * This check keeps the menu from rendering for anyone else, but it is not the
 * protection: layouts don't re-run on every navigation and don't cover Server
 * Actions, so each admin page and action calls requireAdmin itself.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin("/admin");

  return (
    <div className="flex flex-1 flex-col">
      <AdminNav />
      {children}
    </div>
  );
}
