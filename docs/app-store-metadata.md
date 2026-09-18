# App Store Listing Draft

Owner review is required before publication. Do not submit until the release gates in `ios-release.md` are complete.

## English

Name: **Slim Yet?**

Subtitle: **Small changes, shared progress**

Promotional text:

Track your weight, notice your small wins, and encourage your friends. Your actual weight stays private; your group sees only the change.

Description:

Slim Yet? makes a quick check-in feel worthwhile.

Keep your own private weight history, explore your trends, and see the little milestones you might otherwise miss. Create a group with friends or family and encourage one another without sharing your actual weight.

- A private personal dashboard and clear daily, weekly, and monthly trends.
- A different private starting point for every group.
- One check-in updates progress across all your groups.
- Friendly reactions and an activity feed that celebrates showing up.
- Group invitations, join requests, and a public Top5 group board.
- Kilograms or pounds, English or Simplified Chinese.
- Export your history and manage your account from Settings.

Your wellbeing matters more than a number. Slim Yet? is a journal and social encouragement tool, not medical advice or a promise of weight-loss results.

Keywords: weight,journal,tracker,progress,group,habit,checkin,trends,private

## 简体中文

名称：**瘦了么**

副标题：**记录变化，和朋友一起进步**

宣传文本：

记录体重，发现小小的进步，和朋友互相鼓励。真实体重只留给自己，小组只分享变化值。

描述：

每一次记录，都值得肯定。

瘦了么帮你保留私密体重日记，用清晰的趋势图发现变化和小亮点。也可以和朋友、家人创建小组，在不公开真实体重的前提下，一起坚持、互相加油。

- 个人体重历史仅自己可见。
- 每个小组都有独立的私密基准。
- 记录一次，更新所有小组的变化。
- 每日趋势、每周和每月最低点、历史最佳变化。
- 点赞、爱心和鼓掌，为彼此的坚持送上鼓励。
- 邀请链接、入组申请和公开的小组 Top5。
- 支持公斤和磅，中英文随时切换。
- 可导出个人记录，也可在设置中管理和删除账号。

健康比任何数字都重要。瘦了么是记录和鼓励工具，不提供医疗建议，也不承诺减重效果。

关键词：体重,记录,趋势,打卡,健康,小组,日记,隐私,进步

## Connect Fields

- Category: Health & Fitness.
- Price: Free; there are no in-app purchases or subscriptions in this build.
- Privacy URL: `https://shou-le-me.vercel.app/privacy`
- Chinese privacy URL: `https://shou-le-me.vercel.app/privacy?lang=zh`
- Support URL: `https://shou-le-me.vercel.app/support` (set the public support contact first).
- Bundle ID: `com.haopeng.slimyet`.
- Version: 1.0; build: 1 (increment for subsequent uploads).
- Age rating: complete Apple's current questionnaire truthfully, including user-generated content and health/fitness subject matter. The owner must decide the intended audience.
- Privacy labels: linked health data, name, email, user ID, photos, other user content, and customer support; used for app functionality; not tracking. Validate against the final archive and hosting configuration.

## Suggested Screenshot Order

1. Personal journey: actual weight and trend using synthetic review-account data.
2. Group trends: several people, visible delta axes, no actual/baseline weights.
3. Weekly or monthly low view.
4. Group activity and encouragement.
5. Quick weight-entry sheet with visible unit.

Use captures from the final Release/TestFlight build on supported App Store screenshot dimensions. The automated DEBUG test captures are for layout QA, not a replacement for final release captures.

## Review Notes Draft

The app uses an existing Supabase-backed account system shared with the website. The first release uses email/password and email links. Supply an email/password review account that does not require access to a personal inbox.

Weight data is manually entered. Personal actual weights are visible only in My Journey. Group members receive relative changes from a private, group-specific baseline. Top5 lists groups, not individual users, and does not permit nonmembers to enter a group without approval or an invite.

Account deletion is in Settings > Delete my account and requires a fresh sign-in and explicit confirmation. It also deletes groups owned by that account. Use a disposable review account to exercise deletion. Profile reporting and blocking are available by opening another group member's profile.

Review account email/password: **owner to provide through App Store Connect, not this public repository**.
