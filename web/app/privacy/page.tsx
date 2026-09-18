import LegalDocument from "@/components/LegalDocument";

export default async function Privacy({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const zh = (await searchParams).lang === "zh";
  return <LegalDocument title={zh ? "隐私政策" : "Privacy Policy"} zh={zh}>
    <p>{zh ? "更新日期：2026年9月17日" : "Updated September 17, 2026"}</p>
    <h2>{zh ? "保存的数据" : "Information we store"}</h2>
    <p>{zh ? "为提供账号、体重日记和小组功能，我们保存你的邮箱、用户标识、姓名或昵称、所选头像、体重和日期、个人备注、小组成员关系、基准、互动及支持请求。Supabase 负责认证、数据库和图片存储，Vercel 托管网站和接口。" : "To provide your account, weight journal, and groups, we store your email, user ID, name or nickname, chosen avatar, dated weight entries, private notes, group memberships, baselines, reactions, and support requests. Supabase provides authentication, database, and image storage; Vercel hosts the website and API."}</p>
    <h2>{zh ? "谁可以看到" : "Who can see what"}</h2>
    <p>{zh ? "个人页面里的真实体重和基准仅提供给本人。小组成员可查看彼此的昵称、头像、变化值、趋势和互动。Top5 公开小组名称、描述、人数和累计下降值，不公开个人榜单。已上传头像使用公开图片链接；请勿使用敏感照片。必要时，服务管理员可访问后台数据用于维护和处理支持请求。" : "Your personal dashboard provides actual weights and baselines only to you. Group members can see each other's display names, avatars, deltas, trends, and reactions. Top5 publishes group names, descriptions, member counts, and total decreases, not individual rankings. Uploaded avatars use public image URLs; do not upload sensitive photos. Service administrators can access backend data when needed to maintain the service and handle support requests."}</p>
    <h2>{zh ? "设备权限" : "Device access"}</h2>
    <p>{zh ? "iOS 版仅接收你在系统照片选择器里选中的图片，不读取整个相册，不使用 HealthKit、通讯录或位置。不包含广告或跨应用跟踪。登录凭据由认证 SDK 保存在设备钥匙串中。" : "The iOS app receives only photos you choose with the system picker. It does not read your entire photo library or use HealthKit, contacts, or location. It includes no ads or cross-app tracking. The authentication SDK stores credentials in the device Keychain."}</p>
    <h2>{zh ? "保留与删除" : "Retention and deletion"}</h2>
    <p>{zh ? "记录会保留到你删除记录或账号。你可以在 iOS 设置中导出体重历史并申请永久删除账号。删除账号也会删除你创建的小组及其中的动态。支持举报可能在解决后为处理安全问题而保留。基础设施备份和日志按服务商的保留期限清理。" : "Records are retained until you delete them or your account. iOS Settings offers weight-history export and permanent account deletion. Deleting an account also deletes groups it owns and their activity. Safety reports may be retained after resolution for abuse prevention. Infrastructure backups and logs follow the providers' retention periods."}</p>
    <p>{zh ? "隐私或数据问题，请使用应用中的「帮助与支持」。" : "For privacy or data questions, use Help & Support in the app."}</p>
  </LegalDocument>;
}
