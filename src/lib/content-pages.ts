import { countryName, SHIPPING_COUNTRIES } from "@/lib/shipping-address";

/*
 * Copy for the information pages linked from the footer and the home
 * services. Sections marked `placeholder` are stand-ins to replace before
 * launch and render with a visible "Placeholder" tag; everything else
 * describes what the store actually does today. Legal pages are placeholders
 * on purpose: their wording must come from someone qualified to write it.
 */

export type ContentSection = {
  heading: string;
  body: string[];
  /** Stand-in copy, shown with a "Placeholder" tag. */
  placeholder?: boolean;
};

export type ContentPage = {
  /** Footer group, shown above the title. */
  group: string;
  title: string;
  intro: string;
  sections: ContentSection[];
  cta?: { label: string; href: string };
};

const euCountries = SHIPPING_COUNTRIES.filter(
  (code) => !["US", "CA", "GB"].includes(code),
)
  .map(countryName)
  .sort((a, b) => a.localeCompare(b));

export const contentPages = {
  contact: {
    group: "Client Services",
    title: "Contact Us",
    intro: "Questions about an order, a piece or a service: we're here to help.",
    sections: [
      {
        heading: "About an order",
        body: [
          "Have your order number ready: it's the eight-character code shown on your confirmation page and next to each order in your account.",
        ],
      },
      {
        heading: "Email and phone",
        body: [
          "Placeholder: client services email address, phone number and opening hours.",
        ],
        placeholder: true,
      },
    ],
    cta: { label: "Go to your account", href: "/account" },
  },
  about: {
    group: "The House",
    title: "About Atelier",
    intro: "Placeholder: one sentence on what Atelier is and what it makes.",
    sections: [
      {
        heading: "The house",
        body: [
          "Placeholder: when and where the house began, and the people behind it.",
          "Placeholder: what sets the pieces apart: cut, materials and finishing.",
        ],
        placeholder: true,
      },
    ],
    cta: { label: "Read about the craft", href: "/stories/the-atelier" },
  },
  sustainability: {
    group: "The House",
    title: "Sustainability",
    intro: "Placeholder: the house's approach to materials, making and longevity.",
    sections: [
      {
        heading: "Materials",
        body: [
          "Placeholder: sourcing standards and certifications. Only state what can be verified.",
        ],
        placeholder: true,
      },
      {
        heading: "Care and repair",
        body: ["Placeholder: how to care for pieces and how repairs work."],
        placeholder: true,
      },
    ],
  },
  careers: {
    group: "The House",
    title: "Careers",
    intro: "Placeholder: a short note on working at Atelier.",
    sections: [
      {
        heading: "Open roles",
        body: [
          "Placeholder: current openings, or how to send a speculative application.",
        ],
        placeholder: true,
      },
    ],
  },
  newsletter: {
    group: "Newsletter",
    title: "Newsletter",
    intro:
      "The newsletter isn't open for sign-ups yet. In the meantime, new pieces appear first in New Arrivals.",
    sections: [],
    cta: { label: "See new arrivals", href: "/new-arrivals" },
  },
} satisfies Record<string, ContentPage>;

export const servicePages = {
  shipping: {
    group: "Client Services",
    title: "Shipping",
    intro: "Shipping is complimentary on every order.",
    sections: [
      {
        heading: "Where we ship",
        body: [
          "The United States, Canada, the United Kingdom and every country in the European Union.",
          `EU countries: ${euCountries.join(", ")}.`,
          "Enter your delivery address at checkout; only these countries can be selected.",
        ],
      },
      {
        heading: "Delivery time and cost",
        body: [
          "Complimentary shipping, with an estimated delivery of 3 to 7 business days.",
          "Prices are in US dollars.",
        ],
      },
      {
        heading: "Tracking your order",
        body: [
          "Once your order is on its way, its status changes to Shipped in your account, with the carrier and tracking number when we have them.",
        ],
      },
      {
        heading: "Duties and taxes",
        body: [
          "Placeholder: who pays import duties and taxes for deliveries outside the US.",
        ],
        placeholder: true,
      },
    ],
    cta: { label: "Track an order", href: "/account" },
  },
  returns: {
    group: "Client Services",
    title: "Returns & Exchanges",
    intro: "How returns and refunds work.",
    sections: [
      {
        heading: "Refunds",
        body: [
          "Refunds go back to the payment method you used at checkout. Once one is issued, your account shows it next to the order.",
        ],
      },
      {
        heading: "Returning a piece",
        body: [
          "Placeholder: the return window, the condition pieces must be in, and how to send them back.",
        ],
        placeholder: true,
      },
      {
        heading: "Exchanges",
        body: ["Placeholder: whether exchanges are offered and how they work."],
        placeholder: true,
      },
    ],
    cta: { label: "Contact us about a return", href: "/contact" },
  },
  appointments: {
    group: "Client Services",
    title: "Book an Appointment",
    intro: "Placeholder: in-store and virtual appointments with a client advisor.",
    sections: [
      {
        heading: "How to book",
        body: [
          "Placeholder: how to request an appointment and what to expect. Online booking isn't available on this site yet.",
        ],
        placeholder: true,
      },
    ],
    cta: { label: "Contact us", href: "/contact" },
  },
  personalization: {
    group: "Client Services",
    title: "Personalization",
    intro: "Placeholder: initials on selected leather goods.",
    sections: [
      {
        heading: "How it works",
        body: [
          "Placeholder: which pieces can be personalised, the options, lead time and cost. Personalisation can't be ordered on this site yet.",
        ],
        placeholder: true,
      },
    ],
    cta: { label: "Contact us", href: "/contact" },
  },
} satisfies Record<string, ContentPage>;

export const legalPages = {
  terms: {
    group: "Legal",
    title: "Terms of Sale",
    intro:
      "Placeholder: the terms of sale have not been written yet. They must be drafted or reviewed by someone qualified before the store takes real orders.",
    sections: [
      {
        heading: "To cover",
        body: [
          "Placeholder: who the seller is, pricing and currency (US dollars), payment (taken by Stripe at checkout), delivery, returns and refunds, liability and governing law.",
        ],
        placeholder: true,
      },
    ],
  },
  privacy: {
    group: "Legal",
    title: "Privacy Policy",
    intro:
      "Placeholder: the privacy policy has not been written yet. It must be drafted or reviewed by someone qualified before launch.",
    sections: [
      {
        heading: "What the store stores today",
        body: [
          "For drafting, not a policy: an account's name, email address and a hashed password; sign-in sessions with IP address and browser; each order's lines, amounts, charged email and shipping address; and rate-limit counters keyed by IP address.",
          "Card details are entered on Stripe's checkout page and never reach this site.",
        ],
        placeholder: true,
      },
    ],
  },
  cookies: {
    group: "Legal",
    title: "Cookie Settings",
    intro:
      "This site uses only the cookies it needs to work, so there is nothing to switch on or off.",
    sections: [
      {
        heading: "Cookies we set",
        body: [
          "A session cookie keeps you signed in. It is set when you sign in or create an account and removed when you sign out. There are no analytics or advertising cookies.",
        ],
      },
      {
        heading: "Checkout",
        body: [
          "Payment happens on Stripe's checkout page, which sets its own cookies under Stripe's policies.",
        ],
      },
      {
        heading: "Legal wording",
        body: [
          "Placeholder: have this page's wording reviewed before launch.",
        ],
        placeholder: true,
      },
    ],
  },
} satisfies Record<string, ContentPage>;
