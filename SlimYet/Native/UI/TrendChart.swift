import Charts
import SwiftUI

struct TrendSeries: Identifiable {
    let id: String
    let name: String
    let color: Color
    let points: [DeltaPoint]
}

struct NativeTrendChart: View {
    @Environment(NativeStore.self) private var store
    let series: [TrendSeries]
    var absolute = false
    @State private var range = ChartRange.month
    @State private var period = ChartPeriod.daily
    @State private var selectedDate: Date?
    @State private var focusedSeries: String?

    private var visible: [TrendSeries] {
        series.filter { focusedSeries == nil || $0.id == focusedSeries }.map { series in
            let points = ChartMath.filtered(ChartMath.lows(series.points, period: period), range: range)
            return TrendSeries(id: series.id, name: series.name, color: series.color,
                               points: (period == .weekly || period == .monthly) && points.count < 2 ? [] : points)
        }
    }
    private var values: [Double] { visible.flatMap(\.points).map { store.unit.displayValue(fromKilograms: $0.deltaKg) } }
    private var dateDomain: ClosedRange<Date> {
        let dates = visible.flatMap(\.points).map { Day.date($0.date) }
        let low = dates.min() ?? Date()
        let high = dates.max() ?? low
        if low == high { return low.addingTimeInterval(-43200)...high.addingTimeInterval(43200) }
        return low...high
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Picker(store.text("Date range", "时间范围"), selection: $range) {
                ForEach(ChartRange.allCases, id: \.self) { value in Text(rangeTitle(value)).tag(value) }
            }.pickerStyle(.segmented).accessibilityIdentifier("chart.range")
            if !absolute {
                Picker(store.text("Trend", "趋势"), selection: $period) {
                    Text(store.text("Daily", "每日")).tag(ChartPeriod.daily)
                    Text(store.text("Weekly low", "每周最低")).tag(ChartPeriod.weekly)
                    Text(store.text("Monthly low", "每月最低")).tag(ChartPeriod.monthly)
                }.pickerStyle(.segmented)
            }
            HStack {
                Text(absolute ? store.text("Weight", "体重") : store.text("Change from baseline", "相对基准变化"))
                Spacer()
                Text(store.unit.symbol).monospaced()
            }.font(.caption).foregroundStyle(.secondary)
            if values.isEmpty {
                ContentUnavailableView(store.text("No points in this range", "这个范围暂无数据"), systemImage: "chart.xyaxis.line", description: Text(period == .daily ? store.text("Your next check-in will appear here.", "新的记录将在这里显示。") : store.text("At least two calendar periods are needed.", "有两个自然周或自然月的数据后显示。")))
                    .frame(minHeight: 220)
            } else {
                chart.frame(height: 245).accessibilityIdentifier("trend.chart")
            }
            ForEach(visible) { item in
                if let point = selectedPoint(item) {
                    HStack {
                        Circle().fill(item.color).frame(width: 8, height: 8)
                        Text(item.name).font(.subheadline.weight(.semibold)).lineLimit(1)
                        Spacer(minLength: 4)
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(absolute ? store.weight(point.deltaKg) : store.delta(point.deltaKg)).font(.subheadline.bold()).monospacedDigit()
                            Text(Day.date(point.date), format: .dateTime.month(.abbreviated).day()).font(.caption2).foregroundStyle(.secondary)
                        }
                    }.accessibilityElement(children: .combine)
                }
            }
            if series.count > 1 {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 14) {
                        Button(store.text("All", "全部")) { focusedSeries = nil }.font(.caption.bold())
                        ForEach(series) { item in
                            Button { focusedSeries = focusedSeries == item.id ? nil : item.id } label: {
                                HStack(spacing: 4) {
                                    Circle().fill(item.color).frame(width: 7, height: 7)
                                    Text(item.name).lineLimit(1)
                                }.font(.caption).foregroundStyle(focusedSeries == nil || focusedSeries == item.id ? .primary : .secondary)
                            }
                        }
                    }.padding(.vertical, 5)
                }
            }
        }
        .onChange(of: range) { _, _ in selectedDate = nil }
        .onChange(of: period) { _, _ in selectedDate = nil }
    }

    private var chart: some View {
        Chart {
            if !absolute {
                RuleMark(y: .value("Baseline", 0)).foregroundStyle(.secondary.opacity(0.4)).lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
            }
            ForEach(visible) { item in
                ForEach(item.points) { point in
                    LineMark(x: .value("Date", Day.date(point.date)), y: .value("Weight", store.unit.displayValue(fromKilograms: point.deltaKg)), series: .value("Member", item.id))
                        .foregroundStyle(item.color).lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round)).interpolationMethod(.linear)
                        .accessibilityLabel(item.name).accessibilityValue("\(point.date), \(store.weight(point.deltaKg))")
                    if point.id == item.points.last?.id || point.id == best(item)?.id || item.points.count <= 8 {
                        PointMark(x: .value("Date", Day.date(point.date)), y: .value("Weight", store.unit.displayValue(fromKilograms: point.deltaKg)))
                            .foregroundStyle(item.color).symbolSize(point.id == best(item)?.id ? 45 : 22)
                            .annotation(position: .top, spacing: 5) {
                                if point.id == best(item)?.id {
                                    HStack(spacing: 3) {
                                        Image(systemName: "trophy.fill").foregroundStyle(.orange)
                                        Text(String(format: "%.1f", store.unit.displayValue(fromKilograms: point.deltaKg))).foregroundStyle(item.color)
                                    }.font(.system(size: 10, weight: .bold)).padding(3).background(.background.opacity(0.9), in: RoundedRectangle(cornerRadius: 4))
                                }
                            }
                    }
                }
            }
            if let selectedDate {
                RuleMark(x: .value("Selected", selectedDate)).foregroundStyle(.secondary.opacity(0.4))
            }
        }
        .chartYScale(domain: ChartMath.domain(values, includeZero: !absolute))
        .chartXScale(domain: dateDomain)
        .chartXAxis { AxisMarks(values: .automatic(desiredCount: 3)) { _ in AxisValueLabel(format: .dateTime.month(.abbreviated).day()) } }
        .chartYAxis {
            AxisMarks(position: .leading, values: .automatic(desiredCount: 4)) { value in
                AxisGridLine().foregroundStyle(.secondary.opacity(0.12))
                AxisValueLabel { if let number = value.as(Double.self) { Text(number, format: .number.precision(.fractionLength(1))).font(.caption2) } }
            }
            AxisMarks(position: .trailing, values: .automatic(desiredCount: 4)) { value in
                AxisValueLabel { if let number = value.as(Double.self) { Text(number, format: .number.precision(.fractionLength(1))).font(.caption2) } }
            }
        }
        .chartXSelection(value: $selectedDate)
    }

    private func best(_ item: TrendSeries) -> DeltaPoint? {
        series.first(where: { $0.id == item.id })?.points.min { $0.deltaKg < $1.deltaKg }
    }
    private func selectedPoint(_ item: TrendSeries) -> DeltaPoint? {
        guard let selectedDate else { return item.points.last }
        return item.points.min { abs(Day.date($0.date).timeIntervalSince(selectedDate)) < abs(Day.date($1.date).timeIntervalSince(selectedDate)) }
    }
    private func rangeTitle(_ value: ChartRange) -> String {
        switch value {
        case .week: store.text("1W", "1周")
        case .month: store.text("1M", "1月")
        case .year: store.text("1Y", "1年")
        case .all: store.text("All", "全部")
        }
    }
}

