export type NavCategory = { slug: string; name: string };

/** New In, then every category in house order, as the admin set them. */
export function primaryNav(categories: NavCategory[]) {
  return [
    { label: "New In", href: "/new-arrivals" },
    ...categories.map((c) => ({
      label: c.name,
      href: `/collections/${c.slug}`,
    })),
  ];
}

export const footerNav = [
  {
    title: "Client Services",
    links: [
      { label: "Contact Us", href: "/contact" },
      { label: "Shipping", href: "/services/shipping" },
      { label: "Returns & Exchanges", href: "/services/returns" },
      { label: "Book an Appointment", href: "/services/appointments" },
    ],
  },
  {
    title: "The House",
    links: [
      { label: "About Atelier", href: "/about" },
      { label: "Craftsmanship", href: "/stories/the-atelier" },
      { label: "Sustainability", href: "/sustainability" },
      { label: "Careers", href: "/careers" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Sale", href: "/legal/terms" },
      { label: "Privacy Policy", href: "/legal/privacy" },
      { label: "Cookie Settings", href: "/legal/cookies" },
    ],
  },
];
