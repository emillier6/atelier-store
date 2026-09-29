import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  intro: string;
  children: ReactNode;
  /** Link to the other auth page, under a hairline. */
  footer: ReactNode;
};

/** Single centred column for the sign-in and sign-up pages. */
export function AuthShell({ title, intro, children, footer }: AuthShellProps) {
  return (
    <main className="flex-1 section">
      <div className="container-page">
        <div className="mx-auto stack max-w-md gap-10">
          <header className="stack gap-4">
            <h1 className="type-display">{title}</h1>
            <p className="text-body text-muted">{intro}</p>
          </header>
          {children}
          <p className="hairline-t pt-6 text-body-sm">{footer}</p>
        </div>
      </div>
    </main>
  );
}

/** `/sign-in` or `/sign-up`, carrying `?next=` across so the redirect survives. */
export function authHref(path: "/sign-in" | "/sign-up", next: string) {
  return next === "/" ? path : `${path}?next=${encodeURIComponent(next)}`;
}
