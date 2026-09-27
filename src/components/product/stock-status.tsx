import type { StockState } from "@/lib/catalog";

const labels: Record<StockState, (stock: number) => string> = {
  in_stock: () => "In stock",
  low_stock: (stock) => `Only ${stock} left`,
  out_of_stock: () => "Sold out",
};

const dot: Record<StockState, string> = {
  in_stock: "bg-success",
  low_stock: "bg-danger",
  out_of_stock: "bg-muted",
};

export function StockStatus({
  state,
  stock,
}: {
  state: StockState;
  stock: number;
}) {
  return (
    <p className="flex items-center gap-2 text-body-sm">
      <span aria-hidden className={`size-1.5 rounded-pill ${dot[state]}`} />
      {labels[state](stock)}
    </p>
  );
}
