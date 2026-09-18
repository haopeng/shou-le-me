import SwiftData
import SwiftUI

@main
struct SlimYetApp: App {
    @State private var store = NativeStore()

    var body: some Scene {
        WindowGroup {
            NativeRootView().environment(store)
        }
        .modelContainer(for: WeightEntry.self)
    }
}
