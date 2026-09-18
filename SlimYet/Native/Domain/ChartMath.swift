import Foundation

enum Day {
    static var calendar: Calendar {
        var value = Calendar(identifier: .gregorian)
        value.timeZone = .current
        return value
    }

    static func string(_ date: Date, calendar: Calendar = Day.calendar) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!)
    }

    static func date(_ string: String, calendar: Calendar = Day.calendar) -> Date {
        let parts = string.prefix(10).split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return .distantPast }
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12)) ?? .distantPast
    }
}

enum ChartPeriod: String, CaseIterable { case daily, weekly, monthly, best }
enum ChartRange: Int, CaseIterable { case week = 7, month = 30, year = 365, all = 0 }

enum ChartMath {
    static func filtered(_ points: [DeltaPoint], range: ChartRange, now: Date = Date(), calendar: Calendar = Day.calendar) -> [DeltaPoint] {
        let ordered = points.sorted { $0.date < $1.date }
        guard range != .all, let start = calendar.date(byAdding: .day, value: -(range.rawValue - 1), to: calendar.startOfDay(for: now)) else { return ordered }
        let first = Day.string(start, calendar: calendar)
        let last = Day.string(now, calendar: calendar)
        return ordered.filter { $0.date >= first && $0.date <= last }
    }

    static func lows(_ points: [DeltaPoint], period: ChartPeriod) -> [DeltaPoint] {
        guard period == .weekly || period == .monthly else { return points.sorted { $0.date < $1.date } }
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = .current
        let buckets = Dictionary(grouping: points) { point in
            let date = Day.date(point.date, calendar: calendar)
            let start = calendar.dateInterval(of: period == .weekly ? .weekOfYear : .month, for: date)!.start
            return Day.string(start, calendar: calendar)
        }
        return buckets.keys.sorted().compactMap { key in
            buckets[key]?.min { a, b in a.deltaKg == b.deltaKg ? a.date < b.date : a.deltaKg < b.deltaKg }
        }
    }

    static func domain(_ values: [Double], includeZero: Bool) -> ClosedRange<Double> {
        let all = values.filter(\.isFinite) + (includeZero ? [0] : [])
        let low = all.min() ?? 0
        let high = all.max() ?? 0
        let padding = max((high - low) * 0.16, 0.15)
        return (low - padding)...(high + padding)
    }

    static func validKilograms(_ input: String, pounds: Bool) -> Double? {
        let normalized = input.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: ".")
        guard let value = Double(normalized), value.isFinite else { return nil }
        let kg = pounds ? value / 2.2046226218 : value
        guard (20...400).contains(kg) else { return nil }
        return (kg * 10).rounded() / 10
    }

    static func recordBroken(weightKg: Double, date: String, logs: [CloudLog]) -> RecordMilestone? {
        let earlier = logs.filter { $0.recordedOn < date }
        guard !earlier.isEmpty else { return nil }
        if earlier.allSatisfy({ weightKg < $0.weightKg - 0.049 }) { return .allTime }
        let calendar = Calendar(identifier: .iso8601)
        let current = Day.date(date, calendar: calendar)
        for (component, milestone) in [(Calendar.Component.year, RecordMilestone.year), (.month, .month), (.weekOfYear, .week)] {
            guard let interval = calendar.dateInterval(of: component, for: current) else { continue }
            let start = Day.string(interval.start, calendar: calendar)
            let previous = earlier.filter { $0.recordedOn >= start }
            if !previous.isEmpty && previous.allSatisfy({ weightKg < $0.weightKg - 0.049 }) { return milestone }
        }
        return nil
    }
}

enum RecordMilestone: String, Sendable { case allTime, year, month, week }