struct BestDeltaChart: View {
    @Environment(NativeStore.self) private var store
    let members: [CloudMember]
    var body: some View {
        let ranked = members.filter { $0.historicalBestDeltaKg != nil }.sorted { ($0.historicalBestDeltaKg ?? 0) < ($1.historicalBestDeltaKg ?? 0) }
        Chart(ranked) { member in
            BarMark(x: .value("Best loss", store.unit.displayValue(fromKilograms: max(0, -(member.historicalBestDeltaKg ?? 0)))), y: .value("Member", member.displayName))
                .foregroundStyle(NativePalette.teal.gradient).cornerRadius(3)
                .annotation(position: .trailing) { Text(store.delta(min(0, member.historicalBestDeltaKg ?? 0))).font(.caption.bold()) }
        }
        .chartXScale(domain: 0...max(1, store.unit.displayValue(fromKilograms: ranked.map { max(0, -($0.historicalBestDeltaKg ?? 0)) }.max() ?? 1) * 1.45))
        .chartXAxis(.hidden)
        .chartYAxis { AxisMarks { _ in AxisValueLabel() } }
        .frame(height: CGFloat(max(1, ranked.count)) * 42 + 16)
        .accessibilityLabel(store.text("All-time largest decrease", "历史最大下降"))
    }
}
