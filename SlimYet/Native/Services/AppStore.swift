import Foundation
import Observation
import Supabase
import UIKit

struct SaveReceipt: Identifiable {
    let id = UUID()
    let weightKg: Double
    let previousKg: Double?
    let date: String
    let milestone: RecordMilestone?
    let groupDeltas: [(name: String, delta: Double)]
}

@MainActor @Observable
final class NativeStore {
    enum Phase { case loading, signedOut, signedIn, failed }
    var phase = Phase.loading
    var configuration: MobileConfiguration?
    var api: CloudAPI?
    var profile: CloudProfile?
    var personal: PersonalDashboard?
    var groups: [CloudGroup] = []
    var dashboards: [String: GroupDashboard] = [:]
    var publicDashboard: PublicDashboard?
    var message: String?
    var receipt: SaveReceipt?
    var recovery = false
    var pendingInvite: String?
    var refreshRevision = 0
    var isRefreshing = false
    var isDemo = false
    var language: String = UserDefaults.standard.string(forKey: "native.language") ?? (Locale.preferredLanguages.first?.hasPrefix("zh") == true ? "zh" : "en") {
        didSet { UserDefaults.standard.set(language, forKey: "native.language") }
    }
    var unit: WeightUnit = WeightUnit(rawValue: UserDefaults.standard.string(forKey: "weightUnit") ?? "kg") ?? .kilogram {
        didSet { UserDefaults.standard.set(unit.rawValue, forKey: "weightUnit") }
    }
    var blockedUsers: Set<String> = []
    @ObservationIgnored private var authTask: Task<Void, Never>?
    @ObservationIgnored private var generation = UUID()
    @ObservationIgnored private var refreshID = UUID()
    @ObservationIgnored let oauth = OAuthPresenter()

    var chinese: Bool { language == "zh" }
    func text(_ en: String, _ zh: String) -> String { chinese ? zh : en }
    func weight(_ kg: Double?) -> String { kg.map(unit.formattedWeight) ?? "--" }
    func delta(_ kg: Double?) -> String { kg.map(unit.formattedDelta) ?? "--" }
    func client() throws -> CloudAPI { guard let api else { throw CloudFailure.message(text("Connecting. Try again shortly.", "正在连接，请稍后重试。")) }; return api }

