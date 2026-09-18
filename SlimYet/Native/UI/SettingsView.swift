import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct NativeSettingsView: View {
    @Environment(NativeStore.self) private var store
    @State private var editProfile = false
    @State private var deleteAccount = false
    @State private var confirmSignOut = false
    @State private var exporting = false
    @State private var support = false
    @State private var exportDocument = WeightCSV(text: "")
    var body: some View {
        @Bindable var store = store
        Form {
            Section {
                Button { editProfile = true } label: {
                    HStack(spacing: 14) {
                        MemberAvatar(name: store.profile?.displayName ?? "", url: store.profile?.avatarUrl, size: 60)
                        VStack(alignment: .leading, spacing: 5) {
                            Text(store.profile?.displayName ?? "").font(.headline).foregroundStyle(.primary)
                            Text(store.profile?.email ?? "").font(.caption).foregroundStyle(.secondary).lineLimit(1)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
                    }.padding(.vertical, 5)
                }.accessibilityIdentifier("settings.profile")
            }
            Section(store.text("Preferences", "偏好设置")) {
                Picker(store.text("Weight unit", "体重单位"), selection: $store.unit) {
                    Text(store.text("Kilograms (kg)", "公斤（kg）")).tag(WeightUnit.kilogram)
                    Text(store.text("Pounds (lb)", "磅（lb）")).tag(WeightUnit.pound)
                }
                Picker(store.text("Language", "语言"), selection: $store.language) {
                    Text("English").tag("en")
                    Text("简体中文").tag("zh")
                }
            }
            Section(store.text("Privacy & data", "隐私与数据")) {
                Button(store.text("Export my weight history", "导出我的体重记录"), systemImage: "square.and.arrow.up") {
                    exportDocument = WeightCSV(logs: store.personal?.logs ?? [])
                    exporting = true
                }
                if !store.blockedUsers.isEmpty {
                    Button(store.text("Unblock members (\(store.blockedUsers.count))", "取消屏蔽成员（\(store.blockedUsers.count)）"), systemImage: "person.fill.checkmark") { store.unblockAll() }
                }
                Link(destination: CloudAPI.origin.appending(path: "privacy").appending(queryItems: [URLQueryItem(name: "lang", value: store.language)])) { Label(store.text("Privacy policy", "隐私政策"), systemImage: "hand.raised") }
                Link(destination: CloudAPI.origin.appending(path: "terms").appending(queryItems: [URLQueryItem(name: "lang", value: store.language)])) { Label(store.text("Terms", "服务条款"), systemImage: "doc.text") }
                Button(store.text("Help & support", "帮助与支持"), systemImage: "questionmark.circle") { support = true }
            }
            Section {
                Button(store.text("Sign out", "退出登录"), systemImage: "rectangle.portrait.and.arrow.right") { confirmSignOut = true }
                Button(store.text("Delete my account", "删除我的账号"), systemImage: "trash", role: .destructive) { deleteAccount = true }
            } footer: {
                VStack(alignment: .leading, spacing: 8) {
                    Text(store.text("Slim Yet? 1.0", "瘦了么 1.0"))
                    Text(store.text("A weight journal, not medical advice. Your wellbeing matters more than any number.", "体重日记不提供医疗建议。你的健康，比任何数字都重要。"))
                }
            }
        }
        .navigationTitle(store.text("Settings", "设置"))
        .sheet(isPresented: $editProfile) { EditProfileSheet() }
        .sheet(isPresented: $deleteAccount) { DeleteAccountSheet() }
        .sheet(isPresented: $support) { SupportSheet() }
        .confirmationDialog(store.text("Sign out of this device?", "退出此设备上的账号？"), isPresented: $confirmSignOut, titleVisibility: .visible) {
            Button(store.text("Sign out", "退出登录"), role: .destructive) {
                Task { do { try await store.signOut() } catch { store.message = error.localizedDescription } }
            }
        }
        .fileExporter(isPresented: $exporting, document: exportDocument, contentType: .commaSeparatedText, defaultFilename: "SlimYet-\(Day.string(Date()))") { result in
            if case .failure(let error) = result { store.message = error.localizedDescription }
        }
    }
}

struct SupportSheet: View {
    @Environment(NativeStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var reason = ""
    @State private var sent = false
    var body: some View {
        NavigationStack {
            Form {
                if sent { Label(store.text("Message received", "问题已提交"), systemImage: "checkmark.circle") }
                else {
                    TextField(store.text("How can we help?", "有什么可以帮助你？"), text: $reason, axis: .vertical).lineLimit(5...10)
                    AsyncActionButton(title: store.text("Send message", "提交问题"), symbol: "paperplane") {
                        try await store.client().mutate("/api/me/reports", values: ["kind": "support", "reason": String(reason.prefix(1000))])
                        sent = true
                    }.disabled(reason.trimmingCharacters(in: .whitespacesAndNewlines).count < 5)
                }
                Link(store.text("Help center", "帮助中心"), destination: CloudAPI.origin.appending(path: "support").appending(queryItems: [URLQueryItem(name: "lang", value: store.language)]))
            }.navigationTitle(store.text("Help & support", "帮助与支持"))
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button(store.text("Done", "完成")) { dismiss() } } }
        }
    }
}

