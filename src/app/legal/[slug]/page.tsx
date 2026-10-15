import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage, contentMetadata } from "@/components/content-page";
import { legalPages } from "@/lib/content-pages";

export const dynamicParams = false;

function findPage(slug: string) {
  return Object.hasOwn(legalPages, slug)
    ? legalPages[slug as keyof typeof legalPages]
    : undefined;
}

export function generateStaticParams() {
  return Object.keys(legalPages).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/legal/[slug]">): Promise<Metadata> {
  const page = findPage((await params).slug);
  return page ? contentMetadata(page) : {};
}

export default async function LegalPage({
  params,
}: PageProps<"/legal/[slug]">) {
  const page = findPage((await params).slug);
  if (!page) notFound();
  return <ContentPage page={page} />;
}
