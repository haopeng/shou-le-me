import SwiftUI

struct ScoreGrid: View {
    let metrics: [ScoreMetric]
    let unit: WeightUnit

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("scores.title", systemImage: "rectangle.grid.2x2.fill")
                .font(.headline)
                .foregroundStyle(AppTheme.ink)

            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(metrics) { metric in
                    ScoreCardView(metric: metric, unit: unit)
                }
            }
        }
    }
}

struct ScoreCardView: View {
    let metric: ScoreMetric
    let unit: WeightUnit

    private var accent: Color {
        AppTheme.color(for: metric.tone)
    }

    var body: some View {
        let content = displayContent

        VStack(alignment: .leading, spacing: 13) {
            HStack {
                ProgressBadge(progress: metric.progress, icon: content.icon, color: accent)

                Spacer()

                Text(content.encouragement)
                    .font(.caption2.weight(.heavy))
                    .textCase(.uppercase)
                    .foregroundStyle(accent)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 5)
                    .background(accent.opacity(0.10))
                    .clipShape(Capsule())
            }

            Text(content.value)
                .font(.system(size: 29, weight: .black, design: .rounded))
                .foregroundStyle(AppTheme.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            VStack(alignment: .leading, spacing: 3) {
                Text(content.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(AppTheme.ink)
                Text(content.caption)
                    .font(.caption)
                    .foregroundStyle(AppTheme.muted)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 138, alignment: .topLeading)
        .padding(14)
        .background {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(AppTheme.surface.opacity(0.96))
                .overlay(alignment: .bottomTrailing) {
                    Capsule()
                        .fill(accent.opacity(0.12))
                        .frame(width: 74, height: 10)
                        .rotationEffect(.degrees(-18))
                        .offset(x: 18, y: -10)
                }
        }
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(accent.opacity(0.12), lineWidth: 1)
        }
        .shadow(color: AppTheme.shadow(accent, opacity: 0.10), radius: 12, x: 0, y: 7)
    }

    private var displayContent: (title: String, value: String, caption: String, icon: String, encouragement: String) {
        switch metric.kind {
        case .latestWeight:
            return (
                localizedString("score.latest.title"),
                valueText,
                localizedString("score.latest.caption"),
                "scalemass.fill",
                localizedString("score.latest.tag")
            )
        case .sevenDayMomentum:
            return (
                localizedString("score.momentum.title"),
                valueText,
                localizedString("score.momentum.caption"),
                "bolt.heart.fill",
                localizedString("score.momentum.tag")
            )
        case .thirtyDayLow:
            return (
                localizedString("score.low.title"),
                valueText,
                localizedString("score.low.caption"),
                "flag.checkered.circle.fill",
                localizedString("score.low.tag")
            )
        case .consistency:
            return (
                localizedString("score.consistency.title"),
                valueText,
                localizedString("score.consistency.caption"),
                "calendar.badge.checkmark",
                localizedString("score.consistency.tag")
            )
        }
    }

    private var valueText: String {
        switch metric.value {
        case let .weightKg(weightKg):
            unit.formattedWeight(weightKg)
        case let .deltaKg(deltaKg):
            unit.formattedDelta(deltaKg)
        case let .ratio(logged, total):
            "\(logged)/\(total)"
        }
    }
}

private struct ProgressBadge: View {
    let progress: Double
    let icon: String
    let color: Color

    private var clampedProgress: Double {
        min(1, max(0.04, progress))
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(color.opacity(0.12), lineWidth: 5)

            Circle()
                .trim(from: 0, to: clampedProgress)
                .stroke(
                    color,
                    style: StrokeStyle(lineWidth: 5, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))

            Image(systemName: icon)
                .font(.caption.weight(.heavy))
                .foregroundStyle(color)
        }
        .frame(width: 40, height: 40)
        .accessibilityHidden(true)
    }
}
