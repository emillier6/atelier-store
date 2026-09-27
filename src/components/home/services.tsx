import Link from "next/link";
import { services } from "@/lib/catalog";

export function Services() {
  return (
    <section className="container-page section">
      <h2 className="sr-only">Services</h2>
      <ul className="grid gap-10 md:grid-cols-3 md:gap-8">
        {services.map((service) => (
          <li
            key={service.title}
            className="stack items-center gap-3 text-center"
          >
            <h3 className="type-label">{service.title}</h3>
            <p className="max-w-xs text-body-sm text-muted">{service.body}</p>
            <Link href={service.cta.href} className="link text-body-sm">
              {service.cta.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
