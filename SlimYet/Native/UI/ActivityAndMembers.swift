import SwiftUI

struct GroupActivityRow: View {
    @Environment(NativeStore.self) private var store
    let groupId: String
    let activity: CloudActivity
    let profile: () -> Void
    let changed: () async -> Void
    @State private var reacting = false
    @State private var showReactors = false
    private let reactions: [(String, String)] = [("like", "hand.thumbsup.fill"), ("heart", "heart.fill"), ("care", "hands.clap.fill")]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button(action: profile) {
                HStack(alignment: .top, spacing: 12) {
                    MemberAvatar(name: activity.actorName, url: activity.actorAvatarUrl)
                    VStack(alignment: .leading, spacing: 5) {
                        Text(activity.actorName).font(.headline).foregroundStyle(.primary)
                        Text(summary).font(.subheadline).foregroundStyle(.primary).multilineTextAlignment(.leading)
                        if let date = ISO8601DateFormatter().date(from: activity.createdAt) {
                            Text(date, format: .dateTime.month(.abbreviated).day().hour().minute()).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    Spacer(minLength: 0)
                }
            }.buttonStyle(.plain)
            HStack(spacing: 12) {
                ForEach(reactions, id: \.0) { reaction, symbol in
                    let active = activity.myReactions?.contains(reaction) == true
                    Button {
                        reacting = true
                        Task {
                            defer { reacting = false }
                            do {
                                try await store.client().mutate("/api/groups/\(groupId)/feed/\(activity.id)/reactions", values: ["reaction": reaction])
                                await changed()
                            } catch { store.message = error.localizedDescription }
                        }
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: symbol)
                            Text(String(activity.reactionCounts[reaction] ?? 0)).monospacedDigit()
                        }.font(.subheadline).frame(minWidth: 44, minHeight: 40)
                            .foregroundStyle(active ? NativePalette.coral : .secondary)
                    }.buttonStyle(.borderless).disabled(reacting)
                        .accessibilityLabel(reactionTitle(reaction))
                        .accessibilityAddTraits(active ? [.isSelected] : [])
                }
                Spacer(minLength: 0)
                Button { showReactors = true } label: { Image(systemName: "person.2").frame(minWidth: 44, minHeight: 40) }
                    .buttonStyle(.borderless).accessibilityLabel(store.text("Who reacted", "谁送来了鼓励"))
            }
        }.padding(.vertical, 8)
        .sheet(isPresented: $showReactors) {
            NavigationStack {
                List {
                    ForEach(reactions, id: \.0) { reaction, symbol in
                        Section {
                            ForEach(activity.reactionUsers?[reaction] ?? []) { person in
                                HStack {
                                    MemberAvatar(name: person.displayName, url: person.avatarUrl, size: 32)
                                    Text(person.displayName)
                                }
                            }
                        } header: { Label(reactionTitle(reaction), systemImage: symbol) }
                    }
                    if (activity.reactionUsers?.values.flatMap { $0 } ?? []).isEmpty { Text(store.text("Be the first to send some encouragement.", "送出第一份鼓励吧。")) }
                }.navigationTitle(store.text("Encouragement", "收到的鼓励"))
                    .toolbar { ToolbarItem(placement: .confirmationAction) { Button(store.text("Done", "完成")) { showReactors = false } } }
            }.presentationDetents([.medium, .large])
        }
    }
    private var summary: String {
        if activity.kind == "base_set" { return store.text("Set a private starting point. A fresh start!", "设置了私密起点，一起加油！") }
        if let old = activity.previousDeltaKg, let new = activity.newDeltaKg {
            return store.delta(old) + " → " + store.delta(new) + store.text(". Thanks for checking in.", "。每次记录都值得肯定。")
        }
        return store.text("Checked in: ", "完成打卡：") + store.delta(activity.newDeltaKg)
    }
    private func reactionTitle(_ reaction: String) -> String {
        switch reaction {
        case "like": store.text("Like", "赞")
        case "heart": store.text("Heart", "爱心")
        default: store.text("Cheer", "鼓掌")
        }
    }
}

