// Storefront types and static editorial content. Product data lives in the
// database; see `@/lib/products`.
import { unsplash } from "./images";

export type Media = { src: string; alt: string };

export type Product = {
  slug: string;
  name: string;
  category: { slug: string; name: string };
  price: number; // cents
  image: Media;
  /** Additional gallery images shown after `image` on the product page. */
  gallery?: Media[];
  badge?: string;
  sku: string;
  color: string;
  description: string;
  details: string[];
  sizes?: string[];
  stock: number; // units available
};

export type Collection = {
  slug: string;
  title: string;
  eyebrow?: string;
  description?: string;
  image: Media;
};

export const hero = {
  eyebrow: "Spring–Summer 2027",
  title: "Riviera",
  cta: { label: "Discover the collection", href: "/edits/riviera" },
  image: {
    src: unsplash("1496747611176-843222e1e57c"),
    alt: "Woman in a floral wrap dress walking along a sunlit seafront",
  },
};

export const newArrivalsFeature: Collection = {
  slug: "new-in",
  eyebrow: "New in",
  title: "Colour Theory",
  image: {
    src: unsplash("1509631179647-0177331693ae"),
    alt: "Model in striped trousers posing against a turquoise wall",
  },
};

export type StockState = "in_stock" | "low_stock" | "out_of_stock";

const LOW_STOCK_THRESHOLD = 3;

export function getStockState(product: Product): StockState {
  if (product.stock <= 0) return "out_of_stock";
  if (product.stock <= LOW_STOCK_THRESHOLD) return "low_stock";
  return "in_stock";
}

export const editorialPair: Collection[] = [
  {
    slug: "city-tailoring",
    eyebrow: "Women",
    title: "City Tailoring",
    image: {
      src: unsplash("1539109136881-3be0616acf4b"),
      alt: "Woman in a powder-blue coat in front of a gothic cathedral",
    },
  },
  {
    slug: "after-dark",
    eyebrow: "Men",
    title: "After Dark",
    image: {
      src: unsplash("1520975954732-35dd22299614"),
      alt: "Man in a black leather jacket crouching against a brick wall",
    },
  },
];

export const craftStory: Collection = {
  slug: "the-atelier",
  eyebrow: "Craftsmanship",
  title: "Made to Last",
  description:
    "Natural fibres, hand-finished seams and garments cut to be worn for decades. Discover how each piece is made.",
  image: {
    src: unsplash("1558769132-cb1aea458c5e"),
    alt: "Neutral-toned knitwear hanging on a rail beside dried pampas grass",
  },
};

export const services = [
  {
    title: "Complimentary Shipping",
    body: "Free delivery to the US, Canada, the UK and the EU.",
    cta: { label: "Learn more", href: "/services/shipping" },
  },
  {
    title: "Personalization",
    body: "Add your initials to selected leather goods.",
    cta: { label: "Discover", href: "/services/personalization" },
  },
  {
    title: "Book an Appointment",
    body: "Shop in store or virtually with a client advisor.",
    cta: { label: "Book now", href: "/services/appointments" },
  },
];

/**
 * Editorial edits at /edits/[slug]: a lookbook intro over a selection of
 * active pieces from the listed categories. The copy is placeholder text to
 * replace; the pieces are live catalogue data.
 */
export type Edit = Collection & {
  eyebrow: string;
  intro: string[];
  /** Categories the edit draws its pieces from, newest first. */
  categorySlugs: string[];
};

export const edits: Edit[] = [
  {
    slug: "riviera",
    eyebrow: hero.eyebrow,
    title: hero.title,
    image: hero.image,
    intro: [
      "Placeholder: a few lines on the season's mood, the coastline that inspired it and the fabrics that carry it.",
      "Placeholder: a second paragraph on how to wear the pieces below, from the first warm morning to the last long evening.",
    ],
    categorySlugs: ["ready-to-wear", "eyewear", "shoes"],
  },
  ...editorialPair.map((story) => ({
    ...story,
    eyebrow: story.eyebrow ?? "The Edit",
    intro: [
      `Placeholder: an introduction to ${story.title}, what defines the edit and who it is for.`,
      "Placeholder: a note on fit, fabric and the details worth looking for in the pieces below.",
    ],
    categorySlugs:
      story.slug === "city-tailoring"
        ? ["ready-to-wear", "shoes", "handbags"]
        : ["ready-to-wear", "jewelry", "eyewear"],
  })),
];

/**
 * Long-form stories at /stories/[slug]. Copy is placeholder text to replace.
 */
export type Story = Collection & {
  eyebrow: string;
  description: string;
  sections: { heading: string; body: string[]; image?: Media }[];
};

export const stories: Story[] = [
  {
    ...craftStory,
    eyebrow: craftStory.eyebrow ?? "Craftsmanship",
    description: craftStory.description ?? "",
    sections: [
      {
        heading: "The materials",
        body: [
          "Placeholder: where the fibres and leathers come from, and why they were chosen.",
          "Placeholder: how materials are tested for weight, hand and wear before a piece goes into production.",
        ],
        image: newArrivalsFeature.image,
      },
      {
        heading: "The making",
        body: [
          "Placeholder: the steps from pattern to finished garment, and the hand-finishing that takes the longest.",
          "Placeholder: the people in the workshop and how long they have been doing this work.",
        ],
      },
      {
        heading: "Made to last",
        body: [
          "Placeholder: how to care for each piece so it keeps its shape, and what the house does when something needs repair.",
        ],
      },
    ],
  },
];
