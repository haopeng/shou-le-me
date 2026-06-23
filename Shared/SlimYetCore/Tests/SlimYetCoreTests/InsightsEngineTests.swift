import Foundation
import Testing
@testable import SlimYetCore

@Suite("InsightsEngine")
struct InsightsEngineTests {
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }

    @Test("detects a seven day low and thirty day average win")
    func detectsLowAndAverageWin() throws {
        let base = try #require(calendar.date(from: DateComponents(year: 2026, month: 6, day: 19)))
        let records = (1...30).map { day in
            record(base: base, daysAgo: 31 - day, weight: 80 - Double(day % 4) * 0.1)
        } + [
            record(base: base, daysAgo: 6, weight: 79.2),
            record(base: base, daysAgo: 5, weight: 79.0),
            record(base: base, daysAgo: 4, weight: 78.9),
            record(base: base, daysAgo: 3, weight: 79.1),
            record(base: base, daysAgo: 2, weight: 78.8),
            record(base: base, daysAgo: 1, weight: 78.7),
            record(base: base, daysAgo: 0, weight: 78.1)
        ]

        let insights = InsightsEngine().makeInsights(from: records, calendar: calendar)

        #expect(insights.contains { insight in
            if case .sevenDayLow = insight.kind { true } else { false }
        })
        #expect(insights.contains { insight in
            if case .belowThirtyDayAverage = insight.kind { true } else { false }
        })
    }

    @Test("deduplicates same-day records with the latest entry")
    func usesLatestSameDayRecord() throws {
        let base = try #require(calendar.date(from: DateComponents(year: 2026, month: 6, day: 19)))
        let morning = try #require(calendar.date(bySettingHour: 8, minute: 0, second: 0, of: base))
        let evening = try #require(calendar.date(bySettingHour: 20, minute: 0, second: 0, of: base))
        let records = [
            WeightRecord(date: calendar.date(byAdding: .day, value: -1, to: base)!, weightKg: 72.0),
            WeightRecord(date: morning, weightKg: 71.8),
            WeightRecord(date: evening, weightKg: 71.3)
        ]

        let chartRecords = InsightsEngine().chartRecords(from: records, calendar: calendar)

        #expect(chartRecords.count == 2)
        #expect(chartRecords.last?.weightKg == 71.3)
    }

    @Test("computes a logging streak")
    func computesLoggingStreak() throws {
        let base = try #require(calendar.date(from: DateComponents(year: 2026, month: 6, day: 19)))
        let records = [
            record(base: base, daysAgo: 3, weight: 72.4),
            record(base: base, daysAgo: 2, weight: 72.2),
            record(base: base, daysAgo: 1, weight: 72.1),
            record(base: base, daysAgo: 0, weight: 71.9)
        ]

        let insights = InsightsEngine().makeInsights(from: records, calendar: calendar)

        #expect(insights.contains { insight in
            if case .loggingStreak(days: 4) = insight.kind { true } else { false }
        })
    }

    private func record(base: Date, daysAgo: Int, weight: Double) -> WeightRecord {
        let date = calendar.date(byAdding: .day, value: -daysAgo, to: base)!
        return WeightRecord(date: date, weightKg: weight)
    }
}
