import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";

type OrderLine = {
  id: string;
  productSlug: string;
  name: string;
  colour: string;
  size: string | null;
  imageUrl: string | null;
  quantity: number;
  lineTotalCents: number;
};

/** The lines of a placed order, as they were bought. */
export function OrderLines({ lines }: { lines: OrderLine[] }) {
  return (
    <ul className="hairline-t">
      {lines.map((line) => {
        const image = (
          <div className="relative aspect-product w-16 shrink-0 bg-surface sm:w-20">
            {line.imageUrl && (
              <Image
                src={line.imageUrl}
                alt=""
                fill
                sizes="5rem"
                className="object-cover"
              />
            )}
          </div>
        );
        return (
          <li key={line.id} className="flex gap-4 py-4 hairline-b">
            {/* The product may have been removed since; keep the line. */}
            {line.productSlug ? (
              <Link href={`/products/${line.productSlug}`}>{image}</Link>
            ) : (
              image
            )}
            <div className="stack flex-1 gap-1">
              <p className="text-body-sm font-medium">{line.name}</p>
              <p className="type-meta">{line.colour}</p>
              {line.size && <p className="type-meta">Size {line.size}</p>}
              <p className="type-meta">Quantity {line.quantity}</p>
            </div>
            <p className="type-price">{formatPrice(line.lineTotalCents)}</p>
          </li>
        );
      })}
    </ul>
  );
}

/** Short, readable order number from the order's uuid. */
export function orderNumber(id: string) {
  return id.slice(0, 8).toUpperCase();
}
