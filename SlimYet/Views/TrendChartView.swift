import SwiftUI

struct TrendChartView: View {
    let records: [WeightRecord]
    let unit: WeightUnit

    private var trendBadgeText: String {
        guard let first = records.first, let last = records.last, records.count >= 2 else {
            return localizedString("chart.badge.ready")
        }

        let delta = last.weightKg - first.weightKg
        if abs(delta) < 0.1 {
            return localizedString("chart.badge.steady")
        }

        if delta < 0 {
            return localizedString("chart.badge.down", unit.formattedAbsoluteDelta(delta))
        }

        return localizedString("chart.badge.up", unit.formattedAbsoluteDelta(delta))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Label("chart.title", systemImage: "chart.xyaxis.line")
                        .font(.headline)
                        .foregroundStyle(AppTheme.ink)
                    Text("chart.subtitle")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(AppTheme.muted)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    Text(trendBadgeText)
                        .font(.caption.weight(.heavy))
                        .foregroundStyle(AppTheme.teal)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    Text(localizedString("chart.count", records.count))
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(AppTheme.muted)
                }
            }

            if records.count < 2 {
                Text("chart.needsMore")
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.muted)
                    .frame(maxWidth: .infinity, minHeight: 160, alignment: .center)
            } else {
                TrendCanvas(records: records, unit: unit)
                    .frame(height: 232)
                    .accessibilityLabel(Text("chart.accessibility"))
            }
        }
        .padding(16)
        .background {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(AppTheme.surface.opacity(0.96))
                .overlay(alignment: .topTrailing) {
                    VStack(spacing: 7) {
                        Capsule()
                            .fill(AppTheme.lemon.opacity(0.28))
                            .frame(width: 88, height: 8)
                        Capsule()
                            .fill(AppTheme.sky.opacity(0.16))
                            .frame(width: 58, height: 8)
                    }
                    .rotationEffect(.degrees(-12))
                    .offset(x: 8, y: 16)
                }
        }
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(AppTheme.sky.opacity(0.14), lineWidth: 1)
        }
        .shadow(color: AppTheme.shadow(AppTheme.sky, opacity: 0.09), radius: 18, x: 0, y: 9)
    }
}

private struct TrendCanvas: View {
    let records: [WeightRecord]
    let unit: WeightUnit

    var body: some View {
        Canvas { context, size in
            let values = records.map { unit.displayValue(fromKilograms: $0.weightKg) }
            guard let minValue = values.min(), let maxValue = values.max() else { return }

            let range = max(maxValue - minValue, 0.8)
            let paddedMin = minValue - range * 0.16
            let paddedMax = maxValue + range * 0.16
            let plot = CGRect(x: 8, y: 18, width: size.width - 16, height: size.height - 36)
            let average = values.reduce(0, +) / Double(values.count)

            func point(at index: Int, value: Double) -> CGPoint {
                let xRatio = records.count == 1 ? 0 : Double(index) / Double(records.count - 1)
                let yRatio = (value - paddedMin) / (paddedMax - paddedMin)
                return CGPoint(
                    x: plot.minX + plot.width * xRatio,
                    y: plot.maxY - plot.height * yRatio
                )
            }

            for step in 0...3 {
                let y = plot.minY + plot.height * Double(step) / 3
                var grid = Path()
                grid.move(to: CGPoint(x: plot.minX, y: y))
                grid.addLine(to: CGPoint(x: plot.maxX, y: y))
                context.stroke(grid, with: .color(AppTheme.ink.opacity(0.08)), lineWidth: 1)
            }

            let averageY = point(at: 0, value: average).y
            var averagePath = Path()
            averagePath.move(to: CGPoint(x: plot.minX, y: averageY))
            averagePath.addLine(to: CGPoint(x: plot.maxX, y: averageY))
            context.stroke(
                averagePath,
                with: .color(AppTheme.lemon.opacity(0.7)),
                style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [5, 6])
            )

            for (index, value) in values.enumerated() {
                let markerPoint = point(at: index, value: value)
                var tick = Path()
                tick.move(to: CGPoint(x: markerPoint.x, y: markerPoint.y + 10))
                tick.addLine(to: CGPoint(x: markerPoint.x, y: plot.maxY))
                context.stroke(
                    tick,
                    with: .color(AppTheme.sky.opacity(index == values.count - 1 ? 0.22 : 0.10)),
                    style: StrokeStyle(lineWidth: 2, lineCap: .round)
                )
            }

            var ribbon = Path()
            for (index, value) in values.enumerated() {
                let point = point(at: index, value: value)
                if index == 0 {
                    ribbon.move(to: point)
                } else {
                    ribbon.addLine(to: point)
                }
            }
            ribbon.addLine(to: CGPoint(x: plot.maxX, y: plot.maxY))
            ribbon.addLine(to: CGPoint(x: plot.minX, y: plot.maxY))
            ribbon.closeSubpath()
            context.fill(ribbon, with: .linearGradient(
                Gradient(colors: [AppTheme.teal.opacity(0.20), AppTheme.indigo.opacity(0.04)]),
                startPoint: CGPoint(x: plot.midX, y: plot.minY),
                endPoint: CGPoint(x: plot.midX, y: plot.maxY)
            ))

            var line = Path()
            for (index, value) in values.enumerated() {
                let point = point(at: index, value: value)
                if index == 0 {
                    line.move(to: point)
                } else {
                    line.addLine(to: point)
                }
            }
            context.stroke(
                line,
                with: .color(AppTheme.teal),
                style: StrokeStyle(lineWidth: 3.5, lineCap: .round, lineJoin: .round)
            )

            if let lowValue = values.min(), let lowIndex = values.firstIndex(of: lowValue) {
                drawDot(
                    at: point(at: lowIndex, value: lowValue),
                    radius: 6,
                    color: AppTheme.coral,
                    context: &context
                )
            }

            if let latest = values.last {
                drawDot(
                    at: point(at: values.count - 1, value: latest),
                    radius: 7,
                    color: AppTheme.indigo,
                    context: &context
                )

                let latestPoint = point(at: values.count - 1, value: latest)
                context.draw(
                    Text(unit.formattedWeight(records.last?.weightKg ?? 0))
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(AppTheme.indigo),
                    at: CGPoint(x: min(plot.maxX - 2, latestPoint.x), y: max(plot.minY + 2, latestPoint.y - 14)),
                    anchor: .bottomTrailing
                )
            }
        }
    }

    private func drawDot(at point: CGPoint, radius: CGFloat, color: Color, context: inout GraphicsContext) {
        let outer = CGRect(
            x: point.x - radius - 3,
            y: point.y - radius - 3,
            width: radius * 2 + 6,
            height: radius * 2 + 6
        )
        let inner = CGRect(
            x: point.x - radius,
            y: point.y - radius,
            width: radius * 2,
            height: radius * 2
        )
        context.fill(Path(ellipseIn: outer), with: .color(color.opacity(0.15)))
        context.fill(Path(ellipseIn: inner), with: .color(color))
    }
}
