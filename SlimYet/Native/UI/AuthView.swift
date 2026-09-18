import AuthenticationServices
import SwiftUI

struct NativeAuthView: View {
    @Environment(NativeStore.self) private var store
    @State private var email = ""
    @State private var password = ""
    @State private var createAccount = false
    @State private var notice: String?
    @State private var acceptedTerms = false
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 18) {
                        Image("SparkCoinBadge").resizable().scaledToFit().frame(width: 84, height: 84)
                        Text(store.text("Slim Yet?", "瘦了么")).font(.largeTitle.bold())
                        Text(store.text("A little progress. A little encouragement.", "一点进步，一起加油。"))
                            .font(.title3).foregroundStyle(.secondary)
                    }.padding(.vertical, 16).listRowBackground(Color.clear)
                }
                Section {
                    Picker(store.text("Account", "账号"), selection: $createAccount) {
                        Text(store.text("Sign in", "登录")).tag(false)
                        Text(store.text("Create account", "注册")).tag(true)
                    }.pickerStyle(.segmented)
                    TextField(store.text("Email", "邮箱"), text: $email)
                        .textContentType(.username).keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never).autocorrectionDisabled().focused($focused)
                        .accessibilityIdentifier("auth.email")
                    SecureField(store.text("Password", "密码"), text: $password)
                        .textContentType(createAccount ? .newPassword : .password)
                        .accessibilityIdentifier("auth.password")
                    if createAccount {
                        Toggle(store.text("I accept the Terms and Privacy Policy", "我同意服务条款及隐私政策"), isOn: $acceptedTerms)
                    }
                    AsyncActionButton(title: store.text(createAccount ? "Create account" : "Sign in", createAccount ? "注册账号" : "登录"), symbol: "arrow.right") {
                        let auth = try store.client().auth.auth
                        let address = email.trimmingCharacters(in: .whitespacesAndNewlines)
                        if createAccount {
                            _ = try await auth.signUp(email: address, password: password, redirectTo: CloudAPI.callback)
                            notice = store.text("Check your email to confirm your account, then sign in.", "请在邮件中确认账号，然后登录。")
                        } else {
                            _ = try await auth.signIn(email: address, password: password)
                        }
                    }.disabled(!email.contains("@") || password.count < 6 || (createAccount && !acceptedTerms))
                    if !createAccount {
                        AsyncActionButton(title: store.text("Forgot password?", "忘记密码？")) {
                            try await store.client().auth.auth.resetPasswordForEmail(email.trimmingCharacters(in: .whitespacesAndNewlines), redirectTo: CloudAPI.callback)
                            notice = store.text("Check your inbox for the password reset link.", "请查收重设密码邮件。")
                        }.disabled(!email.contains("@"))
                        AsyncActionButton(title: store.text("Email me a sign-in link", "发送免密码登录邮件"), symbol: "envelope") {
                            try await store.client().auth.auth.signInWithOTP(email: email.trimmingCharacters(in: .whitespacesAndNewlines), redirectTo: CloudAPI.callback, shouldCreateUser: false)
                            notice = store.text("Open the email link on this iPhone to sign in to your existing account.", "请在这台 iPhone 上打开邮件链接，登录已有账号。")
                        }.disabled(!email.contains("@"))
                    }
                }
                if let notice { Section { Label(notice, systemImage: "envelope.badge").foregroundStyle(NativePalette.teal) } }
                if let config = store.configuration, config.socialLoginReady && config.appleEnabled {
                    Section {
                        AsyncActionButton(title: store.text("Continue with Apple", "通过 Apple 登录"), symbol: "apple.logo") {
                            try await store.oauth.signIn(provider: .apple, api: store.client())
                        }.tint(.primary)
                        if config.googleEnabled {
                            AsyncActionButton(title: store.text("Continue with Google", "通过 Google 登录")) {
                                try await store.oauth.signIn(provider: .google, api: store.client())
                            }
                        }
                    }
                }
                Section {
                    NavigationLink("Top5") { TopGroupsView() }
                    HStack {
                        Link(store.text("Privacy", "隐私政策"), destination: CloudAPI.origin.appending(path: "privacy").appending(queryItems: [URLQueryItem(name: "lang", value: store.language)]))
                        Spacer()
                        Link(store.text("Terms", "服务条款"), destination: CloudAPI.origin.appending(path: "terms").appending(queryItems: [URLQueryItem(name: "lang", value: store.language)]))
                        Spacer()
                        Button(store.chinese ? "English" : "中文") { store.language = store.chinese ? "en" : "zh" }
                    }.font(.footnote)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

struct PasswordRecoverySheet: View {
    @Environment(NativeStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var password = ""
    @State private var confirmation = ""
    var body: some View {
        NavigationStack {
            Form {
                SecureField(store.text("New password (8+ characters)", "新密码（至少8位）"), text: $password).textContentType(.newPassword)
                SecureField(store.text("Confirm password", "确认密码"), text: $confirmation).textContentType(.newPassword)
                AsyncActionButton(title: store.text("Save password", "保存密码")) {
                    try await store.client().auth.auth.update(user: .init(password: password))
                    store.recovery = false
                    dismiss()
                }.disabled(password.count < 8 || password != confirmation)
            }
            .navigationTitle(store.text("Reset password", "重设密码"))
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(store.text("Cancel", "取消")) { dismiss() } } }
        }
    }
}
