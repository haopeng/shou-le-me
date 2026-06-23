import type { Metadata } from "next";
import SlimYetGroupApp from "@/components/SlimYetGroupApp";
import { copy, normalizeLanguage } from "@/lib/i18n";

type PageProps = {
  searchParams?: Promise<{
    lang?: string | string[];
  }>;
};

async function getLanguage(searchParams: PageProps["searchParams"]) {
  const params = await searchParams;
  const lang = Array.isArray(params?.lang) ? params.lang[0] : params?.lang;
  return normalizeLanguage(lang) ?? "en";
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const language = await getLanguage(searchParams);
  return {
    title: copy[language].appName,
    description: copy[language].tagline
  };
}

export default function Home() {
  return <SlimYetGroupApp />;
}
