/**
 * Seeds the catalogue. Re-runnable: it clears the three catalogue tables in
 * FK-safe order and re-inserts from the literals below. Products are listed
 * newest first. Run with `pnpm db:seed`.
 *
 * Neon's HTTP driver has no interactive transactions, so everything goes
 * through one `db.batch()`, which runs as a single transaction: a failed seed
 * leaves the previous catalogue in place. Ids are generated here so one batch
 * can link categories, products and images without reading anything back.
 */
import { db } from "../src/db";
import { categories, productImages, products } from "../src/db/schema";
import type { Media } from "../src/lib/catalog";
import { unsplash } from "../src/lib/images";

type SeedCategory = { slug: string; name: string };

type SeedProduct = {
  slug: string;
  name: string;
  /** Category name, matched against `seedCategories` below. */
  category: string;
  price: number; // cents
  image: Media;
  gallery?: Media[];
  badge?: string;
  sku: string;
  color: string;
  description: string;
  details: string[];
  sizes?: string[];
  stock: number;
};

const seedCategories: SeedCategory[] = [
  { slug: "ready-to-wear", name: "Ready-to-wear" },
  { slug: "handbags", name: "Handbags" },
  { slug: "shoes", name: "Shoes" },
  { slug: "jewelry", name: "Jewelry" },
  { slug: "eyewear", name: "Eyewear" },
];

