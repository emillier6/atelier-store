import { CategoryGrid } from "@/components/home/category-grid";
import { CraftStory } from "@/components/home/craft-story";
import { EditorialPair } from "@/components/home/editorial-pair";
import { Hero } from "@/components/home/hero";
import { Intro } from "@/components/home/intro";
import { NewArrivals } from "@/components/home/new-arrivals";
import { ProductRail } from "@/components/home/product-rail";
import { Services } from "@/components/home/services";
import {
  getCategoryCovers,
  getNewArrivals,
  getProductsByCategory,
} from "@/lib/products";

export const revalidate = 60;

export default async function Home() {
  const [newArrivals, readyToWear, categories] = await Promise.all([
    getNewArrivals(),
    getProductsByCategory("ready-to-wear"),
    getCategoryCovers(),
  ]);

  return (
    <main className="flex-1">
      <Hero />
      <Intro />
      <NewArrivals products={newArrivals} />
      <EditorialPair />
      <ProductRail
        title="The Ready-to-Wear Edit"
        products={readyToWear}
        action={{
          label: "Shop ready-to-wear",
          href: "/collections/ready-to-wear",
        }}
      />
      <CategoryGrid categories={categories} />
      <CraftStory />
      <Services />
    </main>
  );
}
