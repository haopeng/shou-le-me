import Foundation
import Supabase

enum CloudFailure: LocalizedError {
    case message(String)
    case signedOut
    var errorDescription: String? {
        switch self {
        case .message(let message): message
        case .signedOut:
            (UserDefaults.standard.string(forKey: "native.language") ?? Locale.preferredLanguages.first ?? "en").hasPrefix("zh") ? "请重新登录。" : "Please sign in again."
        }
    }
}

@MainActor
final class CloudAPI {
    static let origin = URL(string: "https://shou-le-me.vercel.app")!
    static let callback = origin.appending(path: "mobile/auth")
    let auth: SupabaseClient
    private let session: URLSession

    init(configuration: MobileConfiguration) {
        auth = SupabaseClient(
            supabaseURL: configuration.supabaseUrl,
            supabaseKey: configuration.publishableKey,
            options: .init(auth: .init(redirectToURL: Self.callback, flowType: .pkce))
        )
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 25
        config.urlCache = nil
        session = URLSession(configuration: config)
    }

    static func configuration() async throws -> MobileConfiguration {
        var request = URLRequest(url: origin.appending(path: "api/mobile/config"))
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 20
        let (data, response) = try await URLSession.shared.data(for: request)
        try check(response, data: data)
        return try JSONDecoder().decode(MobileConfiguration.self, from: data)
    }

    func get<T: Decodable & Sendable>(_ path: String, publicAccess: Bool = false) async throws -> T {
        try await send(path, publicAccess: publicAccess)
    }

    func send<T: Decodable & Sendable>(_ path: String, method: String = "GET", body: Data? = nil,
                                      contentType: String = "application/json", publicAccess: Bool = false) async throws -> T {
        guard let url = URL(string: path, relativeTo: Self.origin)?.absoluteURL,
              url.host == Self.origin.host, url.scheme == "https" else {
            throw CloudFailure.message("Invalid request.")
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("SlimYet-iOS/1.0", forHTTPHeaderField: "X-Client-Info")
        if !publicAccess {
            let token = try await auth.auth.session.accessToken
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await session.data(for: request)
        try Self.check(response, data: data)
        return try JSONDecoder().decode(T.self, from: data)
    }

    func mutate(_ path: String, method: String = "POST", values: [String: Any]) async throws {
        let body = try JSONSerialization.data(withJSONObject: values)
        let _: MutationResponse = try await send(path, method: method, body: body)
    }

    func uploadAvatar(_ jpeg: Data) async throws -> CloudProfile {
        let boundary = UUID().uuidString
        var body = Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"avatar\"; filename=\"avatar.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".utf8)
        body.append(jpeg)
        body.append(Data("\r\n--\(boundary)--\r\n".utf8))
        let result: ProfileResponse = try await send("/api/me/avatar", method: "POST", body: body, contentType: "multipart/form-data; boundary=\(boundary)")
        return result.profile
    }

    private static func check(_ response: URLResponse, data: Data) throws {
        guard let response = response as? HTTPURLResponse else { throw CloudFailure.message("No server response.") }
        if response.statusCode == 401 { throw CloudFailure.signedOut }
        guard (200...299).contains(response.statusCode) else {
            struct ErrorBody: Decodable { let error: String }
            let message = (try? JSONDecoder().decode(ErrorBody.self, from: data).error) ?? "Connection failed (\(response.statusCode)). Please try again."
            throw CloudFailure.message(message)
        }
    }
}
