import Link from "next/link";

type PaginationProps = {
  /** Link to the previous page, or null on the first page. */
  previousHref: string | null;
  /** Link to the next page, or null on the last page. */
  nextHref: string | null;
};

/**
 * Previous / Next links for cursor-paginated lists. The query module works
 * out the cursors (e.g. the last row's created_at and id), so lists stay
 * fast on the created_at index however deep you page.
 */
export function Pagination({ previousHref, nextHref }: PaginationProps) {
  if (!previousHref && !nextHref) return null;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4 pt-6"
    >
      {previousHref ? (
        <Link href={previousHref} className="btn btn-outline btn-sm">
          Previous
        </Link>
      ) : (
        <span />
      )}
      {nextHref && (
        <Link href={nextHref} className="btn btn-outline btn-sm">
          Next
        </Link>
      )}
    </nav>
  );
}
