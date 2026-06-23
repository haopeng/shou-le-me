import JoinGroupClient from "@/components/JoinGroupClient";

type JoinPageProps = {
  params: Promise<{
    code: string;
  }>;
};

export default async function JoinPage({ params }: JoinPageProps) {
  const { code } = await params;
  return <JoinGroupClient code={code} />;
}
