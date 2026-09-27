import type { ReactNode } from "react";
import { PlusIcon } from "@/components/icons";

type Item = { title: string; content: ReactNode };

/** Hairline-separated disclosure list built on native <details>. */
export function ProductAccordion({ items }: { items: Item[] }) {
  return (
    <div className="hairline-t">
      {items.map((item) => (
        <details key={item.title} className="group hairline-b">
          <summary className="flex cursor-pointer list-none items-center justify-between py-5 text-body-sm font-medium uppercase [&::-webkit-details-marker]:hidden">
            {item.title}
            <PlusIcon className="size-4 transition-transform duration-300 ease-luxe group-open:rotate-45" />
          </summary>
          <div className="pb-6 text-body-sm text-muted">{item.content}</div>
        </details>
      ))}
    </div>
  );
}
