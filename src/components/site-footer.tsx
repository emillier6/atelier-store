import Link from "next/link";
import { footerNav } from "@/components/site-nav";

export function SiteFooter() {
  return (
    <footer className="theme-inverse">
      <div className="container-page section stack gap-12 md:gap-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="stack gap-3 lg:pr-12">
            <h2 className="type-label">Newsletter</h2>
            <p className="text-body-sm text-muted">
              Be the first to hear about new collections, private events and the
              stories behind the pieces.
            </p>
            <Link href="/newsletter" className="link w-fit text-body-sm">
              Sign up
            </Link>
          </div>

          {footerNav.map((group) => (
            <nav
              key={group.title}
              aria-label={group.title}
              className="stack gap-3"
            >
              <h2 className="type-label">{group.title}</h2>
              <ul className="stack gap-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="link-nav text-body-sm">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="stack hairline-t gap-6 pt-10 md:pt-12">
          <p
            aria-hidden
            className="font-display text-[clamp(2.5rem,13vw,11rem)] leading-none tracking-[0.15em] uppercase"
          >
            Atelier
          </p>
          <p className="type-meta">
            © {new Date().getFullYear()} Atelier. Sample storefront.
          </p>
        </div>
      </div>
    </footer>
  );
}