    func start() async {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--preview-data") {
            PreviewData.load(into: self)
            return
        }
        #endif
        guard api == nil else { return }
        phase = .loading
        do {
            let config = try await CloudAPI.configuration()
            configuration = config
            let api = CloudAPI(configuration: config)
            self.api = api
            authTask?.cancel()
            authTask = Task { [weak self] in
                for await (event, session) in api.auth.auth.authStateChanges {
                    guard let self, !Task.isCancelled else { return }
                    if event == .passwordRecovery { self.recovery = true }
                    if let session {
                        if self.profile?.id != session.user.id.uuidString.lowercased() {
                            self.clearAccount()
                            self.phase = .signedIn
                            await self.refresh()
                        }
                    } else {
                        self.clearAccount()
                        self.phase = .signedOut
                    }
                }
            }
        } catch {
            message = error.localizedDescription
            phase = .failed
        }
    }

    func refresh(force: Bool = false) async {
        guard !isDemo, (!isRefreshing || force), phase == .signedIn, let api else { return }
        let current = generation
        let requestID = UUID()
        refreshID = requestID
        isRefreshing = true
        defer { if current == generation && requestID == refreshID { isRefreshing = false } }
        do {
            async let profileResponse: ProfileResponse = api.get("/api/me")
            async let personalResponse: PersonalDashboard = api.get("/api/me/dashboard")
            async let groupResponse: GroupsResponse = api.get("/api/groups")
            let (p, d, g) = try await (profileResponse, personalResponse, groupResponse)
            guard current == generation && requestID == refreshID else { return }
            profile = p.profile
            personal = d
            groups = g.groups
            blockedUsers = Set(UserDefaults.standard.stringArray(forKey: "native.blocked.\(p.profile.id)") ?? [])
            // Stale group deltas must never survive a new global weight entry.
            dashboards = [:]
            refreshRevision += 1
        } catch {
            if current == generation && requestID == refreshID { message = error.localizedDescription }
        }
    }

    func loadGroup(_ id: String, more: Bool = false) async throws -> GroupDashboard {
        if isDemo, let value = dashboards[id] { return value }
        let current = generation
        let revision = refreshRevision
        let previous = dashboards[id]
        let offset = more ? previous?.feedPage?.nextOffset ?? 0 : 0
        var next: GroupDashboard = try await client().get("/api/groups/\(id)?feedOffset=\(offset)&feedLimit=10")
        guard current == generation && revision == refreshRevision else { throw CancellationError() }
        if more {
            var seen = Set<String>()
            next.feed = ((previous?.feed ?? []) + next.feed).filter { seen.insert($0.id).inserted }
        }
        dashboards[id] = next
        return next
    }

    func loadTop() async throws {
        if isDemo { return }
        let current = generation
        let result: PublicDashboard = try await client().get("/api/public-dashboard", publicAccess: true)
        guard current == generation else { return }
        publicDashboard = result
    }

    func saveWeight(kg: Double, date: String, note: String) async throws {
        let previousLogs = personal?.logs ?? []
        let previous = previousLogs.last(where: { $0.recordedOn < date })?.weightKg
        let milestone = ChartMath.recordBroken(weightKg: kg, date: date, logs: previousLogs)
        if isDemo { throw CloudFailure.message(text("Preview data is read-only.", "预览数据不可修改。")) }
        try await client().mutate("/api/me/logs", values: ["weightKg": kg, "recordedOn": date, "note": note])
        // The server fans this single write out to every membership.
        await refresh(force: true)
        var deltas: [(String, Double)] = []
        for group in groups where group.myBaseReady {
            if let dashboard = try? await loadGroup(group.id), let delta = dashboard.members.first(where: \.isMe)?.deltaKg {
                deltas.append((group.name, delta))
            }
        }
        receipt = SaveReceipt(weightKg: kg, previousKg: previous, date: date, milestone: milestone, groupDeltas: deltas)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    func deleteLog(_ date: String) async throws {
        try await client().mutate("/api/me/logs?date=\(date)", method: "DELETE", values: [:])
        await refresh(force: true)
    }

    func signOut() async throws {
        if isDemo { isDemo = false; clearAccount(); phase = .signedOut; await start(); return }
        try await client().auth.auth.signOut(scope: .local)
        clearAccount()
        phase = .signedOut
    }

    private func clearAccount() {
        generation = UUID()
        profile = nil
        personal = nil
        groups = []
        dashboards = [:]
        blockedUsers = []
        publicDashboard = nil
        receipt = nil
        isRefreshing = false
    }

    func block(_ member: CloudMember) {
        blockedUsers.insert(member.userId)
        if let id = profile?.id { UserDefaults.standard.set(Array(blockedUsers), forKey: "native.blocked.\(id)") }
    }

    func unblockAll() {
        blockedUsers = []
        if let id = profile?.id { UserDefaults.standard.removeObject(forKey: "native.blocked.\(id)") }
    }

    func handleURL(_ url: URL) async {
        if url.scheme == "com.haopeng.slimyet", url.host == "auth" {
            do { _ = try await client().auth.auth.session(from: url) }
            catch { message = error.localizedDescription }
        } else if url.host == CloudAPI.origin.host || (url.scheme == "com.haopeng.slimyet" && url.host == "join") {
            let parts = url.pathComponents.filter { $0 != "/" }
            if let code = parts.last, (parts.first == "join" || url.host == "join"),
               code.range(of: "^[A-Za-z0-9]{5,24}$", options: .regularExpression) != nil {
                pendingInvite = code.uppercased()
            }
        }
    }
}
