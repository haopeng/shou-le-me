import SwiftData
import SwiftUI

struct ContentView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \WeightEntry.date, order: .reverse, animation: .snappy) private var entries: [WeightEntry]
    @AppStorage("weightUnit") private var unitRawValue = WeightUnit.kilogram.rawValue

    @State private var draft = WeightDraft()
    @State private var savePulse = false
    @State private var celebration: SaveCelebration?

    private let engine = InsightsEngine()
    private let calendar = Calendar.current

    private var unit: WeightUnit {
        WeightUnit(rawValue: unitRawValue) ?? .kilogram
    }

    private var unitSelection: Binding<WeightUnit> {
        Binding(
            get: { unit },
            set: { unitRawValue = $0.rawValue }
        )
    }

    private var records: [WeightRecord] {
        entries.map(\.record).sorted { $0.date < $1.date }
    }

    private var insights: [TrendInsight] {
        engine.makeInsights(from: records, calendar: calendar)
    }

    private var metrics: [ScoreMetric] {
        engine.makeScoreMetrics(from: records, calendar: calendar)
    }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        HeroSummaryView(records: records, insights: insights, unit: unit)

                        QuickEntryCard(
                            draft: $draft,
                            unit: unit,
                            savePulse: savePulse,
                            onSave: saveDraft
                        )

                        if records.isEmpty {
                            EmptyDashboardView()
                        } else {
                            InsightStrip(insights: insights, unit: unit)

                            TrendChartView(
                                records: engine.chartRecords(from: records, limit: 90, calendar: calendar),
                                unit: unit
                            )

                            ScoreGrid(metrics: metrics, unit: unit)

                            HistorySection(
                                entries: entries,
                                unit: unit,
                                onDelete: deleteEntry
                            )
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.vertical, 16)
                }
                .background(AppTheme.screenBackground.ignoresSafeArea())

                if let celebration {
                    SaveCelebrationToast(celebration: celebration)
                        .padding(.horizontal, 18)
                        .padding(.top, 12)
                        .transition(.move(edge: .top).combined(with: .opacity))
                        .zIndex(2)
                }
            }
            .navigationTitle("app.title")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Picker("unit.title", selection: unitSelection) {
                        ForEach(WeightUnit.allCases) { unit in
                            Text(unit.title).tag(unit)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 116)
                }
            }
        }
    }

    private func saveDraft() {
        guard let displayWeight = draft.weightText.decimalValue, displayWeight > 0 else { return }

        let now = Date()
        let weightKg = unit.kilograms(fromDisplayValue: displayWeight)
        let trimmedNote = draft.note.trimmingCharacters(in: .whitespacesAndNewlines)
        let updatedRecords = records
            .filter { !calendar.isDate($0.date, inSameDayAs: draft.date) }
            + [WeightRecord(date: draft.date, weightKg: weightKg, note: trimmedNote)]
        let celebrationMessage = makeCelebrationMessage(for: updatedRecords)

        if let existing = entries.first(where: { calendar.isDate($0.date, inSameDayAs: draft.date) }) {
            existing.date = draft.date
            existing.weightKg = weightKg
            existing.note = trimmedNote
            existing.updatedAt = now
        } else {
            modelContext.insert(
                WeightEntry(
                    date: draft.date,
                    weightKg: weightKg,
                    note: trimmedNote,
                    createdAt: now,
                    updatedAt: now
                )
            )
        }

        try? modelContext.save()

        withAnimation(.spring(response: 0.25, dampingFraction: 0.75)) {
            savePulse.toggle()
            draft = WeightDraft()
        }

        showCelebration(message: celebrationMessage)
    }

    private func deleteEntry(_ entry: WeightEntry) {
        withAnimation {
            modelContext.delete(entry)
            try? modelContext.save()
        }
    }

    private func makeCelebrationMessage(for records: [WeightRecord]) -> String {
        guard let firstInsight = engine.makeInsights(from: records, calendar: calendar).first else {
            return localizedString("celebration.saved.message")
        }

        switch firstInsight.kind {
        case .personalLow:
            return localizedString("celebration.personalLow.message")
        case .sevenDayLow:
            return localizedString("celebration.sevenDayLow.message")
        case .belowThirtyDayAverage:
            return localizedString("celebration.belowAverage.message")
        case .weeklyAverageDown:
            return localizedString("celebration.weeklyAverage.message")
        case let .loggingStreak(days):
            return localizedString("celebration.streak.message", days)
        case .gettingStarted:
            return localizedString("celebration.saved.message")
        }
    }

    private func showCelebration(message: String) {
        let celebration = SaveCelebration(message: message)
        withAnimation(.spring(response: 0.32, dampingFraction: 0.82)) {
            self.celebration = celebration
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 2.6) {
            guard self.celebration?.id == celebration.id else { return }
            withAnimation(.easeOut(duration: 0.22)) {
                self.celebration = nil
            }
        }
    }
}

struct WeightDraft {
    var weightText = ""
    var date = Date()
    var note = ""
}

