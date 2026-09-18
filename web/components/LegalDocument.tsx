import Link from "next/link";

export default function LegalDocument({ title, children, zh = false }: { title: string; children: React.ReactNode; zh?: boolean }) {
  return <main lang={zh ? "zh-CN" : "en"} style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px", lineHeight: 1.8 }}>
    <Link href={zh ? "/?lang=zh" : "/"}>{zh ? "瘦了么" : "Slim Yet?"}</Link>
    <h1 style={{ fontSize: 32, lineHeight: 1.2 }}>{title}</h1>
    {children}
    <hr />
    <nav style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
      <Link href={`/privacy${zh ? "?lang=zh" : ""}`}>{zh ? "隐私政策" : "Privacy"}</Link>
      <Link href={`/terms${zh ? "?lang=zh" : ""}`}>{zh ? "服务条款" : "Terms"}</Link>
      <Link href={`/support${zh ? "?lang=zh" : ""}`}>{zh ? "帮助与支持" : "Support"}</Link>
    </nav>
  </main>;
}
