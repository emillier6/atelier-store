"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* Products, Categories and Orders join this list as their pages land. */
const adminLinks = [{ href: "/admin", label: "Overview" }];

/** The admin section's menu; the current page reads bold and uppercase. */
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
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
