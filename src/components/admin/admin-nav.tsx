"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const adminLinks = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/orders", label: "Orders" },
];

/** Overview matches exactly; a section also matches its sub-pages. */
function isCurrent(pathname: string, href: string) {
  return href === "/admin"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

/** The admin section's menu; the current section reads bold and uppercase. */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="hairline-b">
      <ul className="container-page cluster scroller-x gap-6 py-4 text-body-sm">
        {adminLinks.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="link-nav"
              aria-current={isCurrent(pathname, link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
