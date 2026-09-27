import Image from "next/image";
import type { Media } from "@/lib/catalog";

type ProductGalleryProps = {
  images: Media[];
};

/**
 * Swipeable slides on small screens, a vertical stack of large images from
 * `lg` up (the info column sticks alongside it).
 */
export function ProductGallery({ images }: ProductGalleryProps) {
  const multiple = images.length > 1;

  return (
    <div
      className="scroller-x gap-px lg:stack lg:overflow-visible"
      aria-label="Product images"
      role="region"
    >
      {images.map((image, i) => (
        <div
          key={image.src}
          className={`relative aspect-portrait bg-surface lg:w-full ${multiple ? "w-[88vw] sm:w-[60vw]" : "w-full"}`}
        >
          <Image
            src={image.src}
            alt={image.alt}
            fill
            preload={i === 0}
            sizes="(min-width: 64rem) 60vw, 88vw"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}
