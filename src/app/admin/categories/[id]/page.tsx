import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CategoryForm } from "@/components/admin/categories/category-form";
import { DeleteCategoryForm } from "@/components/admin/categories/delete-category-form";
import { getAdminCategory } from "@/lib/admin-categories";
import { UUID_PATTERN } from "@/lib/form-data";
import { requireAdmin } from "@/lib/session";

/** The category for a URL id, or null for a malformed or unknown id. */
async function loadCategory(id: string) {
  const normalized = id.toLowerCase();
  if (!UUID_PATTERN.test(normalized)) return null;
  return getAdminCategory(normalized);
}

export async function generateMetadata({
  params,
}: PageProps<"/admin/categories/[id]">): Promise<Metadata> {
  const { id } = await params;
  await requireAdmin(`/admin/categories/${encodeURIComponent(id)}`);
  const category = await loadCategory(id);
  return { title: category ? category.name : "Category" };
}

export default async function EditCategoryPage({
  params,
}: PageProps<"/admin/categories/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/categories/${encodeURIComponent(id)}`);
  const category = await loadCategory(id);
  if (!category) notFound();

  const { productCount } = category;

  return (
    <main className="flex-1 section">
      <div className="container-page">
        <AdminPageHeader
          title={category.name}
          crumbs={[{ href: "/admin/categories", label: "Categories" }]}
          meta={`${productCount} ${productCount === 1 ? "product" : "products"}`}
          actions={
            <Link
              href={`/collections/${category.slug}`}
              className="btn btn-outline btn-sm"
            >
              View collection
            </Link>
          }
        />

        <div className="stack max-w-xl gap-12">
          <CategoryForm
            mode="edit"
            defaults={{
              id: category.id,
              name: category.name,
              slug: category.slug,
              position: category.position,
            }}
          />

          <section className="stack gap-4 hairline-t pt-8">
            <h2 className="type-label">Delete</h2>
            {productCount > 0 ? (
              <p className="text-body-sm text-muted">
                {productCount === 1 ? "1 product uses" : `${productCount} products use`}{" "}
                this category. Move {productCount === 1 ? "it" : "them"} to
                another category before deleting it.
              </p>
            ) : (
              <DeleteCategoryForm id={category.id} />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