private struct EmptyDashboardView: View {
    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(AppTheme.celebrationGradient.opacity(0.22))
                Image(systemName: "sparkles")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(AppTheme.coral)
            }
            .frame(width: 54, height: 54)

            VStack(alignment: .leading, spacing: 6) {
                Text("empty.title")
                    .font(.headline)
                    .foregroundStyle(AppTheme.ink)
                Text("empty.message")
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(AppTheme.surface.opacity(0.92))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(AppTheme.teal.opacity(0.14), lineWidth: 1)
        }
        .shadow(color: AppTheme.shadow(opacity: 0.07), radius: 16, x: 0, y: 8)
    }
}

private struct HeroSummaryView: View {
    let records: [WeightRecord]
    let insights: [TrendInsight]
    let unit: WeightUnit

    private var latest: WeightRecord? {
        records.last
    }

    private var bestWeight: Double? {
        records.map(\.weightKg).min()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("hero.kicker")
                        .font(.caption.weight(.bold))
                        .textCase(.uppercase)
                        .foregroundStyle(.white.opacity(0.78))

                    Text(titleText)
                        .font(.system(size: 34, weight: .black, design: .rounded))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                        .minimumScaleFactor(0.76)

                    Text(subtitleText)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.white.opacity(0.86))
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: 6)

                HeroBadge()
            }

            HStack(spacing: 10) {
                HeroChip(title: "hero.logs", value: "\(records.count)")
                HeroChip(title: "hero.best", value: bestText)
            }
        }
        .padding(18)
        .background {
            ZStack(alignment: .bottomTrailing) {
                AppTheme.heroGradient

                VStack(spacing: 10) {
                    ForEach(0..<4) { index in
                        Capsule()
                            .fill(.white.opacity(0.12))
                            .frame(width: CGFloat(72 + index * 26), height: 8)
                            .rotationEffect(.degrees(-18))
                    }
                }
                .offset(x: 34, y: 18)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .shadow(color: AppTheme.shadow(AppTheme.teal, opacity: 0.26), radius: 22, x: 0, y: 12)
    }

    private var titleText: String {
        guard let latest else {
            return localizedString("hero.title.empty")
        }
        return localizedString("hero.title.latest", unit.formattedWeight(latest.weightKg))
    }

    private var subtitleText: String {
        guard let first = insights.first else {
            return localizedString("hero.subtitle.empty")
        }

        switch first.kind {
        case .personalLow:
            return localizedString("hero.subtitle.personalLow")
        case .sevenDayLow:
            return localizedString("hero.subtitle.sevenDayLow")
        case .belowThirtyDayAverage:
            return localizedString("hero.subtitle.belowAverage")
        case .weeklyAverageDown:
            return localizedString("hero.subtitle.weeklyAverage")
        case .loggingStreak:
            return localizedString("hero.subtitle.streak")
        case .gettingStarted:
            return localizedString("hero.subtitle.empty")
        }
    }

    private var bestText: String {
        guard let bestWeight else { return localizedString("hero.best.empty") }
        return unit.formattedWeight(bestWeight)
    }
}

private struct HeroBadge: View {
    var body: some View {
        Image("SparkCoinBadge")
            .resizable()
            .scaledToFill()
            .frame(width: 78, height: 78)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(.white.opacity(0.34), lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.14), radius: 14, x: 0, y: 8)
            .rotationEffect(.degrees(4))
        .accessibilityHidden(true)
    }
}

private struct HeroChip: View {
    let title: LocalizedStringKey
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.caption2.weight(.bold))
                .textCase(.uppercase)
                .foregroundStyle(.white.opacity(0.68))
            Text(value)
                .font(.subheadline.weight(.heavy))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(.white.opacity(0.14))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

private struct SaveCelebration: Identifiable, Equatable {
    let id = UUID()
    let message: String
}

private struct SaveCelebrationToast: View {
    let celebration: SaveCelebration

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(AppTheme.celebrationGradient)
                Image(systemName: "checkmark.seal.fill")
                    .font(.title3.weight(.bold))
                    .foregroundStyle(.white)
            }
            .frame(width: 44, height: 44)

            VStack(alignment: .leading, spacing: 2) {
                Text("celebration.title")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(AppTheme.ink)
                Text(celebration.message)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(AppTheme.muted)
                    .lineLimit(2)
            }

            Spacer(minLength: 0)
        }
        .padding(12)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(.white.opacity(0.46), lineWidth: 1)
        }
        .shadow(color: AppTheme.shadow(opacity: 0.16), radius: 22, x: 0, y: 12)
    }
}

@MainActor
private let previewModelContainer: ModelContainer = {
    let schema = Schema([WeightEntry.self])
    let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: schema, configurations: [configuration])
    let calendar = Calendar.current
    let weights = [73.6, 73.4, 73.2, 73.1, 72.9, 73.0, 72.7, 72.6, 72.4, 72.2, 72.1, 71.9]

    for (index, weight) in weights.enumerated() {
        let daysAgo = weights.count - index - 1
        let date = calendar.date(byAdding: .day, value: -daysAgo, to: Date()) ?? Date()
        container.mainContext.insert(
            WeightEntry(
                date: date,
                weightKg: weight,
                note: index == weights.count - 1 ? "Felt steady" : ""
            )
        )
    }

    return container
}()

#Preview {
    ContentView()
        .modelContainer(previewModelContainer)
}
