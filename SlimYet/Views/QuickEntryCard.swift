import SwiftUI

struct QuickEntryCard: View {
    @Binding var draft: WeightDraft
    let unit: WeightUnit
    let savePulse: Bool
    let onSave: () -> Void

    private var canSave: Bool {
        guard let value = draft.weightText.decimalValue else { return false }
        return value > 0
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .center, spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(AppTheme.teal.opacity(0.12))
                    Image(systemName: "plus.circle.fill")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(AppTheme.teal)
                }
                .frame(width: 42, height: 42)

                VStack(alignment: .leading, spacing: 2) {
                    Text("entry.title")
                        .font(.headline)
                        .foregroundStyle(AppTheme.ink)
                    Text("entry.subtitle")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(AppTheme.muted)
                }

                Spacer()

                DatePicker("entry.date", selection: $draft.date, displayedComponents: .date)
                    .labelsHidden()
                    .datePickerStyle(.compact)
            }

            HStack(spacing: 10) {
                TextField("entry.weight.placeholder", text: $draft.weightText)
                    .keyboardType(.decimalPad)
                    .font(.system(size: 42, weight: .black, design: .rounded))
                    .textFieldStyle(.plain)
                    .minimumScaleFactor(0.75)

                Text(unit.symbol)
                    .font(.title3.weight(.heavy))
                    .foregroundStyle(AppTheme.teal)
                    .frame(width: 32, alignment: .trailing)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
            .background {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(AppTheme.surfaceAlt)
                    .overlay(alignment: .topTrailing) {
                        Image(systemName: "sparkles")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(AppTheme.lemon)
                            .padding(10)
                            .opacity(canSave ? 1 : 0.45)
                    }
            }
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(canSave ? AppTheme.teal.opacity(0.28) : AppTheme.ink.opacity(0.06), lineWidth: 1)
            }

            TextField("entry.note.placeholder", text: $draft.note, axis: .vertical)
                .lineLimit(1...3)
                .textFieldStyle(.roundedBorder)

            Button(action: onSave) {
                Label("entry.save", systemImage: savePulse ? "checkmark.seal.fill" : "sparkles")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(canSave ? AppTheme.teal : AppTheme.muted)
            .disabled(!canSave)
            .controlSize(.large)
        }
        .padding(17)
        .background {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(AppTheme.surface.opacity(0.96))
                .overlay(alignment: .top) {
                    Rectangle()
                        .fill(AppTheme.celebrationGradient)
                        .frame(height: 4)
                }
        }
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(.white.opacity(0.72), lineWidth: 1)
        }
        .shadow(color: AppTheme.shadow(opacity: 0.10), radius: 18, x: 0, y: 10)
    }
}
