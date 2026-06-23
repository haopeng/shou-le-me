import SwiftUI

enum AppTheme {
    static let background = Color(red: 0.96, green: 0.98, blue: 0.96)
    static let backgroundWarm = Color(red: 1.00, green: 0.96, blue: 0.90)
    static let surface = Color(uiColor: .systemBackground)
    static let surfaceAlt = Color(red: 0.93, green: 0.97, blue: 0.96)
    static let ink = Color(red: 0.10, green: 0.13, blue: 0.16)
    static let muted = Color(red: 0.42, green: 0.46, blue: 0.50)
    static let teal = Color(red: 0.04, green: 0.58, blue: 0.54)
    static let coral = Color(red: 0.93, green: 0.30, blue: 0.25)
    static let indigo = Color(red: 0.25, green: 0.32, blue: 0.72)
    static let lemon = Color(red: 0.92, green: 0.72, blue: 0.18)
    static let peach = Color(red: 0.98, green: 0.58, blue: 0.38)
    static let sky = Color(red: 0.22, green: 0.61, blue: 0.94)
    static let lilac = Color(red: 0.62, green: 0.43, blue: 0.86)

    static var screenBackground: LinearGradient {
        LinearGradient(
            colors: [background, backgroundWarm.opacity(0.82), Color(red: 0.93, green: 0.98, blue: 1.00)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    static var heroGradient: LinearGradient {
        LinearGradient(
            colors: [teal, sky, peach],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    static var celebrationGradient: LinearGradient {
        LinearGradient(
            colors: [lemon, peach, teal],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    static func color(for tone: InsightTone) -> Color {
        switch tone {
        case .bright:
            teal
        case .steady:
            indigo
        case .quiet:
            muted
        }
    }

    static func shadow(_ color: Color = ink, opacity: Double = 0.10) -> Color {
        color.opacity(opacity)
    }
}

func localizedString(_ key: String, _ arguments: CVarArg...) -> String {
    let format = NSLocalizedString(key, comment: "")
    return String(format: format, locale: Locale.current, arguments: arguments)
}
