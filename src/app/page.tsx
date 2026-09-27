import { CategoryGrid } from "@/components/home/category-grid";
import { CraftStory } from "@/components/home/craft-story";
import { EditorialPair } from "@/components/home/editorial-pair";
import { Hero } from "@/components/home/hero";
import { Intro } from "@/components/home/intro";
import { NewArrivals } from "@/components/home/new-arrivals";
import { ProductRail } from "@/components/home/product-rail";
import { Services } from "@/components/home/services";
import { getNewArrivals, getProductsByCategory } from "@/db/queries/catalog";

export const revalidate = 60;

export default async function Home() {
  const [newArrivals, readyToWear] = await Promise.all([
    getNewArrivals(),
    getProductsByCategory("ready-to-wear"),
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
      <CategoryGrid />
      <CraftStory />
      <Services />
    </main>
  );
}
