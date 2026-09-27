// Storefront types and static editorial content. Product data lives in the
// database; see `@/db/queries/catalog`.
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
  cta: { label: "Discover the collection", href: "/collections/riviera" },
  image: {
    src: unsplash("1496747611176-843222e1e57c"),
    alt: "Woman in a floral wrap dress walking along a sunlit seafront",
  },
};

export const categories: Collection[] = [
  {
    slug: "women",
    title: "Women",
    image: {
      src: unsplash("1515886657613-9f3515b0c78f"),
      alt: "Model in a saffron tracksuit against a pale blue sky",
    },
  },
  {
    slug: "men",
    title: "Men",
    image: {
      src: unsplash("1617137968427-85924c800a22"),
      alt: "Man in a navy tailored suit walking past a glass facade",
    },
  },
  {
    slug: "handbags",
    title: "Handbags",
    image: {
      src: unsplash("1590874103328-eac38a683ce7"),
      alt: "Woven top-handle bag in tan leather",
    },
  },
  {
    slug: "jewelry",
    title: "Jewelry",
    image: {
      src: unsplash("1611591437281-460bfbe1220a"),
      alt: "Gold chain bracelet on a blush background",
    },
  },
];

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
    body: "Free express delivery and returns on every order.",
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
