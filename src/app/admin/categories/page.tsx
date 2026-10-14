import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { listAdminCategories } from "@/lib/admin-categories";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  await requireAdmin("/admin/categories");
  const rows = await listAdminCategories();

  return (
    <main className="flex-1 section">
      <div className="container-page">
        <AdminPageHeader
          title="Categories"
          meta={`${rows.length} ${rows.length === 1 ? "category" : "categories"}`}
          actions={
            <Link href="/admin/categories/new" className="btn btn-primary btn-sm">
              New category
            </Link>
          }
        />

        {rows.length === 0 ? (
          <p className="text-body text-muted">No categories yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Slug</th>
                  <th scope="col" className="num">
                    Position
                  </th>
                  <th scope="col" className="num">
                    Products
                  </th>
                  <th scope="col" className="num">
                    Active
                  </th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-medium">
                      <Link
                        href={`/admin/categories/${row.id}`}
                        className="link-nav"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="text-muted">{row.slug}</td>
                    <td className="num">{row.position}</td>
                    <td className="num">{row.productCount}</td>
                    <td className="num">{row.activeCount}</td>
                    <td className="text-end whitespace-nowrap">
                      <Link
                        href={`/admin/categories/${row.id}`}
                        className="link"
                        aria-label={`Edit ${row.name}`}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
