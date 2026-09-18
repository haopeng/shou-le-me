import Foundation

struct MobileConfiguration: Decodable, Sendable {
    let supabaseUrl: URL
    let publishableKey: String
    let googleEnabled: Bool
    let appleEnabled: Bool
    let socialLoginReady: Bool
}

struct CloudProfile: Codable, Sendable {
    let id: String
    var email: String?
    var fullName: String?
    var nickname: String?
    var avatarUrl: String?
    var locale: String?
    var isStatusAdmin: Bool?
    var displayName: String { nickname?.nilIfEmpty ?? fullName?.nilIfEmpty ?? "Member" }
}

struct ProfileResponse: Decodable, Sendable { let profile: CloudProfile }
struct GroupsResponse: Decodable, Sendable { let groups: [CloudGroup] }
struct GroupResponse: Decodable, Sendable { let group: CloudGroup }
struct JoinResponse: Decodable, Sendable { let groupId: String }
struct MutationResponse: Decodable, Sendable { var ok: Bool? }

struct CloudGroup: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    var description: String?
    let inviteCode: String
    let ownerId: String
    let createdAt: String
    let memberCount: Int
    let myRole: String
    let myBaseReady: Bool
    var myBaseDate: String?
}

struct CloudLog: Codable, Identifiable, Sendable {
    let id: String
    let recordedOn: String
    let weightKg: Double
    var note: String?
    var date: Date { Day.date(recordedOn) }
}

struct CloudHighlight: Codable, Sendable {
    let kind: String
    var valueKg: Double?
    var auxKg: Double?
    var date: String?
    var count: Int?
    let tone: String
}

struct PersonalDashboard: Codable, Sendable {
    struct Stats: Codable, Sendable {
        var latestWeightKg: Double?
        var previousWeightKg: Double?
        var changeFromFirstKg: Double?
        var changeFromPreviousKg: Double?
        var lowestWeightKg: Double?
        var lowestDate: String?
        var average30Kg: Double?
        let loggedDays: Int
        var lastLoggedOn: String?
    }
    let stats: Stats
    let logs: [CloudLog]
    let highlights: [CloudHighlight]
}

struct DeltaPoint: Codable, Identifiable, Sendable, Equatable {
    let date: String
    let deltaKg: Double
    var id: String { date }
}

// Deliberately no weightKg or baseWeightKg: group screens cannot receive absolute weights.
struct CloudMember: Codable, Identifiable, Sendable {
    let memberId: String
    let userId: String
    let displayName: String
    var avatarUrl: String?
    let role: String
    let joinedAt: String
    var baseDate: String?
    var latestDate: String?
    var deltaKg: Double?
    var previousDeltaKg: Double?
    var historicalBestDeltaKg: Double?
    var historicalBestDeltaDate: String?
    let daysLogged: Int
    var rank: Int?
    let badges: [String]
    let highlights: [CloudHighlight]
    let sparkline: [DeltaPoint]
    let trendline: [DeltaPoint]
    let isMe: Bool
    var id: String { memberId }
}

struct ReactionPerson: Codable, Identifiable, Sendable {
    let userId: String
    let displayName: String
    var avatarUrl: String?
    let isMe: Bool
    var id: String { userId }
}

struct CloudActivity: Codable, Identifiable, Sendable {
    let id: String
    let actorUserId: String
    let actorName: String
    var actorAvatarUrl: String?
    let kind: String
    var recordedOn: String?
    var previousDeltaKg: Double?
    var newDeltaKg: Double?
    let createdAt: String
    let reactionCounts: [String: Int]
    var reactionUsers: [String: [ReactionPerson]]?
    var myReactions: [String]?
}

struct JoinRequest: Codable, Identifiable, Sendable {
    let id: String
    let requesterUserId: String
    let requesterName: String
    var requesterAvatarUrl: String?
    var message: String?
    let requestedAt: String
}

struct GroupDashboard: Codable, Sendable {
    struct Group: Codable, Sendable {
        let id: String
        let name: String
        var description: String?
        let inviteCode: String
        let ownerId: String
        let createdAt: String
    }
    struct Membership: Codable, Sendable {
        let memberId: String
        let role: String
        let baseReady: Bool
        var baseDate: String?
    }
    struct Stats: Codable, Sendable {
        let memberCount: Int
        let readyCount: Int
        let loggedTodayCount: Int
        let totalLossKg: Double
        var bestDeltaKg: Double?
    }
    struct FeedPage: Codable, Sendable {
        let offset: Int
        let limit: Int
        let nextOffset: Int
        let hasMore: Bool
    }
    let group: Group
    let me: Membership
    let stats: Stats
    let members: [CloudMember]
    var feed: [CloudActivity]
    var feedPage: FeedPage?
    var joinRequests: [JoinRequest]?
}

struct TopGroup: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    var description: String?
    let memberCount: Int
    let readyCount: Int
    let totalLossKg: Double
}

struct PublicDashboard: Codable, Sendable {
    struct Stats: Codable, Sendable { let groupCount: Int; let totalLossKg: Double }
    let generatedAt: String
    let stats: Stats
    let topGroups: [TopGroup]
}

extension String {
    var nilIfEmpty: String? { trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : self }
}
