import Image from "next/image";
import Link from "next/link";
import { hero } from "@/lib/catalog";

export function Hero() {
  return (
    <section className="relative h-svh min-h-[36rem] overflow-hidden bg-ink text-on-media">
      <Image
        src={hero.image.src}
        alt={hero.image.alt}
        fill
        preload
        sizes="100vw"
        className="object-cover object-[30%_center] md:object-center"
      />
      {/* Keep the header and caption legible on any photo. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-40 bg-linear-to-b from-black/40 to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/55 to-transparent"
      />

      <div className="container-page absolute inset-x-0 bottom-0 stack items-center gap-4 pb-14 text-center md:pb-20">
        <p className="text-body-sm font-medium">{hero.eyebrow}</p>
        <h1 className="type-display">{hero.title}</h1>
        <Link href={hero.cta.href} className="link text-body-sm font-medium">
          {hero.cta.label}
        </Link>
      </div>
    </section>
  );
}
