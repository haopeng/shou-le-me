#if DEBUG
import Foundation

@MainActor
enum PreviewData {
    static func load(into store: NativeStore) {
        let calendar = Calendar.current
        let date: (Int) -> String = { Day.string(calendar.date(byAdding: .day, value: $0, to: Date())!) }
        let records = stride(from: -70, through: 0, by: 5).enumerated().map { index, day in
            CloudLog(id: "log-\(index)", recordedOn: date(day), weightKg: 76 - Double(index) * 0.13 + (index % 4 == 2 ? 0.2 : 0), note: nil)
        }
        let latest = records.last!.weightKg
        store.isDemo = true
        store.profile = CloudProfile(id: "preview-me", email: "preview@example.com", fullName: "Alex Chen", nickname: "Alex", locale: "en")
        store.personal = PersonalDashboard(stats: .init(latestWeightKg: latest, previousWeightKg: records[records.count - 2].weightKg, changeFromFirstKg: latest - 76, changeFromPreviousKg: -0.13, lowestWeightKg: latest, lowestDate: date(0), average30Kg: 75.1, loggedDays: records.count, lastLoggedOn: date(0)), logs: records, highlights: [CloudHighlight(kind: "personal_low", valueKg: latest, tone: "good"), CloudHighlight(kind: "consistency", count: records.count, tone: "steady")])
        let group = CloudGroup(id: "preview-group", name: "Little Wins Club", description: "Showing up, one day at a time.", inviteCode: "PREVIEW8", ownerId: "preview-me", createdAt: date(-70), memberCount: 3, myRole: "owner", myBaseReady: true, myBaseDate: date(-70))
        store.groups = [group, CloudGroup(id: "preview-family", name: "Family Check-in", description: nil, inviteCode: "PREVIEW9", ownerId: "preview-me", createdAt: date(-30), memberCount: 3, myRole: "member", myBaseReady: true, myBaseDate: date(-30))]
        let members: [CloudMember] = ["Alex", "Mia", "Sam"].enumerated().map { index, name in
            let points = records.enumerated().map { position, log in
                DeltaPoint(date: log.recordedOn, deltaKg: index == 0 ? log.weightKg - 76 : -(Double(position) * (index == 1 ? 0.075 : 0.035)))
            }
            return CloudMember(memberId: "member-\(index)", userId: index == 0 ? "preview-me" : "preview-\(index)", displayName: name, role: index == 0 ? "owner" : "member", joinedAt: date(-70), baseDate: date(-70), latestDate: date(0), deltaKg: points.last?.deltaKg, previousDeltaKg: points[points.count - 2].deltaKg, historicalBestDeltaKg: points.map(\.deltaKg).min(), historicalBestDeltaDate: date(0), daysLogged: points.count, rank: index + 1, badges: [], highlights: [], sparkline: points, trendline: points, isMe: index == 0)
        }
        let activities = members.map { member in
            CloudActivity(id: "feed-\(member.id)", actorUserId: member.userId, actorName: member.displayName, kind: "delta_update", recordedOn: date(0), previousDeltaKg: member.previousDeltaKg, newDeltaKg: member.deltaKg, createdAt: ISO8601DateFormatter().string(from: Date()), reactionCounts: ["like": 2, "heart": 1, "care": 0], reactionUsers: ["like": [ReactionPerson(userId: "preview-1", displayName: "Mia", isMe: false)]], myReactions: [])
        }
        for group in store.groups {
            store.dashboards[group.id] = GroupDashboard(group: .init(id: group.id, name: group.name, description: group.description, inviteCode: group.inviteCode, ownerId: group.ownerId, createdAt: group.createdAt), me: .init(memberId: "member-0", role: group.myRole, baseReady: true, baseDate: date(-70)), stats: .init(memberCount: 3, readyCount: 3, loggedTodayCount: 3, totalLossKg: 3.4, bestDeltaKg: latest - 76), members: members, feed: activities, feedPage: .init(offset: 0, limit: 10, nextOffset: 3, hasMore: false), joinRequests: [])
        }
        store.publicDashboard = PublicDashboard(generatedAt: ISO8601DateFormatter().string(from: Date()), stats: .init(groupCount: 12, totalLossKg: 42.8), topGroups: [TopGroup(id: group.id, name: group.name, description: group.description, memberCount: 3, readyCount: 3, totalLossKg: 3.4), TopGroup(id: "preview-top", name: "Morning Crew", memberCount: 4, readyCount: 4, totalLossKg: 2.8)])
        store.phase = .signedIn
    }
}
#endif
