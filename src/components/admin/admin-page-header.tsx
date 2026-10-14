import Link from "next/link";
import type { ReactNode } from "react";

type Crumb = { href: string; label: string };

type AdminPageHeaderProps = {
  title: string;
  /** Pages above this one, after "Admin", e.g. [{ href: "/admin/products", label: "Products" }]. */
  crumbs?: Crumb[];
  meta?: string;
  /** Buttons on the right, e.g. a "New product" link. */
  actions?: ReactNode;
};

/** Breadcrumb (Admin / … / title), title, meta line and page actions. */
export function AdminPageHeader({
  title,
  crumbs = [],
  meta,
  actions,
}: AdminPageHeaderProps) {
  const trail = [{ href: "/admin", label: "Admin" }, ...crumbs];

  return (
    <div className="stack gap-6 pb-6 md:pb-8">
      <nav aria-label="Breadcrumb">
        <ol className="cluster gap-2 text-body-sm text-muted">
          {trail.map((crumb) => (
            <li key={crumb.href} className="cluster gap-2">
              <Link href={crumb.href} className="link-nav">
                {crumb.label}
              </Link>
              <span aria-hidden>/</span>
            </li>
          ))}
          <li aria-current="page">{title}</li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="stack gap-1">
          <h1 className="type-title">{title}</h1>
          {meta && <p className="type-meta">{meta}</p>}
        </div>
        {actions && <div className="cluster gap-3">{actions}</div>}
      </div>
    </div>
  );
}
