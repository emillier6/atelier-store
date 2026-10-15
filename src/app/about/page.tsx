import type { Metadata } from "next";
import { ContentPage, contentMetadata } from "@/components/content-page";
import { contentPages } from "@/lib/content-pages";

const page = contentPages.about;

export const metadata: Metadata = contentMetadata(page);

export default function Page() {
  return <ContentPage page={page} />;
}
