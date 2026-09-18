import SwiftUI

struct PersonalView: View {
    @Environment(NativeStore.self) private var store
    let log: () -> Void
    @State private var editLog: CloudLog?
    @State private var deleteLog: CloudLog?
    @State private var historyLimit = 15
    var body: some View {
        List {
            Section {
                HStack {
                    VStack(alignment: .leading, spacing: 8) {
                        Label(store.text("Only you", "仅自己可见"), systemImage: "lock.fill").font(.caption).foregroundStyle(.secondary)
                        Text(store.profile?.displayName ?? store.text("My Journey", "我的旅程")).font(.title3.bold())
                    }
                    Spacer()
                    MemberAvatar(name: store.profile?.displayName ?? "", url: store.profile?.avatarUrl, size: 52)
                }.listRowSeparator(.hidden)
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(store.personal?.stats.latestWeightKg.map { String(format: "%.1f", store.unit.displayValue(fromKilograms: $0)) } ?? "--")
                        .font(.system(size: 52, weight: .bold, design: .rounded)).monospacedDigit().minimumScaleFactor(0.6)
                    Text(store.unit.symbol).font(.title3).foregroundStyle(.secondary)
                    Spacer(minLength: 8)
                    if let change = store.personal?.stats.changeFromPreviousKg {
                        Text(store.delta(change)).font(.subheadline.bold()).foregroundStyle(change < 0 ? NativePalette.teal : .secondary)
                    }
                }.listRowSeparator(.hidden)
                Button(action: log) {
                    Label(store.text("Log weight", "记录体重"), systemImage: "plus").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 7)
                }.buttonStyle(.borderedProminent).listRowSeparator(.hidden).accessibilityIdentifier("personal.logWeight")
                if let stats = store.personal?.stats {
                    HStack(spacing: 16) {
                        MetricView(title: store.text("Since first log", "累计变化"), value: store.delta(stats.changeFromFirstKg), color: NativePalette.teal)
                        MetricView(title: store.text("Personal best", "历史最低"), value: store.weight(stats.lowestWeightKg))
                        MetricView(title: store.text("Check-ins", "记录天数"), value: String(stats.loggedDays))
                    }.padding(.vertical, 6)
                }
            }
            if let personal = store.personal, !personal.logs.isEmpty {
                Section {
                    NativeTrendChart(series: [TrendSeries(id: "me", name: store.text("Me", "我"), color: NativePalette.teal, points: personal.logs.map { DeltaPoint(date: $0.recordedOn, deltaKg: $0.weightKg) })], absolute: true)
                        .listRowInsets(EdgeInsets(top: 16, leading: 12, bottom: 16, trailing: 12))
                } header: { SectionTitle(title: store.text("Your trend", "我的趋势"), symbol: "chart.xyaxis.line") }
                if !personal.highlights.isEmpty {
                    Section {
                        ForEach(Array(personal.highlights.enumerated()), id: \.offset) { _, highlight in
                            Label(highlightText(highlight), systemImage: highlight.kind == "personal_low" ? "trophy.fill" : "sparkles")
                                .foregroundStyle(highlight.tone == "good" ? NativePalette.teal : .primary)
                                .padding(.vertical, 3)
                        }
                    } header: { SectionTitle(title: store.text("Small wins", "我的亮点"), symbol: "sparkles") }
                }
                Section {
                    ForEach(Array(personal.logs.reversed().prefix(historyLimit))) { entry in
                        Button { editLog = entry } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(entry.date, format: .dateTime.month(.abbreviated).day().year()).foregroundStyle(.primary)
                                    if let note = entry.note?.nilIfEmpty { Text(note).font(.caption).foregroundStyle(.secondary).lineLimit(2) }
                                }
                                Spacer()
                                Text(store.weight(entry.weightKg)).font(.headline).monospacedDigit().foregroundStyle(.primary)
                            }.padding(.vertical, 4)
                        }.swipeActions {
                            Button(role: .destructive) { deleteLog = entry } label: { Label(store.text("Delete", "删除"), systemImage: "trash") }
                        }
                    }
                    if historyLimit < personal.logs.count {
                        Button(store.text("Load more", "加载更多")) { historyLimit += 15 }
                    }
                } header: { SectionTitle(title: store.text("History", "我的记录"), symbol: "clock") }
            } else if store.isRefreshing {
                Section { ProgressView().frame(maxWidth: .infinity) }
            } else {
                Section {
                    ContentUnavailableView(store.text("Your first check-in", "从第一次记录开始"), systemImage: "chart.line.uptrend.xyaxis", description: Text(store.text("Every journey starts somewhere.", "每一次记录，都值得肯定。")))
                }
            }
        }
        .navigationTitle(store.text("My Journey", "我的旅程"))
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button(action: log) { Image(systemName: "plus") }.accessibilityLabel(store.text("Log weight", "记录体重")) } }
        .refreshable { await store.refresh() }
        .sheet(item: $editLog) { entry in LogEntrySheet(showActualWeight: true, editing: entry) }
        .confirmationDialog(store.text("Delete this check-in? All group trends will update.", "删除这条记录？所有小组的趋势都会更新。"), isPresented: Binding(get: { deleteLog != nil }, set: { if !$0 { deleteLog = nil } }), titleVisibility: .visible) {
            if let entry = deleteLog {
                Button(store.text("Delete", "删除"), role: .destructive) { Task { do { try await store.deleteLog(entry.recordedOn) } catch { store.message = error.localizedDescription }; deleteLog = nil } }
            }
        }
    }

    private func highlightText(_ value: CloudHighlight) -> String {
        switch value.kind {
        case "personal_low": return store.text("A new personal low", "新的个人最低记录")
        case "below_average": return store.text("Below your recent average by ", "低于近期平均 ") + store.weight(value.valueKg)
        case "latest_move": return store.text("Since your previous check-in: ", "相比上次记录：") + store.delta(value.valueKg)
        case "consistency": return store.text("\(value.count ?? 0) days of showing up", "已经记录 \(value.count ?? 0) 天")
        default: return store.text("Keep showing up for yourself", "继续关心自己的变化")
        }
    }
}
