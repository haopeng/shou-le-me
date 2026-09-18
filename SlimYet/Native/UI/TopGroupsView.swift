import SwiftUI

struct TopGroupsView: View {
    @Environment(NativeStore.self) private var store
    @State private var failure: String?
    @State private var selected: TopGroup?
    @State private var note = ""
    @State private var requested: Set<String> = []
    var body: some View {
        List {
            if let dashboard = store.publicDashboard {
                Section {
                    HStack(spacing: 16) {
                        MetricView(title: store.text("Groups", "小组"), value: String(dashboard.stats.groupCount))
                        MetricView(title: store.text("Together", "累计下降"), value: store.weight(dashboard.stats.totalLossKg), color: NativePalette.teal)
                    }.padding(.vertical, 10)
                }
                Section {
                    ForEach(Array(dashboard.topGroups.prefix(5).enumerated()), id: \.element.id) { rank, group in
                        if let joined = store.groups.first(where: { $0.id == group.id }) {
                            NavigationLink(value: joined) { row(group, rank: rank) }
                        } else {
                            VStack(alignment: .leading, spacing: 8) {
                                row(group, rank: rank)
                                Button(requested.contains(group.id) ? store.text("Request sent", "已申请") : store.text("Request to join", "申请加入")) {
                                    if store.phase == .signedIn { selected = group }
                                    else { store.message = store.text("Sign in to request to join a group.", "请先登录，再申请加入小组。") }
                                }.font(.subheadline).disabled(requested.contains(group.id))
                            }.padding(.vertical, 6)
                        }
                    }
                } header: { SectionTitle(title: store.text("Progress, together", "一起进步的团队"), symbol: "trophy.fill") }
            } else if let failure {
                InlineFailure(message: failure) { Task { await load() } }
            } else { ProgressView().frame(maxWidth: .infinity) }
        }
        .navigationTitle("Top5")
        .navigationDestination(for: CloudGroup.self) { group in GroupDetailView(group: group) }
        .task { await load() }.refreshable { await load() }
        .sheet(item: $selected) { group in
            NavigationStack {
                Form {
                    Text(group.name).font(.headline)
                    TextField(store.text("Introduce yourself (optional)", "介绍一下自己（可选）"), text: $note, axis: .vertical).lineLimit(3...5)
                    AsyncActionButton(title: store.text("Send request", "发送入组申请")) {
                        try await store.client().mutate("/api/groups/\(group.id)/join-requests", values: ["message": String(note.prefix(180))])
                        requested.insert(group.id)
                        selected = nil
                        note = ""
                    }
                }.navigationTitle(store.text("Ask to join", "申请加入"))
                    .toolbar { ToolbarItem(placement: .cancellationAction) { Button(store.text("Cancel", "取消")) { selected = nil; note = "" } } }
            }.presentationDetents([.medium, .large])
        }
    }
    private func row(_ group: TopGroup, rank: Int) -> some View {
        HStack(spacing: 14) {
            Text(String(rank + 1)).font(.title2.bold().monospacedDigit()).foregroundStyle(rank == 0 ? .orange : .secondary).frame(width: 26)
            VStack(alignment: .leading, spacing: 4) {
                Text(group.name).font(.headline)
                Text(store.text("\(group.memberCount) members", "\(group.memberCount) 位成员")).font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 4)
            Text(store.weight(group.totalLossKg)).font(.headline).foregroundStyle(NativePalette.teal).monospacedDigit()
        }.padding(.vertical, 8)
    }
    private func load() async {
        do { try await store.loadTop(); failure = nil } catch { failure = error.localizedDescription }
    }
}
