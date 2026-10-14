const orderDate = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/** e.g. "Oct 14, 2026, 5:44 PM UTC". UTC so server and admin agree. */
export function formatOrderDate(date: Date) {
  return `${orderDate.format(date)} UTC`;
}
