import SwiftUI

struct GroupsView: View {
    @Environment(NativeStore.self) private var store
    let log: () -> Void
    @State private var create = false
    @State private var join = false
    var body: some View {
        List {
            if store.groups.isEmpty {
                ContentUnavailableView(store.text("Better together", "一起更有动力"), systemImage: "person.2", description: Text(store.text("Start a group or join friends with an invite.", "创建小组，或用邀请链接加入朋友。")))
                Button(store.text("Create a group", "创建小组"), systemImage: "plus") { create = true }
                Button(store.text("Join with invite", "通过邀请加入"), systemImage: "link") { join = true }
            } else {
                Section {
                    ForEach(store.groups) { group in
                        NavigationLink(value: group) {
                            HStack(spacing: 14) {
                                Image(systemName: "person.2.fill").font(.title3).foregroundStyle(NativePalette.teal)
                                    .frame(width: 46, height: 46).background(NativePalette.teal.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(group.name).font(.headline)
                                    Text(store.text("\(group.memberCount) members", "\(group.memberCount) 位成员") + (group.myRole == "owner" ? store.text(" · Owner", " · 我是组长") : ""))
                                        .font(.caption).foregroundStyle(.secondary)
                                    if !group.myBaseReady {
                                        Label(store.text("Set your private baseline", "设置私密基准"), systemImage: "lock.badge.clock").font(.caption).foregroundStyle(.orange)
                                    }
                                }
                            }.padding(.vertical, 6)
                        }.accessibilityIdentifier("group.\(group.id)")
                    }
                }
                Section {
                    Button(action: log) { Label(store.text("Log weight", "记录体重"), systemImage: "plus.circle.fill") }
                }
            }
        }
        .navigationTitle(store.text("Groups", "我的小组"))
        .navigationDestination(for: CloudGroup.self) { group in GroupDetailView(group: group) }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button(store.text("Create a group", "创建小组"), systemImage: "person.2.badge.plus") { create = true }
                    Button(store.text("Join with invite", "通过邀请加入"), systemImage: "link") { join = true }
                } label: { Image(systemName: "plus") }.accessibilityLabel(store.text("Create or join group", "创建或加入小组"))
            }
        }
        .sheet(isPresented: $create) { CreateGroupSheet() }
        .sheet(isPresented: $join) { JoinGroupSheet(initialCode: "") }
        .refreshable { await store.refresh() }
    }
}

