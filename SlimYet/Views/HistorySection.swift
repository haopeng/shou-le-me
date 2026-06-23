import SwiftUI

struct HistorySection: View {
    let entries: [WeightEntry]
    let unit: WeightUnit
    let onDelete: (WeightEntry) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("history.title", systemImage: "clock.arrow.circlepath")
                .font(.headline)
                .foregroundStyle(AppTheme.ink)

            VStack(spacing: 0) {
                ForEach(entries.prefix(10)) { entry in
                    HistoryRow(entry: entry, unit: unit, onDelete: { onDelete(entry) })

                    if entry.id != entries.prefix(10).last?.id {
                        Divider()
                    }
                }
            }
            .padding(.horizontal, 14)
            .background(AppTheme.surface.opacity(0.96))
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(AppTheme.ink.opacity(0.06), lineWidth: 1)
            }
            .shadow(color: AppTheme.shadow(opacity: 0.06), radius: 12, x: 0, y: 6)
        }
    }
}

private struct HistoryRow: View {
    let entry: WeightEntry
    let unit: WeightUnit
    let onDelete: () -> Void

    private var dateText: String {
        entry.date.formatted(date: .abbreviated, time: .omitted)
    }

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(AppTheme.teal.opacity(0.12))
                Circle()
                    .fill(AppTheme.teal)
                    .frame(width: 8, height: 8)
            }
            .frame(width: 22, height: 22)

            VStack(alignment: .leading, spacing: 3) {
                Text(dateText)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(AppTheme.ink)
                if !entry.note.isEmpty {
                    Text(entry.note)
                        .font(.caption)
                        .foregroundStyle(AppTheme.muted)
                        .lineLimit(1)
                }
            }

            Spacer()

            Text(unit.formattedWeight(entry.weightKg))
                .font(.subheadline.weight(.heavy))
                .foregroundStyle(AppTheme.ink)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(AppTheme.surfaceAlt)
                .clipShape(Capsule())

            Button(role: .destructive, action: onDelete) {
                Image(systemName: "trash")
                    .font(.caption.weight(.bold))
                    .frame(width: 28, height: 28)
                    .background(AppTheme.coral.opacity(0.10))
                    .clipShape(Circle())
            }
            .buttonStyle(.borderless)
            .accessibilityLabel(Text("history.delete"))
        }
        .padding(.vertical, 12)
    }
}