struct MemberProfileSheet: View {
    @Environment(NativeStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let member: CloudMember
    let groupId: String
    @State private var zoom = false
    @State private var report = false
    @State private var confirmBlock = false
    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(spacing: 14) {
                        Button { zoom = true } label: { MemberAvatar(name: member.displayName, url: member.avatarUrl, size: 96) }
                            .accessibilityLabel(store.text("Enlarge profile photo", "放大头像"))
                        Text(member.displayName).font(.title2.bold())
                        Text(store.delta(member.deltaKg)).font(.largeTitle.bold()).foregroundStyle(NativePalette.teal)
                        Label(store.text("Baseline stays private", "基准体重始终保密"), systemImage: "lock.shield").font(.caption).foregroundStyle(.secondary)
                    }.frame(maxWidth: .infinity).padding(.vertical, 14)
                }
                Section {
                    LabeledContent(store.text("Check-ins", "记录天数"), value: String(member.daysLogged))
                    LabeledContent(store.text("All-time best", "历史最佳变化"), value: store.delta(member.historicalBestDeltaKg))
                    if let date = member.latestDate { LabeledContent(store.text("Last check-in", "最近记录"), value: date) }
                    if member.role == "owner" { Label(store.text("Group owner", "小组组长"), systemImage: "person.badge.key") }
                }
                if !member.isMe {
                    Section {
                        Button(store.text("Report profile", "举报资料"), systemImage: "flag") { report = true }
                        Button(store.text("Block member", "屏蔽成员"), systemImage: "person.slash", role: .destructive) { confirmBlock = true }
                    }
                }
            }
            .navigationTitle(store.text("Member", "成员资料")).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button(store.text("Done", "完成")) { dismiss() } } }
            .sheet(isPresented: $report) { ReportMemberSheet(member: member, groupId: groupId) }
            .confirmationDialog(store.text("Hide this member's profile and activity on this device?", "在此设备上隐藏该成员的资料、曲线及动态？"), isPresented: $confirmBlock, titleVisibility: .visible) {
                Button(store.text("Block member", "屏蔽成员"), role: .destructive) { store.block(member); dismiss() }
            }
            .fullScreenCover(isPresented: $zoom) {
                ZStack(alignment: .topTrailing) {
                    Color.black.ignoresSafeArea()
                    AsyncImage(url: member.avatarUrl.flatMap(URL.init(string:))) { image in image.resizable().scaledToFit() } placeholder: { MemberAvatar(name: member.displayName, url: nil, size: 180) }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    Button { zoom = false } label: { Image(systemName: "xmark.circle.fill").font(.largeTitle).foregroundStyle(.white).padding() }
                        .accessibilityLabel(store.text("Close", "关闭"))
                }
            }
        }
    }
}

struct ReportMemberSheet: View {
    @Environment(NativeStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let member: CloudMember
    let groupId: String
    @State private var reason = ""
    @State private var sent = false
    var body: some View {
        NavigationStack {
            Form {
                if sent { Label(store.text("Report received", "举报已提交"), systemImage: "checkmark.shield") }
                else {
                    Text(member.displayName).font(.headline)
                    TextField(store.text("What should we review?", "请描述需要审核的问题"), text: $reason, axis: .vertical).lineLimit(4...8)
                    AsyncActionButton(title: store.text("Send report", "提交举报"), symbol: "flag") {
                        try await store.client().mutate("/api/me/reports", values: ["groupId": groupId, "subjectUserId": member.userId, "reason": String(reason.prefix(1000))])
                        sent = true
                    }.disabled(reason.trimmingCharacters(in: .whitespacesAndNewlines).count < 5)
                }
            }.navigationTitle(store.text("Report", "举报"))
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button(store.text("Done", "完成")) { dismiss() } } }
        }
    }
}
