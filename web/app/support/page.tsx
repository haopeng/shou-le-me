import LegalDocument from "@/components/LegalDocument";
export default async function Support({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const zh = (await searchParams).lang === "zh";
  const email = process.env.SUPPORT_EMAIL;
  return <LegalDocument title={zh ? "帮助与支持" : "Help & Support"} zh={zh}>
    <h2>{zh ? "体重与小组" : "Weights and groups"}</h2>
    <p>{zh ? "同一天再次保存会更新当天记录。记录一次体重会更新所有已设置基准的小组。每个小组可以使用不同的私密基准；修改基准会重新计算该组的变化值。" : "Saving again on the same date updates that day's entry. One check-in updates every group with a baseline. Each group can have a different private baseline; changing it recalculates that group's deltas."}</p>
    <h2>{zh ? "账号与隐私" : "Account and privacy"}</h2>
    <p>{zh ? "iOS 应用的设置页提供资料编辑、体重导出、账号删除及支持请求。忘记密码时，可在登录页面发送重设密码邮件。" : "iOS Settings includes profile editing, weight export, account deletion, and support requests. The sign-in screen can send a password-reset email."}</p>
    <h2>{zh ? "联系我们" : "Contact"}</h2>
    {email ? <p><a href={`mailto:${email}`}>{email}</a></p> : <p>{zh ? "请在 iOS 应用的设置页打开「帮助与支持」，提交问题或隐私请求。" : "Open Help & Support in iOS Settings to submit a question or privacy request."}</p>}
  </LegalDocument>;
}
