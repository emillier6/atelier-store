import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CategoryForm } from "@/components/admin/categories/category-form";
import { nextCategoryPosition } from "@/lib/admin-categories";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "New category" };

export default async function NewCategoryPage() {
  await requireAdmin("/admin/categories/new");
  const position = await nextCategoryPosition();

  return (
    <main className="flex-1 section">
      <div className="container-page">
        <AdminPageHeader
          title="New category"
          crumbs={[{ href: "/admin/categories", label: "Categories" }]}
        />
        <div className="max-w-xl">
          <CategoryForm mode="create" defaults={{ position }} />
        </div>
      </div>
    </main>
  );
}
