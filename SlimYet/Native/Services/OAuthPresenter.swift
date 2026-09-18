import AuthenticationServices
import Supabase
import UIKit

@MainActor
final class OAuthPresenter: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var session: ASWebAuthenticationSession?

    func signIn(provider: Provider, api: CloudAPI) async throws {
        let url = try api.auth.auth.getOAuthSignInURL(provider: provider, redirectTo: CloudAPI.callback)
        let callback: URL = try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "com.haopeng.slimyet") { url, error in
                if let url { continuation.resume(returning: url) }
                else { continuation.resume(throwing: error ?? CloudFailure.message("Sign-in was cancelled.")) }
            }
            session.presentationContextProvider = self
            self.session = session
            if !session.start() { continuation.resume(throwing: CloudFailure.message("Could not open sign-in.")) }
        }
        defer { session = nil }
        _ = try await api.auth.auth.session(from: callback)
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows).first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }
}
