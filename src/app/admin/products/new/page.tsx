import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProductForm } from "@/components/admin/products/product-form";
import { getAdminCategoryOptions } from "@/lib/admin-products";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireAdmin("/admin/products/new");
  const categoryOptions = await getAdminCategoryOptions();

  return (
    <main className="flex-1 section">
      <div className="container-page">
        <div className="max-w-3xl">
          <AdminPageHeader
            title="New product"
            crumbs={[{ href: "/admin/products", label: "Products" }]}
            meta="New products start as drafts, hidden from customers."
          />
          {categoryOptions.length === 0 ? (
            <p className="text-body">
              Add a category first:{" "}
              <Link href="/admin/categories" className="link">
                Categories
              </Link>
              .
            </p>
          ) : (
            <ProductForm
              mode="create"
              categories={categoryOptions}
              initial={{
                name: "",
                slug: "",
                sku: "",
                categoryId: "",
                colour: "",
                price: "",
                badge: "",
                description: "",
                details: "",
                sizes: "",
                status: "draft",
                images: [{ url: "", alt: "" }],
              }}
            />
          )}
        </div>
      </div>
    </main>
  );
}
