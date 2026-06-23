import SwiftData
import SwiftUI

@main
struct SlimYetApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(for: WeightEntry.self)
    }
}
