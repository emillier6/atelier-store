/**
 * Marks copy that was written as a stand-in and must be replaced before
 * launch. Visible on purpose: placeholder text must not pass for real
 * policy or company information.
 */
export function PlaceholderNote({ children }: { children?: React.ReactNode }) {
  return (
    <p className="hairline px-4 py-3 type-meta">
      <span className="font-semibold text-ink">Placeholder copy.</span>{" "}
      {children ?? "This text is a stand-in and will be replaced before launch."}
    </p>
  );
}
