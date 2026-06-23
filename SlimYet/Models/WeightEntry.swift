import Foundation
import SwiftData

@Model
final class WeightEntry {
    @Attribute(.unique) var id: UUID
    var date: Date
    var weightKg: Double
    var note: String
    var createdAt: Date
    var updatedAt: Date

    init(
        id: UUID = UUID(),
        date: Date,
        weightKg: Double,
        note: String = "",
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.date = date
        self.weightKg = weightKg
        self.note = note
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

extension WeightEntry {
    var record: WeightRecord {
        WeightRecord(id: id, date: date, weightKg: weightKg, note: note)
    }
}
