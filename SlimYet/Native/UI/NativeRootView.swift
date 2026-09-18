import SwiftUI

struct NativeRootView: View {
    @Environment(NativeStore.self) private var store
    @Environment(\.scenePhase) private var scenePhase
    @State private var tab = 0
    @State private var showLog = false
    @State private var showInvite = false

    var body: some View {
        @Bindable var store = store
        Group {
            switch store.phase {
            case .loading:
                VStack(spacing: 20) { AppBrand(); ProgressView() }.frame(maxWidth: .infinity, maxHeight: .infinity)
            case .failed:
                InlineFailure(message: store.message ?? "") { Task { await store.start() } }
            case .signedOut: NativeAuthView()
            case .signedIn:
                TabView(selection: $tab) {
                    NavigationStack { PersonalView { showLog = true } }
                        .tabItem { Label(store.text("My Journey", "我的"), systemImage: "chart.xyaxis.line") }.tag(0)
                    NavigationStack { GroupsView { showLog = true } }
                        .tabItem { Label(store.text("Groups", "小组"), systemImage: "person.2.fill") }.tag(1)
                    NavigationStack { TopGroupsView() }
                        .tabItem { Label("Top5", systemImage: "trophy.fill") }.tag(2)
                    NavigationStack { NativeSettingsView() }
                        .tabItem { Label(store.text("Settings", "设置"), systemImage: "person.crop.circle") }.tag(3)
                }
                .sheet(isPresented: $showLog) { LogEntrySheet(showActualWeight: tab == 0) }
                .sheet(isPresented: $showInvite) { JoinGroupSheet(initialCode: store.pendingInvite ?? "") }
                .sheet(isPresented: $store.recovery) { PasswordRecoverySheet() }
                .onChange(of: store.pendingInvite) { _, code in if code != nil { tab = 1; showInvite = true } }
                .onAppear { if store.pendingInvite != nil { tab = 1; showInvite = true } }
                .overlay(alignment: .top) {
                    #if DEBUG
                    if store.isDemo {
                        Text(store.text("PREVIEW DATA", "演示数据")).font(.caption2.bold()).padding(.horizontal, 12).padding(.vertical, 3)
                            .background(.yellow, in: Capsule()).allowsHitTesting(false)
                    }
                    #endif
                }
            }
        }
        .tint(NativePalette.teal)
        .environment(\.locale, Locale(identifier: store.chinese ? "zh_Hans" : "en"))
        .task { await store.start() }
        .onChange(of: scenePhase) { _, phase in if phase == .active { Task { await store.refresh() } } }
        .onOpenURL { url in Task { await store.handleURL(url) } }
        .alert(store.text("Slim Yet?", "瘦了么"), isPresented: Binding(get: { store.message != nil && store.phase != .failed }, set: { if !$0 { store.message = nil } })) {
            Button(store.text("OK", "知道了")) { store.message = nil }
        } message: { Text(store.message ?? "") }
        .overlay {
            if scenePhase != .active {
                Rectangle().fill(.background).overlay(AppBrand()).ignoresSafeArea().accessibilityHidden(true)
            }
        }
    }
}