const seedProducts: SeedProduct[] = [
  {
    slug: "aurelia-top-handle-bag",
    name: "Aurelia top handle bag",
    category: "Handbags",
    price: 295000,
    badge: "New",
    sku: "AT-1021-RED",
    color: "Poppy red",
    stock: 12,
    description:
      "A structured top handle bag in smooth calf leather, finished with a polished turn-lock closure and a detachable shoulder strap.",
    details: [
      "Smooth calf leather",
      "Palladium-finish hardware",
      "Turn-lock closure",
      "Detachable, adjustable shoulder strap",
      "W 25cm x H 20cm x D 11cm",
      "Made in Italy",
    ],
    image: {
      src: unsplash("1584917865442-de89df76afd3"),
      alt: "Structured red leather top handle bag",
    },
  },
  {
    slug: "intreccio-large-tote",
    name: "Intreccio large tote",
    category: "Handbags",
    price: 345000,
    sku: "AT-1188-COG",
    color: "Cognac",
    stock: 2,
    description:
      "Wide bands of supple leather are hand-woven into a roomy tote, softened by a gold-tone chain that doubles as a shoulder strap.",
    details: [
      "Hand-woven lambskin",
      "Gold-tone chain strap",
      "Magnetic closure",
      "Interior zip pocket",
      "W 40cm x H 30cm x D 14cm",
      "Made in Italy",
    ],
    image: {
      src: unsplash("1598532163257-ae3c6b2524b6"),
      alt: "Woven cognac leather tote with a chain strap",
    },
  },
  {
    slug: "petal-chain-shoulder-bag",
    name: "Petal chain shoulder bag",
    category: "Handbags",
    price: 189000,
    badge: "New",
    sku: "AT-1204-BLS",
    color: "Blush",
    stock: 0,
    description:
      "A slim shoulder bag with a chevron flap in tonal leathers, worn on a fine silver chain from day into evening.",
    details: [
      "Calf leather with contrast chevron inlay",
      "Silver-tone chain strap",
      "Magnetic flap closure",
      "W 22cm x H 14cm x D 6cm",
      "Made in Italy",
    ],
    gallery: [
      {
        src: unsplash("1539109136881-3be0616acf4b"),
        alt: "Woman in a powder-blue coat wearing a blush shoulder bag",
      },
    ],
    image: {
      src: unsplash("1566150905458-1bf1fc113f0d"),
      alt: "Blush leather shoulder bag with a silver chain",
    },
  },
  {
    slug: "giardino-pump",
    name: "Giardino printed pump",
    category: "Shoes",
    price: 98000,
    sku: "AT-2310-FLR",
    color: "Garden print",
    stock: 5,
    sizes: ["36", "37", "38", "39", "40", "41"],
    description:
      "A pointed pump with a slender 100mm heel, covered in a painterly garden print on silk twill.",
    details: [
      "Printed silk twill upper",
      "Leather lining and sole",
      "100mm stiletto heel",
      "Pointed toe",
      "Made in Italy",
    ],
    image: {
      src: unsplash("1543163521-1bf539c55dd2"),
      alt: "Floral printed stiletto pumps on a white plinth",
    },
  },
  {
    slug: "verde-suede-brogue",
    name: "Verde suede brogue",
    category: "Shoes",
    price: 112000,
    sku: "AT-2455-TEA",
    color: "Teal",
    stock: 1,
    sizes: ["40", "41", "42", "43", "44", "45"],
    description:
      "A classic wingtip reworked in soft teal suede, with a hand-punched brogue pattern and a Goodyear-welted sole.",
    details: [
      "Suede upper",
      "Leather lining",
      "Goodyear-welted leather sole",
      "Hand-punched broguing",
      "Made in Italy",
    ],
    image: {
      src: unsplash("1560343090-f0409e92791a"),
      alt: "Teal suede brogue shoe",
    },
  },
  {
    slug: "nero-biker-jacket",
    name: "Nero leather biker jacket",
    category: "Ready-to-wear",
    price: 520000,
    sku: "AT-3012-BLK",
    color: "Black",
    stock: 8,
    sizes: ["44", "46", "48", "50", "52"],
    description:
      "Our biker jacket is cut from lightly waxed lambskin that softens with wear, with an asymmetric zip and notched lapels.",
    details: [
      "100% lambskin leather",
      "Cupro lining",
      "Asymmetric front zip",
      "Zipped cuffs and pockets",
      "Regular fit",
      "Made in Italy",
    ],
    gallery: [
      {
        src: unsplash("1520975954732-35dd22299614"),
        alt: "Man in a black leather jacket crouching against a brick wall",
      },
    ],
    image: {
      src: unsplash("1551028719-00167b16eac5"),
      alt: "Black leather biker jacket laid flat",
    },
  },
  {
    slug: "cascata-drop-earrings",
    name: "Cascata drop earrings",
    category: "Jewelry",
    price: 76000,
    badge: "New",
    sku: "AT-4101-SAP",
    color: "Sapphire blue",
    stock: 4,
    description:
      "Articulated drops of pavé crystal frame a pear-cut blue stone, catching the light with every movement.",
    details: [
      "Palladium-plated brass",
      "Crystal pavé",
      "Pear-cut glass stone",
      "Post back fastening",
      "Length 5.5cm",
    ],
    image: {
      src: unsplash("1535632066927-ab7c9ab60908"),
      alt: "Crystal drop earrings with blue stones on a green leaf",
    },
  },
  {
    slug: "tondo-round-sunglasses",
    name: "Tondo round sunglasses",
    category: "Eyewear",
    price: 54000,
    sku: "AT-5020-GLD",
    color: "Gold / Green",
    stock: 20,
    description:
      "Round metal-frame sunglasses with fine gold rims and green lenses, a quiet classic sized for every face.",
    details: [
      "Gold-tone metal frame",
      "Green mineral lenses",
      "100% UV protection",
      "Adjustable nose pads",
      "Includes leather case",
      "Made in Italy",
    ],
    gallery: [
      {
        src: unsplash("1469334031218-e382a71b716b"),
        alt: "Woman in round sunglasses against a yellow wall",
      },
    ],
    image: {
      src: unsplash("1511499767150-a48a237f0083"),
      alt: "Round gold-rimmed sunglasses with dark lenses",
    },
  },
  {
    slug: "terracotta-bomber",
    name: "Terracotta nylon bomber",
    category: "Ready-to-wear",
    price: 245000,
    sku: "AT-3120-TER",
    color: "Terracotta",
    stock: 6,
    sizes: ["XS", "S", "M", "L"],
    description:
      "A lightweight bomber in water-repellent technical nylon, with ribbed trims and a clean zip front.",
    details: [
      "100% recycled nylon",
      "Water-repellent finish",
      "Ribbed collar, cuffs and hem",
      "Two welt pockets",
      "Relaxed fit",
    ],
    image: {
      src: unsplash("1591047139829-d91aecb6caea"),
      alt: "Rust-coloured bomber jacket on a hanger",
    },
  },
  {
    slug: "crochet-fringe-poncho",
    name: "Crochet fringe poncho",
    category: "Ready-to-wear",
    price: 168000,
    sku: "AT-3198-CRM",
    color: "Cream",
    stock: 0,
    description:
      "Hand-crocheted in soft cotton, this poncho falls to a fringed hem and layers easily over summer dresses.",
    details: [
      "100% organic cotton",
      "Hand-crocheted",
      "Fringed hem",
      "One size",
      "Made in Italy",
    ],
    image: {
      src: unsplash("1434389677669-e08b4cac3105"),
      alt: "Cream crochet poncho with fringe on a hanger",
    },
  },
  {
    slug: "sabbia-jogging-trouser",
    name: "Sabbia jersey trouser",
    category: "Ready-to-wear",
    price: 89000,
    sku: "AT-3240-SND",
    color: "Sand",
    stock: 9,
    sizes: ["XS", "S", "M", "L", "XL"],
    description:
      "Relaxed trousers in brushed cotton jersey with an elasticated waist and cuffed ankles, made for travel days.",
    details: [
      "Cotton jersey",
      "Elasticated drawstring waist",
      "Side pockets",
      "Cuffed ankles",
      "Relaxed fit",
    ],
    image: {
      src: unsplash("1594633312681-425c7b97ccd1"),
      alt: "Sand-coloured cuffed trousers",
    },
  },
  {
    slug: "cesto-wicker-bag",
    name: "Cesto wicker top handle",
    category: "Handbags",
    price: 210000,
    sku: "AT-1302-TAN",
    color: "Tan",
    stock: 3,
    description:
      "A structured wicker body is trimmed in tan leather and finished with a rounded top handle and turn-lock.",
    details: [
      "Hand-woven wicker",
      "Calf leather trims",
      "Gold-tone turn-lock",
      "Detachable shoulder strap",
      "W 24cm x H 21cm x D 12cm",
    ],
    image: {
      src: unsplash("1590874103328-eac38a683ce7"),
      alt: "Woven top-handle bag in tan leather",
    },
  },
  {
    slug: "filigree-bracelet",
    name: "Filigree chain bracelet",
    category: "Jewelry",
    price: 64000,
    sku: "AT-4230-GLD",
    color: "Gold",
    stock: 15,
    description:
      "A fluid bracelet of interlocking filigree links, finished in warm gold and set with tiny crystals.",
    details: [
      "18k gold-plated brass",
      "Crystal details",
      "Box clasp",
      "Length 18cm",
    ],
    image: {
      src: unsplash("1611591437281-460bfbe1220a"),
      alt: "Gold chain bracelet on a blush background",
    },
  },
];

