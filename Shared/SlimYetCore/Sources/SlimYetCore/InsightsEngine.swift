import Foundation

public struct InsightsEngine: Sendable {
    public init() {}

    public func makeInsights(
        from records: [WeightRecord],
        calendar: Calendar = .current
    ) -> [TrendInsight] {
        let dailyRecords = latestRecordPerDay(records, calendar: calendar)

        guard let latest = dailyRecords.last else {
            return [
                TrendInsight(
                    id: "getting-started",
                    kind: .gettingStarted,
                    tone: .quiet,
                    priority: 100
                )
            ]
        }

        let anchorDay = calendar.startOfDay(for: latest.date)
        var insights: [TrendInsight] = []

        let previousRecords = Array(dailyRecords.dropLast())
        if let previousLow = previousRecords.map(\.weightKg).min(), latest.weightKg < previousLow {
            insights.append(
                TrendInsight(
                    id: "personal-low",
                    kind: .personalLow(weightKg: latest.weightKg, previousLowKg: previousLow),
                    tone: .bright,
                    priority: 5
                )
            )
        }

        let lastSeven = recordsInLast(days: 7, endingAt: anchorDay, records: dailyRecords, calendar: calendar)
        let earlierSeven = lastSeven.filter { !calendar.isDate($0.date, inSameDayAs: latest.date) }
        if let previousSevenDayLow = earlierSeven.map(\.weightKg).min(), latest.weightKg <= previousSevenDayLow {
            insights.append(
                TrendInsight(
                    id: "seven-day-low",
                    kind: .sevenDayLow(weightKg: latest.weightKg, previousLowKg: previousSevenDayLow),
                    tone: .bright,
                    priority: 10
                )
            )
        }

        let priorThirty = recordsInPrevious(days: 30, before: anchorDay, records: dailyRecords, calendar: calendar)
        if priorThirty.count >= 5, let average = averageWeight(priorThirty), latest.weightKg < average {
            insights.append(
                TrendInsight(
                    id: "below-thirty-day-average",
                    kind: .belowThirtyDayAverage(weightKg: latest.weightKg, averageKg: average),
                    tone: .bright,
                    priority: 20
                )
            )
        }

        let previousSeven = recordsInPrevious(days: 7, before: startOfCurrentWindow(days: 7, endingAt: anchorDay, calendar: calendar), records: dailyRecords, calendar: calendar)
        if lastSeven.count >= 3,
           previousSeven.count >= 3,
           let currentAverage = averageWeight(lastSeven),
           let previousAverage = averageWeight(previousSeven),
           currentAverage < previousAverage {
            insights.append(
                TrendInsight(
                    id: "weekly-average-down",
                    kind: .weeklyAverageDown(currentAverageKg: currentAverage, previousAverageKg: previousAverage),
                    tone: .steady,
                    priority: 30
                )
            )
        }

        let streak = loggingStreak(endingAt: anchorDay, records: dailyRecords, calendar: calendar)
        if streak >= 3 {
            insights.append(
                TrendInsight(
                    id: "logging-streak",
                    kind: .loggingStreak(days: streak),
                    tone: .steady,
                    priority: 40
                )
            )
        }

        if insights.isEmpty {
            insights.append(
                TrendInsight(
                    id: "getting-started",
                    kind: .gettingStarted,
                    tone: .quiet,
                    priority: 100
                )
            )
        }

        return insights.sorted { $0.priority < $1.priority }.prefix(5).map { $0 }
    }

