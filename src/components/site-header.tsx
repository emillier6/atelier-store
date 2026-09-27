"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  BagIcon,
  CloseIcon,
  MenuIcon,
  SearchIcon,
  UserIcon,
} from "@/components/icons";
import { primaryNav } from "@/components/site-nav";

// Routes whose first section is a full-bleed image the header floats over.
const OVERLAY_ROUTES = new Set(["/"]);

function subscribeToScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const scrolled = useSyncExternalStore(
    subscribeToScroll,
    () => window.scrollY > 24,
    () => false,
  );

  const hasOverlay = OVERLAY_ROUTES.has(pathname);
  const transparent = hasOverlay && !scrolled && !menuOpen;

  return (
    <>
      <header
        data-transparent={transparent}
        className="fixed inset-x-0 top-0 z-40 h-header border-b transition-colors duration-500 ease-luxe data-[transparent=false]:border-line data-[transparent=false]:bg-paper data-[transparent=false]:text-ink data-[transparent=true]:border-transparent data-[transparent=true]:text-on-media"
      >
        <div className="container-page grid h-full grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex items-center">
            <button
              type="button"
              className="btn-icon -ml-2.5 lg:ml-0 lg:w-auto lg:gap-2 lg:rounded-none lg:px-0 lg:hover:bg-transparent"
              aria-expanded={menuOpen}
              aria-controls="site-menu"
              onClick={() => setMenuOpen(true)}
            >
              <MenuIcon />
              <span className="sr-only lg:not-sr-only lg:text-body-sm lg:font-medium lg:uppercase">
                Menu
              </span>
            </button>
          </div>

          <Link
            href="/"
            className="font-display text-2xl tracking-[0.3em] uppercase md:text-[1.75rem]"
            aria-label="Atelier, home"
          >
            Atelier
          </Link>

          <nav aria-label="Account" className="-mr-2.5 flex justify-end">
            <Link href="/search" className="btn-icon" aria-label="Search">
              <SearchIcon />
            </Link>
            <Link
              href="/account"
              className="btn-icon max-sm:hidden"
              aria-label="Account"
            >
              <UserIcon />
            </Link>
            <Link href="/cart" className="btn-icon" aria-label="Shopping bag">
              <BagIcon />
            </Link>
          </nav>
        </div>
      </header>

      {/* Pages without a hero start below the fixed header. */}
      {!hasOverlay && <div aria-hidden className="h-header shrink-0" />}

      {menuOpen && <SiteMenu onClose={closeMenu} />}
    </>
  );
}

function SiteMenu({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden
        className="absolute inset-0 animate-fade-in bg-scrim"
        onClick={onClose}
      />
      <div
        id="site-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="stack absolute inset-y-0 left-0 w-full animate-fade-in bg-paper sm:max-w-md"
      >
        <div className="flex h-header shrink-0 items-center px-gutter">
          <button
            ref={closeRef}
            type="button"
            className="btn-icon -ml-2.5"
            aria-label="Close menu"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        <nav
          aria-label="Primary"
          className="stack flex-1 gap-5 overflow-y-auto px-gutter py-8"
        >
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="type-title w-fit transition-opacity duration-300 ease-luxe hover:opacity-60"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="stack hairline-t gap-3 px-gutter py-8 text-body-sm">
          <Link href="/account" onClick={onClose} className="link w-fit">
            Sign in
          </Link>
          <Link href="/contact" onClick={onClose} className="link w-fit">
            Contact us
          </Link>
        </div>
      </div>
    </div>
  );
}