struct EditProfileSheet: View {
    @Environment(NativeStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var nickname = ""
    @State private var photo: PhotosPickerItem?
    @State private var uploading = false
    var body: some View {
        let busy = uploading
        let photoTitle = store.text("Choose photo", "选择照片")
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 16) {
                        MemberAvatar(name: store.profile?.displayName ?? "", url: store.profile?.avatarUrl, size: 72)
                        PhotosPicker(selection: $photo, matching: .images, photoLibrary: .shared()) {
                            if busy { ProgressView() }
                            else { Label(photoTitle, systemImage: "photo") }
                        }.disabled(uploading)
                    }.padding(.vertical, 8)
                    TextField(store.text("Name", "姓名"), text: $name).textContentType(.name)
                    TextField(store.text("Nickname", "昵称"), text: $nickname)
                }
                AsyncActionButton(title: store.text("Save profile", "保存资料"), symbol: "checkmark") {
                    let body: [String: Any] = ["fullName": String(name.prefix(80)), "nickname": String(nickname.prefix(40)), "avatarUrl": store.profile?.avatarUrl ?? "", "locale": store.language]
                    let response: ProfileResponse = try await store.client().send("/api/me", method: "PATCH", body: JSONSerialization.data(withJSONObject: body))
                    store.profile = response.profile
                    await store.refresh()
                    dismiss()
                }.disabled(uploading || nickname.nilIfEmpty == nil)
            }.navigationTitle(store.text("Edit profile", "编辑资料"))
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button(store.text("Cancel", "取消")) { dismiss() } } }
                .onAppear { name = store.profile?.fullName ?? ""; nickname = store.profile?.nickname ?? store.profile?.displayName ?? "" }
                .onChange(of: photo) { _, item in
                    guard let item else { return }
                    uploading = true
                    Task {
                        defer { uploading = false }
                        do {
                            guard let data = try await item.loadTransferable(type: Data.self), let original = UIImage(data: data) else { throw CloudFailure.message(store.text("Could not read that image.", "无法读取这张图片。")) }
                            let factor = min(1, 1024 / max(original.size.width, original.size.height))
                            let size = CGSize(width: original.size.width * factor, height: original.size.height * factor)
                            let format = UIGraphicsImageRendererFormat()
                            format.scale = 1
                            format.opaque = true
                            let image = UIGraphicsImageRenderer(size: size, format: format).image { context in
                                UIColor.white.setFill()
                                context.fill(CGRect(origin: .zero, size: size))
                                original.draw(in: CGRect(origin: .zero, size: size))
                            }
                            guard let jpeg = image.jpegData(compressionQuality: 0.85) else { throw CloudFailure.message("Could not prepare image.") }
                            store.profile = try await store.client().uploadAvatar(jpeg)
                        } catch { store.message = error.localizedDescription }
                    }
                }
        }.interactiveDismissDisabled(uploading)
    }
}

