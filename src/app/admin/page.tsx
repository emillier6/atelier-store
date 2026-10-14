import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: { absolute: "Admin | Atelier Store" } };

export default async function AdminPage() {
  const admin = await requireAdmin("/admin");

  return (
    <main className="flex-1 section">
      <div className="container-page">
        <div className="mx-auto stack max-w-xl gap-6">
          <h1 className="type-display">Admin</h1>
          <p className="type-meta">Signed in as {admin.email}</p>
          <p className="text-body">
            Products, categories and orders will be managed from here.
          </p>
        </div>
      </div>
    </main>
  );
}
