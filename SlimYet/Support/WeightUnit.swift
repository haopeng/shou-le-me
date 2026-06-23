import Foundation
import SwiftUI

enum WeightUnit: String, CaseIterable, Identifiable {
    case kilogram = "kg"
    case pound = "lb"

    var id: String { rawValue }
    var symbol: String { rawValue }

    var title: LocalizedStringKey {
        switch self {
        case .kilogram:
            "unit.kg"
        case .pound:
            "unit.lb"
        }
    }

    func displayValue(fromKilograms kilograms: Double) -> Double {
        switch self {
        case .kilogram:
            kilograms
        case .pound:
            kilograms * 2.204_622_621_8
        }
    }

    func kilograms(fromDisplayValue value: Double) -> Double {
        switch self {
        case .kilogram:
            value
        case .pound:
            value / 2.204_622_621_8
        }
    }

    func formattedWeight(_ kilograms: Double) -> String {
        "\(formatNumber(displayValue(fromKilograms: kilograms))) \(symbol)"
    }

    func formattedDelta(_ kilograms: Double) -> String {
        let value = displayValue(fromKilograms: kilograms)
        let prefix = value > 0 ? "+" : ""
        return "\(prefix)\(formatNumber(value)) \(symbol)"
    }

    func formattedAbsoluteDelta(_ kilograms: Double) -> String {
        "\(formatNumber(abs(displayValue(fromKilograms: kilograms)))) \(symbol)"
    }

    private func formatNumber(_ value: Double) -> String {
        String(format: "%.1f", value)
    }
}

extension String {
    var decimalValue: Double? {
        let normalized = trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ",", with: ".")
        return Double(normalized)
    }
}