    public func makeScoreMetrics(
        from records: [WeightRecord],
        calendar: Calendar = .current
    ) -> [ScoreMetric] {
        let dailyRecords = latestRecordPerDay(records, calendar: calendar)
        guard let latest = dailyRecords.last else { return [] }

        let anchorDay = calendar.startOfDay(for: latest.date)
        let lastSeven = recordsInLast(days: 7, endingAt: anchorDay, records: dailyRecords, calendar: calendar)
        let previousSeven = recordsInPrevious(days: 7, before: startOfCurrentWindow(days: 7, endingAt: anchorDay, calendar: calendar), records: dailyRecords, calendar: calendar)
        let lastThirty = recordsInLast(days: 30, endingAt: anchorDay, records: dailyRecords, calendar: calendar)
        let lastFourteen = recordsInLast(days: 14, endingAt: anchorDay, records: dailyRecords, calendar: calendar)

        var metrics: [ScoreMetric] = [
            ScoreMetric(
                id: "latest-weight",
                kind: .latestWeight,
                value: .weightKg(latest.weightKg),
                tone: .quiet,
                progress: 1
            )
        ]

        if let currentAverage = averageWeight(lastSeven) {
            let comparisonAverage = averageWeight(previousSeven) ?? dailyRecords.first?.weightKg ?? currentAverage
            let delta = currentAverage - comparisonAverage
            metrics.append(
                ScoreMetric(
                    id: "seven-day-momentum",
                    kind: .sevenDayMomentum,
                    value: .deltaKg(delta),
                    tone: delta < 0 ? .bright : .steady,
                    progress: normalizedMomentum(deltaKg: delta)
                )
            )
        }

        if let low = lastThirty.map(\.weightKg).min() {
            metrics.append(
                ScoreMetric(
                    id: "thirty-day-low",
                    kind: .thirtyDayLow,
                    value: .weightKg(low),
                    tone: .bright,
                    progress: 1
                )
            )
        }

        let loggedDays = lastFourteen.count
        metrics.append(
            ScoreMetric(
                id: "consistency",
                kind: .consistency,
                value: .ratio(logged: loggedDays, total: 14),
                tone: loggedDays >= 10 ? .bright : .steady,
                progress: min(1, Double(loggedDays) / 14)
            )
        )

        return metrics
    }

    public func chartRecords(from records: [WeightRecord], limit: Int = 90, calendar: Calendar = .current) -> [WeightRecord] {
        let dailyRecords = latestRecordPerDay(records, calendar: calendar)
        guard dailyRecords.count > limit else { return dailyRecords }
        return Array(dailyRecords.suffix(limit))
    }

    private func latestRecordPerDay(_ records: [WeightRecord], calendar: Calendar) -> [WeightRecord] {
        var latestByDay: [Date: WeightRecord] = [:]

        for record in records {
            let day = calendar.startOfDay(for: record.date)
            if let existing = latestByDay[day] {
                if record.date > existing.date {
                    latestByDay[day] = record
                }
            } else {
                latestByDay[day] = record
            }
        }

        return latestByDay.values.sorted { $0.date < $1.date }
    }

    private func recordsInLast(
        days: Int,
        endingAt endDay: Date,
        records: [WeightRecord],
        calendar: Calendar
    ) -> [WeightRecord] {
        let startDay = calendar.date(byAdding: .day, value: -(days - 1), to: endDay) ?? endDay
        return records.filter {
            let day = calendar.startOfDay(for: $0.date)
            return day >= startDay && day <= endDay
        }
    }

    private func recordsInPrevious(
        days: Int,
        before day: Date,
        records: [WeightRecord],
        calendar: Calendar
    ) -> [WeightRecord] {
        let endDay = calendar.date(byAdding: .day, value: -1, to: day) ?? day
        let startDay = calendar.date(byAdding: .day, value: -(days - 1), to: endDay) ?? endDay
        return records.filter {
            let recordDay = calendar.startOfDay(for: $0.date)
            return recordDay >= startDay && recordDay <= endDay
        }
    }

    private func startOfCurrentWindow(days: Int, endingAt endDay: Date, calendar: Calendar) -> Date {
        calendar.date(byAdding: .day, value: -(days - 1), to: endDay) ?? endDay
    }

    private func averageWeight(_ records: [WeightRecord]) -> Double? {
        guard !records.isEmpty else { return nil }
        let total = records.reduce(0) { $0 + $1.weightKg }
        return total / Double(records.count)
    }

    private func loggingStreak(endingAt anchorDay: Date, records: [WeightRecord], calendar: Calendar) -> Int {
        let daysWithRecords = Set(records.map { calendar.startOfDay(for: $0.date) })
        var streak = 0
        var cursor = anchorDay

        while daysWithRecords.contains(cursor) {
            streak += 1
            guard let previous = calendar.date(byAdding: .day, value: -1, to: cursor) else { break }
            cursor = previous
        }

        return streak
    }

    private func normalizedMomentum(deltaKg: Double) -> Double {
        let centered = 0.55 - (deltaKg / 4)
        return min(1, max(0.05, centered))
    }
}
