import Foundation

@main
enum NativeCoreSmoke {
    static func main() throws {
        var checks = 0
        func check(_ condition: @autoclosure () -> Bool, _ message: String) {
            precondition(condition(), message)
            checks += 1
        }
        check(ChartMath.validKilograms("220.46", pounds: true) == 100, "lb conversion")
        check(ChartMath.validKilograms("89,6", pounds: false) == 89.6, "decimal comma")
        for invalid in ["", "nan", "inf", "-20", "19.9", "400.1", "89kg", "1,000.0"] {
            check(ChartMath.validKilograms(invalid, pounds: false) == nil, "invalid input: \(invalid)")
        }
        let points = [DeltaPoint(date: "2025-12-29", deltaKg: 0), .init(date: "2026-01-04", deltaKg: -0.3), .init(date: "2026-01-05", deltaKg: 0)]
        check(ChartMath.lows(points, period: .weekly).map(\.deltaKg) == [-0.3, 0], "ISO weeks")
        check(ChartMath.lows(points, period: .monthly).map(\.deltaKg) == [0, -0.3], "calendar months")
        check(ChartMath.filtered(points, range: .all).map(\.deltaKg) == [0, -0.3, 0], "rebound")
        check(ChartMath.domain([0], includeZero: true).lowerBound < 0, "single point domain")
        check(ChartMath.domain([0], includeZero: true).upperBound > 0, "single point domain")
        let logs = [CloudLog(id: "a", recordedOn: "2026-06-01", weightKg: 90), CloudLog(id: "b", recordedOn: "2026-06-02", weightKg: 89)]
        check(ChartMath.recordBroken(weightKg: 89, date: "2026-06-03", logs: logs) == nil, "ties are not records")
        check(ChartMath.recordBroken(weightKg: 88.9, date: "2026-06-03", logs: logs) == .allTime, "all-time record priority")
        check(ChartMath.recordBroken(weightKg: 80, date: "2026-05-01", logs: logs) == nil, "no future comparison")
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: -7 * 3600)!
        check(Day.string(Day.date("2026-09-17", calendar: calendar), calendar: calendar) == "2026-09-17", "local dates")
        let json = #"{"memberId":"m","userId":"u","displayName":"Friend","role":"member","joinedAt":"2026-01-01","daysLogged":1,"badges":[],"highlights":[],"sparkline":[],"trendline":[],"isMe":false,"weightKg":88,"baseWeightKg":88}"#
        let member = try JSONDecoder().decode(CloudMember.self, from: Data(json.utf8))
        let encoded = String(decoding: try JSONEncoder().encode(member), as: UTF8.self)
        check(!encoded.contains("weightKg") && !encoded.contains("baseWeightKg"), "group privacy boundary")
        print("Native core: \(checks) checks passed")
    }
}