struct DeleteAccountSheet: View {
    @Environment(NativeStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var confirmation = ""
    @State private var password = ""
    @State private var notice: String?
    @State private var confirmDelete = false
    @State private var busy = false
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Label(store.text("This cannot be undone", "此操作无法撤销"), systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red)
                    Text(store.text("Your profile, photos, check-ins, reactions, and groups you own will be permanently deleted. This also removes those groups for other members. Export your history first if you need a copy.", "将永久删除你的资料、照片、体重记录、互动以及你创建的小组。其他成员也会失去这些小组。需要备份时，请先导出记录。"))
                }
                Section(store.text("Confirm your identity", "验证身份")) {
                    SecureField(store.text("Current password", "当前密码"), text: $password).textContentType(.password)
                    AsyncActionButton(title: store.text("Verify password", "验证密码")) {
                        guard let email = store.profile?.email else { return }
                        _ = try await store.client().auth.auth.signIn(email: email, password: password)
                        password = ""
                        notice = store.text("Verified. You can delete your account now.", "验证成功，可以继续删除账号。")
                    }.disabled(password.isEmpty)
                    AsyncActionButton(title: store.text("Verify using an email link", "通过邮件链接验证")) {
                        guard let email = store.profile?.email else { return }
                        try await store.client().auth.auth.signInWithOTP(email: email, redirectTo: CloudAPI.callback, shouldCreateUser: false)
                        notice = store.text("Open the link on this device, then return here.", "在本设备上打开邮件链接，然后回到这里。")
                    }
                    if let notice { Text(notice).font(.footnote).foregroundStyle(.secondary) }
                }
                Section {
                    TextField(store.text("Type DELETE to confirm", "输入 DELETE 确认"), text: $confirmation).textInputAutocapitalization(.characters).autocorrectionDisabled()
                    Button(role: .destructive) { confirmDelete = true } label: {
                        if busy { ProgressView() } else { Text(store.text("Permanently delete account", "永久删除账号")) }
                    }.disabled(confirmation != "DELETE" || busy)
                }
            }.navigationTitle(store.text("Delete account", "删除账号"))
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button(store.text("Cancel", "取消")) { dismiss() }.disabled(busy) } }
                .confirmationDialog(store.text("Permanently delete your account and owned groups?", "永久删除账号和创建的小组？"), isPresented: $confirmDelete, titleVisibility: .visible) {
                    Button(store.text("Delete everything", "确认永久删除"), role: .destructive) {
                        busy = true
                        Task {
                            defer { busy = false }
                            do {
                                try await store.client().mutate("/api/me/account", method: "DELETE", values: ["confirmation": "DELETE"])
                                try await store.signOut()
                                dismiss()
                            } catch { notice = error.localizedDescription }
                        }
                    }
                }.interactiveDismissDisabled(busy)
        }
    }
}

struct WeightCSV: FileDocument {
    static let readableContentTypes = [UTType.commaSeparatedText]
    var text: String
    init(text: String) { self.text = text }
    init(logs: [CloudLog]) {
        text = "date,weight_kg,note\r\n" + logs.map { log in
            let note = log.note ?? ""
            // Prevent spreadsheet formula execution when a user's note is opened in Excel.
            let safe = ["=", "+", "-", "@", "\t", "\r"].contains(where: note.hasPrefix) ? "'" + note : note
            return "\(log.recordedOn),\(log.weightKg),\"\(safe.replacingOccurrences(of: "\"", with: "\"\""))\""
        }.joined(separator: "\r\n")
    }
    init(configuration: ReadConfiguration) throws { text = String(decoding: configuration.file.regularFileContents ?? Data(), as: UTF8.self) }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: Data(text.utf8)) }
}