// Fixed base so re-seeding doesn't reorder "New Arrivals".
const SEEDED_AT = Date.parse("2026-09-01T00:00:00Z");
const HOUR = 60 * 60 * 1000;

async function main() {
  const categoryRows = seedCategories.map((c, position) => ({
    id: crypto.randomUUID(),
    ...c,
    position,
  }));
  const categoryIds = new Map(categoryRows.map((c) => [c.name, c.id]));

  const productRows = seedProducts.map((p, i) => {
    const categoryId = categoryIds.get(p.category);
    if (categoryId === undefined) {
      throw new Error(`Unknown category "${p.category}" for ${p.slug}`);
    }
    return {
      id: crypto.randomUUID(),
      categoryId,
      slug: p.slug,
      name: p.name,
      sku: p.sku,
      colour: p.color,
      priceCents: p.price,
      badge: p.badge ?? null,
      description: p.description,
      details: p.details,
      sizes: p.sizes ?? [],
      stockQuantity: p.stock,
      createdAt: new Date(SEEDED_AT - i * HOUR),
    };
  });

  const imageRows = seedProducts.flatMap((p, i) =>
    [p.image, ...(p.gallery ?? [])].map((image, position) => ({
      productId: productRows[i].id,
      url: image.src,
      alt: image.alt,
      position,
    })),
  );

  await db.batch([
    db.delete(productImages),
    db.delete(products),
    db.delete(categories),
    db.insert(categories).values(categoryRows),
    db.insert(products).values(productRows),
    db.insert(productImages).values(imageRows),
  ]);

  console.log(
    `Seeded ${categoryRows.length} categories, ${productRows.length} products, ${imageRows.length} images.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
