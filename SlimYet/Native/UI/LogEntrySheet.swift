import SwiftUI

struct LogEntrySheet: View {
    @Environment(NativeStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let showActualWeight: Bool
    var editing: CloudLog?
    @State private var weight = ""
    @State private var date = Date()
    @State private var note = ""
    @State private var unit = WeightUnit.kilogram
    @State private var busy = false
    @State private var error: String?
    @State private var confirmReplace = false
    @FocusState private var focused: Bool

    private var kilograms: Double? { ChartMath.validKilograms(weight, pounds: unit == .pound) }
    private var existing: CloudLog? { store.personal?.logs.first { $0.recordedOn == Day.string(date) } }

    var body: some View {
        NavigationStack {
            if let receipt = store.receipt {
                SavedCheckInView(receipt: receipt, showActualWeight: showActualWeight) {
                    store.receipt = nil
                    dismiss()
                }.interactiveDismissDisabled()
            } else {
                Form {
                    Section {
                        HStack(alignment: .firstTextBaseline) {
                            TextField("0.0", text: $weight).keyboardType(.decimalPad).focused($focused)
                                .font(.system(size: 46, weight: .bold, design: .rounded)).monospacedDigit()
                                .minimumScaleFactor(0.5).accessibilityLabel(store.text("Weight in \(unit.symbol)", "体重（\(unit.symbol)）"))
                                .accessibilityIdentifier("log.weight")
                            Text(unit.symbol).font(.title3.bold()).foregroundStyle(.secondary)
                        }.padding(.vertical, 12)
                        Picker(store.text("Unit", "单位"), selection: $unit) {
                            Text("kg").tag(WeightUnit.kilogram)
                            Text("lb").tag(WeightUnit.pound)
                        }.pickerStyle(.segmented)
                    } header: { Text(store.text("Today's check-in", "记录一下今天的自己")) }
                    Section {
                        DatePicker(store.text("Date", "日期"), selection: $date, in: ...Date(), displayedComponents: .date)
                            .disabled(editing != nil)
                        TextField(store.text("A note for yourself (optional)", "给自己留个备注（可选）"), text: $note, axis: .vertical).lineLimit(2...4)
                    } footer: {
                        Text(store.text("Your real weight stays private. Group members only see the change from each group's baseline.", "真实体重仅自己可见，小组成员只会看到相对各组基准的变化。"))
                    }
                    if let error { Section { Text(error).foregroundStyle(.red) } }
                    Section {
                        Button {
                            focused = false
                            if existing != nil { confirmReplace = true } else { Task { await save() } }
                        } label: {
                            HStack {
                                if busy { ProgressView() } else { Image(systemName: "checkmark") }
                                Text(store.text("Save check-in", "保存记录")).font(.headline)
                            }.frame(maxWidth: .infinity, minHeight: 34)
                        }.buttonStyle(.borderedProminent).disabled(kilograms == nil || busy)
                            .accessibilityIdentifier("log.save")
                    }
                }
                .navigationTitle(store.text(editing == nil ? "Log weight" : "Edit check-in", editing == nil ? "记录体重" : "修改记录"))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button(store.text("Cancel", "取消")) { dismiss() }.disabled(busy) } }
                .interactiveDismissDisabled(busy)
                .confirmationDialog(store.text("Replace this day's check-in?", "替换当天的记录？"), isPresented: $confirmReplace, titleVisibility: .visible) {
                    Button(store.text("Update check-in", "更新当天记录")) { Task { await save() } }
                } message: { Text(store.text("There is already a weight for this date. Its record and every group's trend will update.", "这一天已有记录。保存后将更新当天记录，以及所有小组的变化趋势。")) }
                .onChange(of: unit) { old, new in
                    if let number = weight.decimalValue {
                        weight = String(format: "%.1f", new.displayValue(fromKilograms: old.kilograms(fromDisplayValue: number)))
                    }
                }
            }
        }
        .onAppear {
            store.receipt = nil
            unit = store.unit
            if let editing {
                weight = String(format: "%.1f", unit.displayValue(fromKilograms: editing.weightKg))
                date = editing.date
                note = editing.note ?? ""
            }
            focused = true
        }
        .onDisappear { store.receipt = nil }
    }

    private func save() async {
        guard let kg = kilograms, !busy else { return }
        busy = true
        error = nil
        defer { busy = false }
        do { try await store.saveWeight(kg: kg, date: Day.string(date), note: String(note.prefix(500))) }
        catch { self.error = error.localizedDescription }
    }
}

struct SavedCheckInView: View {
    @Environment(NativeStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let receipt: SaveReceipt
    let showActualWeight: Bool
    let close: () -> Void
    @State private var appeared = false
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                ZStack {
                    if receipt.milestone != nil && !reduceMotion {
                        ForEach(0..<24, id: \.self) { index in
                            Capsule().fill(NativePalette.colors[index % NativePalette.colors.count])
                                .frame(width: 5, height: index % 2 == 0 ? 12 : 6)
                                .offset(y: appeared ? -100 : -20)
                                .rotationEffect(.degrees(Double(index) * 15))
                                .opacity(appeared ? 0 : 1)
                                .animation(.easeOut(duration: 2.4).delay(Double(index % 4) * 0.1).repeatCount(2, autoreverses: false), value: appeared)
                        }.accessibilityHidden(true)
                    }
                    Image(systemName: receipt.milestone == nil ? "checkmark.circle.fill" : "trophy.fill")
                        .font(.system(size: 66)).foregroundStyle(receipt.milestone == nil ? NativePalette.teal : .orange)
                        .symbolEffect(.bounce, value: appeared)
                }.frame(height: 130)
                Text(title).font(.largeTitle.bold()).multilineTextAlignment(.center)
                Text(store.text("You showed up for yourself. That counts.", "认真记录自己，就已经很棒。"))
                    .foregroundStyle(.secondary).multilineTextAlignment(.center)
                if showActualWeight {
                    Text(store.weight(receipt.weightKg)).font(.largeTitle.weight(.semibold)).monospacedDigit()
                    if let previous = receipt.previousKg {
                        Text(store.text("Previous: ", "上次：") + store.weight(previous) + " · " + store.delta(receipt.weightKg - previous))
                            .font(.subheadline).foregroundStyle(.secondary)
                    }
                }
                ForEach(Array(receipt.groupDeltas.enumerated()), id: \.offset) { _, result in
                    HStack {
                        Text(result.name).font(.headline)
                        Spacer()
                        Text(store.delta(result.delta)).font(.title3.bold()).foregroundStyle(NativePalette.teal)
                    }.padding(.vertical, 4)
                }
                Button(action: close) { Text(store.text("Done", "完成")).font(.headline).frame(maxWidth: .infinity, minHeight: 44) }
                    .buttonStyle(.borderedProminent).accessibilityIdentifier("log.done")
            }.padding(28)
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button(action: close) { Image(systemName: "xmark") }.accessibilityLabel(store.text("Close", "关闭")) } }
        .onAppear { appeared = true }
    }
    private var title: String {
        switch receipt.milestone {
        case .allTime: store.text("A new personal best!", "新的个人最佳！")
        case .year: store.text("Your lowest this year!", "今年的新低！")
        case .month: store.text("Your lowest this month!", "本月的新低！")
        case .week: store.text("Your lowest this week!", "本周的新低！")
        case nil: store.text("Check-in saved", "记录成功")
        }
    }
}
