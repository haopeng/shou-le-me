import LegalDocument from "@/components/LegalDocument";
export default async function Terms({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const zh = (await searchParams).lang === "zh";
  return <LegalDocument title={zh ? "服务条款" : "Terms of Use"} zh={zh}>
    <p>{zh ? "瘦了么是个人体重日记和互相鼓励的小组工具，不是医疗服务，不承诺减重效果。请遵循适合自己的专业建议，不要追求不安全的体重变化。" : "Slim Yet? is a personal weight journal and group encouragement tool, not a medical service. It does not promise weight-loss results. Follow appropriate professional advice and do not pursue unsafe weight changes."}</p>
    <p>{zh ? "请保护账号和邀请链接。加入小组即表示愿意与该组成员分享昵称、头像及相对基准的变化。请只上传有权使用的图片，不得骚扰、欺骗或发布违法、有害、侮辱性内容。违规资料可被举报和移除，严重或重复违规账号可能被限制。" : "Protect your account and invitation links. Joining a group shares your display name, avatar, and changes from its baseline with members. Upload only images you have permission to use. Harassment, deception, and illegal, harmful, or abusive content are not allowed. Reported content may be removed and serious or repeated abuse may result in account restrictions."}</p>
    <p>{zh ? "你可以修改或删除自己的记录，也可以导出数据和删除账号。请保留重要数据的备份。服务可能因维护暂时不可用。" : "You can edit or delete your entries, export your history, and delete your account. Keep a backup of important information. The service may be temporarily unavailable during maintenance."}</p>
  </LegalDocument>;
}