struct GroupDetailView: View {
    @Environment(NativeStore.self) private var store
    let group: CloudGroup
    @State private var selectedTab = 0
    @State private var dashboard: GroupDashboard?
    @State private var failure: String?
    @State private var loadID = UUID()
    @State private var showLog = false
    @State private var showBaseline = false
    @State private var selectedMember: CloudMember?
    private var visibleMembers: [CloudMember] { (dashboard?.members ?? []).filter { !store.blockedUsers.contains($0.userId) } }
    private var inviteURL: URL { CloudAPI.origin.appending(path: "join/\(group.inviteCode)").appending(queryItems: [URLQueryItem(name: "lang", value: store.language)]) }

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 10) {
                    Text(group.name).font(.title2.bold()).fixedSize(horizontal: false, vertical: true)
                    if let description = group.description?.nilIfEmpty { Text(description).font(.subheadline).foregroundStyle(.secondary) }
                    Label(store.text("Only weight changes are shared", "小组只分享变化，不公开真实体重"), systemImage: "lock.shield")
                        .font(.caption).foregroundStyle(NativePalette.teal)
                }.padding(.vertical, 6)
                if let dashboard {
                    HStack(spacing: 16) {
                        MetricView(title: store.text("Together", "累计下降"), value: store.weight(dashboard.stats.totalLossKg), color: NativePalette.teal)
                        MetricView(title: store.text("Members", "成员"), value: String(dashboard.stats.memberCount))
                        MetricView(title: store.text("Today", "今日打卡"), value: String(dashboard.stats.loggedTodayCount))
                    }.padding(.vertical, 4)
                }
                Button { showBaseline = true } label: {
                    HStack {
                        Label(store.text("My baseline in this group", "我在本组的私密基准"), systemImage: "lock.rotation")
                        Spacer(minLength: 4)
                        Image(systemName: "slider.horizontal.3")
                    }.font(.subheadline)
                }.accessibilityIdentifier("group.baseline")
                Picker(store.text("Group view", "小组视图"), selection: $selectedTab) {
                    Text(store.text("Trends", "趋势")).tag(0)
                    Text(store.text("Activity", "动态")).tag(1)
                    Text(store.text("Members", "成员")).tag(2)
                }.pickerStyle(.segmented).listRowSeparator(.hidden)
            }
            if let dashboard {
                if selectedTab == 0 {
                    Section {
                        NativeTrendChart(series: visibleMembers.enumerated().map { index, member in
                            TrendSeries(id: member.id, name: member.displayName, color: NativePalette.colors[index % NativePalette.colors.count], points: member.trendline)
                        }).listRowInsets(EdgeInsets(top: 16, leading: 12, bottom: 16, trailing: 12))
                    } header: { SectionTitle(title: store.text("Every little change", "每一点变化"), symbol: "chart.xyaxis.line") }
                    Section {
                        BestDeltaChart(members: visibleMembers)
                    } header: { SectionTitle(title: store.text("All-time best", "历史最大下降"), symbol: "trophy") }
                    membersSection
                } else if selectedTab == 1 {
                    Section {
                        ForEach(dashboard.feed.filter { !store.blockedUsers.contains($0.actorUserId) }) { activity in
                            GroupActivityRow(groupId: group.id, activity: activity, profile: {
                                selectedMember = dashboard.members.first { $0.userId == activity.actorUserId }
                            }, changed: { await reload() })
                        }
                        if dashboard.feed.isEmpty { Text(store.text("The next check-in starts the conversation.", "用下一次打卡，为小组加油。" )).foregroundStyle(.secondary) }
                        if dashboard.feedPage?.hasMore == true {
                            AsyncActionButton(title: store.text("Load more", "加载更多"), symbol: "arrow.down") {
                                self.dashboard = try await store.loadGroup(group.id, more: true)
                            }
                        }
                    } header: { SectionTitle(title: store.text("Group activity", "小组动态"), symbol: "bubble.left.and.bubble.right") }
                } else {
                    membersSection
                    if dashboard.me.role == "owner", let requests = dashboard.joinRequests, !requests.isEmpty {
                        Section {
                            ForEach(requests) { request in
                                VStack(alignment: .leading, spacing: 12) {
                                    HStack {
                                        MemberAvatar(name: request.requesterName, url: request.requesterAvatarUrl)
                                        VStack(alignment: .leading) {
                                            Text(request.requesterName).font(.headline)
                                            if let message = request.message { Text(message).font(.caption).foregroundStyle(.secondary) }
                                        }
                                    }
                                    HStack {
                                        AsyncActionButton(title: store.text("Approve", "同意"), symbol: "checkmark") { try await decide(request, action: "approve") }
                                        Spacer()
                                        AsyncActionButton(title: store.text("Decline", "拒绝"), role: .destructive, symbol: "xmark") { try await decide(request, action: "reject") }
                                    }.buttonStyle(.bordered)
                                }.padding(.vertical, 4)
                            }
                        } header: { Text(store.text("Join requests", "入组申请")) }
                    }
                }
            } else if let failure {
                InlineFailure(message: failure) { Task { await reload() } }
            } else {
                ProgressView().frame(maxWidth: .infinity).padding()
            }
        }
        .navigationTitle(group.name).navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                ShareLink(item: inviteURL) { Image(systemName: "square.and.arrow.up") }
                    .accessibilityLabel(store.text("Invite friends", "邀请朋友"))
                Button { showLog = true } label: { Image(systemName: "plus") }.accessibilityLabel(store.text("Log weight", "记录体重"))
            }
        }
        .safeAreaInset(edge: .bottom, alignment: .trailing) {
            Button { showLog = true } label: { Image(systemName: "plus").font(.title2.bold()).frame(width: 54, height: 54) }
                .buttonStyle(.borderedProminent).buttonBorderShape(.circle)
                .shadow(color: NativePalette.teal.opacity(0.18), radius: 8, y: 4)
                .padding(.trailing, 18).padding(.bottom, 6).accessibilityLabel(store.text("Log weight", "记录体重"))
        }
        .task(id: store.refreshRevision) { await reload() }
        .refreshable { await reload() }
        .sheet(isPresented: $showLog, onDismiss: { Task { await reload() } }) { LogEntrySheet(showActualWeight: false) }
        .sheet(isPresented: $showBaseline, onDismiss: { Task { await reload() } }) { BaselineSheet(group: group, ready: dashboard?.me.baseReady ?? group.myBaseReady) }
        .sheet(item: $selectedMember) { member in MemberProfileSheet(member: member, groupId: group.id) }
    }

    private var membersSection: some View {
        Section {
            ForEach(visibleMembers) { member in
                Button { selectedMember = member } label: {
                    HStack(spacing: 12) {
                        MemberAvatar(name: member.displayName, url: member.avatarUrl)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(member.displayName + (member.isMe ? store.text(" (you)", "（我）") : "")).font(.headline).foregroundStyle(.primary)
                            Text(store.text("\(member.daysLogged) check-ins", "\(member.daysLogged) 天记录")).font(.caption).foregroundStyle(.secondary)
                            if let best = member.historicalBestDeltaKg {
                                Label(store.text("Best ", "最佳 ") + store.delta(best), systemImage: "trophy.fill").font(.caption).foregroundStyle(.orange)
                            }
                        }
                        Spacer(minLength: 4)
                        Text(store.delta(member.deltaKg)).font(.headline).monospacedDigit().foregroundStyle(NativePalette.teal)
                    }.padding(.vertical, 4)
                }
            }
        } header: { SectionTitle(title: store.text("The team", "一起努力的伙伴"), symbol: "person.2") }
    }

    private func reload() async {
        let id = UUID()
        loadID = id
        do {
            let result = try await store.loadGroup(group.id)
            guard loadID == id, !Task.isCancelled else { return }
            dashboard = result
            failure = nil
        }
        catch is CancellationError { }
        catch {
            guard loadID == id else { return }
            if dashboard == nil { failure = error.localizedDescription } else { store.message = error.localizedDescription }
        }
    }

    private func decide(_ request: JoinRequest, action: String) async throws {
        try await store.client().mutate("/api/groups/\(group.id)/join-requests/\(request.id)", method: "PATCH", values: ["action": action])
        await reload()
    }
}

