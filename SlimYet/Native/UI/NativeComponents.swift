import SwiftUI

enum NativePalette {
    static let teal = Color(red: 0.04, green: 0.57, blue: 0.55)
    static let coral = Color(red: 0.95, green: 0.30, blue: 0.25)
    static let colors: [Color] = [coral, teal, .indigo, .orange, .pink, .blue, .mint, .brown]
}

struct MemberAvatar: View {
    let name: String
    let url: String?
    var size: CGFloat = 44
    var body: some View {
        AsyncImage(url: url.flatMap(URL.init(string:))) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            Circle().fill(NativePalette.teal.opacity(0.12))
                .overlay(Text(String(name.prefix(1)).uppercased()).font(.system(size: size * 0.38, weight: .bold)).foregroundStyle(NativePalette.teal))
        }
        .frame(width: size, height: size).clipShape(Circle())
        .accessibilityHidden(true)
    }
}

struct SectionTitle: View {
    let title: String
    let symbol: String
    var body: some View { Label(title, systemImage: symbol).font(.headline).foregroundStyle(.primary).textCase(nil) }
}

struct MetricView: View {
    let title: String
    let value: String
    var color: Color = .primary
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.title3.weight(.bold)).monospacedDigit().foregroundStyle(color).minimumScaleFactor(0.75)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct InlineFailure: View {
    @Environment(NativeStore.self) private var store
    let message: String
    let retry: () -> Void
    var body: some View {
        ContentUnavailableView {
            Label(store.text("Could not refresh", "暂时无法刷新"), systemImage: "wifi.exclamationmark")
        } description: { Text(message) } actions: {
            Button(store.text("Try again", "重试"), action: retry).buttonStyle(.borderedProminent)
        }
    }
}

struct AsyncActionButton: View {
    let title: String
    var role: ButtonRole? = nil
    var symbol: String? = nil
    let action: @MainActor () async throws -> Void
    @Environment(NativeStore.self) private var store
    @State private var busy = false
    var body: some View {
        Button(role: role) {
            busy = true
            Task {
                defer { busy = false }
                do { try await action() }
                catch is CancellationError { }
                catch { store.message = error.localizedDescription }
            }
        } label: {
            HStack {
                if busy { ProgressView() }
                else if let symbol { Image(systemName: symbol) }
                Text(title)
            }.frame(minHeight: 30)
        }.disabled(busy)
    }
}

struct AppBrand: View {
    @Environment(NativeStore.self) private var store
    var body: some View {
        HStack(spacing: 10) {
            Image("SparkCoinBadge").resizable().scaledToFit().frame(width: 40, height: 40)
            Text(store.text("Slim Yet?", "瘦了么")).font(.title2.bold())
        }
    }
}
