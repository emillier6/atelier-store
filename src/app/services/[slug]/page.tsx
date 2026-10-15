import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage, contentMetadata } from "@/components/content-page";
import { servicePages } from "@/lib/content-pages";

export const dynamicParams = false;

function findPage(slug: string) {
  return Object.hasOwn(servicePages, slug)
    ? servicePages[slug as keyof typeof servicePages]
    : undefined;
}

export function generateStaticParams() {
  return Object.keys(servicePages).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/services/[slug]">): Promise<Metadata> {
  const page = findPage((await params).slug);
  return page ? contentMetadata(page) : {};
}

export default async function ServicePage({
  params,
}: PageProps<"/services/[slug]">) {
  const page = findPage((await params).slug);
  if (!page) notFound();
  return <ContentPage page={page} />;
}