struct CreateGroupSheet: View {
    @Environment(NativeStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var description = ""
    var body: some View {
        NavigationStack {
            Form {
                TextField(store.text("Group name", "小组名称"), text: $name)
                TextField(store.text("A few words for your team", "写给伙伴们的话"), text: $description, axis: .vertical).lineLimit(3...5)
                AsyncActionButton(title: store.text("Create group", "创建小组"), symbol: "person.2.badge.plus") {
                    let data = try JSONSerialization.data(withJSONObject: ["name": String(name.prefix(80)), "description": String(description.prefix(180))])
                    let _: GroupResponse = try await store.client().send("/api/groups", method: "POST", body: data)
                    await store.refresh()
                    dismiss()
                }.disabled(name.nilIfEmpty == nil)
            }.navigationTitle(store.text("New group", "创建小组"))
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button(store.text("Cancel", "取消")) { dismiss() } } }
        }
    }
}

struct JoinGroupSheet: View {
    @Environment(NativeStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let initialCode: String
    @State private var input = ""
    private var code: String {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        if let url = URL(string: trimmed), url.host == CloudAPI.origin.host { return url.lastPathComponent.uppercased() }
        return trimmed.uppercased()
    }
    var body: some View {
        NavigationStack {
            Form {
                TextField(store.text("Invite link or code", "邀请链接或邀请码"), text: $input).textInputAutocapitalization(.characters).autocorrectionDisabled()
                AsyncActionButton(title: store.text("Join group", "加入小组"), symbol: "person.badge.plus") {
                    try await store.client().mutate("/api/groups/join", values: ["inviteCode": code])
                    store.pendingInvite = nil
                    await store.refresh()
                    dismiss()
                }.disabled(code.range(of: "^[A-Z0-9]{5,24}$", options: .regularExpression) == nil)
            }.navigationTitle(store.text("Join your friends", "加入朋友的小组"))
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button(store.text("Cancel", "取消")) { store.pendingInvite = nil; dismiss() } } }
                .onAppear { input = initialCode }
        }
    }
}
