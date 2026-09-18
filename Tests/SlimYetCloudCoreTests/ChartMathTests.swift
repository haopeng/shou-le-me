import Foundation
import Testing
@testable import SlimYetCloudCore

@Test func convertsPoundsExactlyOnce() {
    #expect(ChartMath.validKilograms("220.46", pounds: true) == 100)
    #expect(ChartMath.validKilograms("89,6", pounds: false) == 89.6)
    #expect(ChartMath.validKilograms(" 92.6 ", pounds: false) == 92.6)
}

@Test(arguments: ["", "nan", "inf", "-20", "19.9", "400.1", "89kg", "1,000.0"])
func rejectsInvalidWeights(input: String) {
    #expect(ChartMath.validKilograms(input, pounds: false) == nil)
}

@Test func weeklyBucketsRespectISOYearBoundary() {
    let points = [DeltaPoint(date: "2025-12-29", deltaKg: 0), .init(date: "2026-01-04", deltaKg: -0.3), .init(date: "2026-01-05", deltaKg: 0)]
    #expect(ChartMath.lows(points, period: .weekly).map(\.deltaKg) == [-0.3, 0])
}

@Test func monthlyLowsStayInChronologicalOrder() {
    let points = [DeltaPoint(date: "2026-02-10", deltaKg: 0), .init(date: "2026-01-02", deltaKg: -2), .init(date: "2026-01-01", deltaKg: -1)]
    #expect(ChartMath.lows(points, period: .monthly).map(\.deltaKg) == [-2, 0])
}

@Test func flatOrSinglePointHasVisibleDomain() {
    let domain = ChartMath.domain([0], includeZero: true)
    #expect(domain.lowerBound < 0)
    #expect(domain.upperBound > 0)
    #expect(ChartMath.domain([92.6], includeZero: false).contains(92.6))
}

@Test func lossAndReboundAreNotRebased() {
    let points = [DeltaPoint(date: "2026-06-23", deltaKg: 0), .init(date: "2026-06-24", deltaKg: -0.3), .init(date: "2026-06-25", deltaKg: 0)]
    #expect(ChartMath.filtered(points, range: .all).map(\.deltaKg) == [0, -0.3, 0])
}

@Test func lastSevenDaysIncludesTodayAndSixPreviousDays() {
    let points = (1...10).map { DeltaPoint(date: String(format: "2026-06-%02d", $0), deltaKg: 0) }
    let result = ChartMath.filtered(points, range: .week, now: Day.date("2026-06-08"))
    #expect(result.map(\.date) == (2...8).map { String(format: "2026-06-%02d", $0) })
}

@Test func onlyStrictNewRecordsCelebrate() {
    let logs = [CloudLog(id: "a", recordedOn: "2026-06-01", weightKg: 90), CloudLog(id: "b", recordedOn: "2026-06-02", weightKg: 89)]
    #expect(ChartMath.recordBroken(weightKg: 89, date: "2026-06-03", logs: logs) == nil)
    #expect(ChartMath.recordBroken(weightKg: 88.9, date: "2026-06-03", logs: logs) == .allTime)
    #expect(ChartMath.recordBroken(weightKg: 80, date: "2026-05-01", logs: logs) == nil)
}

@Test func sameDayReplacementDoesNotCountItselfAsEarlierHistory() {
    let logs = [CloudLog(id: "a", recordedOn: "2026-06-01", weightKg: 90)]
    #expect(ChartMath.recordBroken(weightKg: 89, date: "2026-06-01", logs: logs) == nil)
}

@Test func dayRoundTripUsesCalendarDateNotUTCInstant() {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(secondsFromGMT: -7 * 3600)!
    #expect(Day.string(Day.date("2026-09-17", calendar: calendar), calendar: calendar) == "2026-09-17")
}

@Test func groupDTOIgnoresAbsoluteWeightFields() throws {
    let json = #"{"memberId":"m","userId":"u","displayName":"Friend","role":"member","joinedAt":"2026-01-01","daysLogged":1,"badges":[],"highlights":[],"sparkline":[{"date":"2026-01-01","deltaKg":0}],"trendline":[{"date":"2026-01-01","deltaKg":0}],"isMe":false,"weightKg":88,"baseWeightKg":88}"#
    let member = try JSONDecoder().decode(CloudMember.self, from: Data(json.utf8))
    let encoded = String(decoding: try JSONEncoder().encode(member), as: UTF8.self)
    #expect(!encoded.contains("weightKg"))
    #expect(!encoded.contains("baseWeightKg"))
}
