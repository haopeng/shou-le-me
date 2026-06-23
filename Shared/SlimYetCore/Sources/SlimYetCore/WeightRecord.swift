import Foundation

public struct WeightRecord: Identifiable, Equatable, Sendable {
    public let id: UUID
    public let date: Date
    public let weightKg: Double
    public let note: String

    public init(id: UUID = UUID(), date: Date, weightKg: Double, note: String = "") {
        self.id = id
        self.date = date
        self.weightKg = weightKg
        self.note = note
    }
}

public enum InsightTone: Equatable, Sendable {
    case bright
    case steady
    case quiet
}

public enum TrendInsightKind: Equatable, Sendable {
    case personalLow(weightKg: Double, previousLowKg: Double)
    case sevenDayLow(weightKg: Double, previousLowKg: Double)
    case belowThirtyDayAverage(weightKg: Double, averageKg: Double)
    case weeklyAverageDown(currentAverageKg: Double, previousAverageKg: Double)
    case loggingStreak(days: Int)
    case gettingStarted
}

public struct TrendInsight: Identifiable, Equatable, Sendable {
    public let id: String
    public let kind: TrendInsightKind
    public let tone: InsightTone
    public let priority: Int

    public init(id: String, kind: TrendInsightKind, tone: InsightTone, priority: Int) {
        self.id = id
        self.kind = kind
        self.tone = tone
        self.priority = priority
    }
}

public enum ScoreMetricKind: Equatable, Sendable {
    case latestWeight
    case sevenDayMomentum
    case thirtyDayLow
    case consistency
}

public enum ScoreValue: Equatable, Sendable {
    case weightKg(Double)
    case deltaKg(Double)
    case ratio(logged: Int, total: Int)
}

public struct ScoreMetric: Identifiable, Equatable, Sendable {
    public let id: String
    public let kind: ScoreMetricKind
    public let value: ScoreValue
    public let tone: InsightTone
    public let progress: Double

    public init(
        id: String,
        kind: ScoreMetricKind,
        value: ScoreValue,
        tone: InsightTone,
        progress: Double
    ) {
        self.id = id
        self.kind = kind
        self.value = value
        self.tone = tone
        self.progress = progress
    }
}
