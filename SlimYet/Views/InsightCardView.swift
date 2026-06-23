import SwiftUI

struct InsightStrip: View {
    let insights: [TrendInsight]
    let unit: WeightUnit

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("insights.title", systemImage: "wand.and.stars")
                .font(.headline)
                .foregroundStyle(AppTheme.ink)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(insights) { insight in
                        InsightCardView(insight: insight, unit: unit)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.viewAligned)
        }
    }
}

struct InsightCardView: View {
    let insight: TrendInsight
    let unit: WeightUnit

    private var iconName: String {
        switch insight.kind {
        case .personalLow:
            "rosette"
        case .sevenDayLow:
            "arrow.down.forward.circle.fill"
        case .belowThirtyDayAverage:
            "chart.line.downtrend.xyaxis.circle.fill"
        case .weeklyAverageDown:
            "waveform.path.ecg"
        case .loggingStreak:
            "flame.fill"
        case .gettingStarted:
            "sparkle.magnifyingglass"
        }
    }

    private var accent: Color {
        AppTheme.color(for: insight.tone)
    }

    var body: some View {
        let content = displayContent

        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(accent.opacity(0.14))
                    Image(systemName: iconName)
                        .font(.headline.weight(.bold))
                        .foregroundStyle(accent)
                }
                .frame(width: 38, height: 38)

                Spacer()

                Text(content.tag)
                    .font(.caption2.weight(.heavy))
                    .textCase(.uppercase)
                    .foregroundStyle(accent)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 5)
                    .background(accent.opacity(0.10))
                    .clipShape(Capsule())
            }

            Text(content.title)
                .font(.title3.weight(.black))
                .foregroundStyle(AppTheme.ink)
                .lineLimit(2)
                .minimumScaleFactor(0.8)

            Text(content.message)
                .font(.subheadline)
                .foregroundStyle(AppTheme.muted)
                .lineLimit(3)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(width: 224, height: 164, alignment: .topLeading)
        .padding(15)
        .background {
            LinearGradient(
                colors: [accent.opacity(0.16), AppTheme.surface, AppTheme.surface],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(accent.opacity(0.18), lineWidth: 1)
        }
        .shadow(color: AppTheme.shadow(accent, opacity: 0.12), radius: 14, x: 0, y: 8)
    }

    private var displayContent: (title: String, message: String, tag: String) {
        switch insight.kind {
        case let .personalLow(weightKg, previousLowKg):
            return (
                localizedString("insight.personalLow.title"),
                localizedString(
                    "insight.personalLow.message",
                    unit.formattedWeight(weightKg),
                    unit.formattedAbsoluteDelta(previousLowKg - weightKg)
                ),
                localizedString("insight.tag.best")
            )
        case let .sevenDayLow(weightKg, previousLowKg):
            return (
                localizedString("insight.sevenDayLow.title"),
                localizedString(
                    "insight.sevenDayLow.message",
                    unit.formattedWeight(weightKg),
                    unit.formattedAbsoluteDelta(previousLowKg - weightKg)
                ),
                localizedString("insight.tag.week")
            )
        case let .belowThirtyDayAverage(weightKg, averageKg):
            return (
                localizedString("insight.belowAverage.title"),
                localizedString(
                    "insight.belowAverage.message",
                    unit.formattedWeight(weightKg),
                    unit.formattedAbsoluteDelta(averageKg - weightKg)
                ),
                localizedString("insight.tag.signal")
            )
        case let .weeklyAverageDown(currentAverageKg, previousAverageKg):
            return (
                localizedString("insight.weeklyAverage.title"),
                localizedString(
                    "insight.weeklyAverage.message",
                    unit.formattedWeight(currentAverageKg),
                    unit.formattedAbsoluteDelta(previousAverageKg - currentAverageKg)
                ),
                localizedString("insight.tag.trend")
            )
        case let .loggingStreak(days):
            return (
                localizedString("insight.streak.title"),
                localizedString("insight.streak.message", days),
                localizedString("insight.tag.rhythm")
            )
        case .gettingStarted:
            return (
                localizedString("insight.gettingStarted.title"),
                localizedString("insight.gettingStarted.message"),
                localizedString("insight.tag.start")
            )
        }
    }
}
