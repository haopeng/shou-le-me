import type { Metadata } from "next";
import JoinGroupClient from "@/components/JoinGroupClient";
import { copy, normalizeLanguage } from "@/lib/i18n";

type JoinPageProps = {
  params: Promise<{
    code: string;
  }>;
  searchParams?: Promise<{
    lang?: string | string[];
  }>;
};

async function getLanguage(searchParams: JoinPageProps["searchParams"]) {
  const params = await searchParams;
  const lang = Array.isArray(params?.lang) ? params.lang[0] : params?.lang;
  return normalizeLanguage(lang) ?? "en";
}

export async function generateMetadata({ searchParams }: JoinPageProps): Promise<Metadata> {
  const language = await getLanguage(searchParams);
  return {
    title: copy[language].inviteTitle,
    description: copy[language].tagline
  };
}

export default async function JoinPage({ params }: JoinPageProps) {
  const { code } = await params;
  return <JoinGroupClient code={code} />;
}
