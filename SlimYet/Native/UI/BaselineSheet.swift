import SwiftUI

struct BaselineSheet: View {
    @Environment(NativeStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let group: CloudGroup
    let ready: Bool
    @State private var weight = ""
    @State private var date = Date()
    @State private var unit = WeightUnit.kilogram
    @State private var confirm = false
    @State private var logInstead = false
    @State private var busy = false
    @State private var error: String?
    @State private var useRecord: String = ""
    private var kg: Double? { ChartMath.validKilograms(weight, pounds: unit == .pound) }
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Label(group.name, systemImage: "person.2.fill").font(.headline)
                    Label(ready ? store.text("Private baseline is set", "已设置私密基准") : store.text("Set your starting point", "设置起点"), systemImage: "lock.fill").foregroundStyle(.secondary)
                } footer: { Text(store.text("This starting point is only for this group. Other groups keep their own baselines.", "这个基准只用于当前小组，其他小组的基准不变。")) }
                if let logs = store.personal?.logs, !logs.isEmpty {
                    Section {
                        Picker(store.text("Choose a check-in", "选择已有记录"), selection: $useRecord) {
                            Text(store.text("Enter manually", "手动输入")).tag("")
                            ForEach(logs.reversed()) { record in
                                Text("\(record.recordedOn) · \(store.weight(record.weightKg))").tag(record.id)
                            }
                        }.onChange(of: useRecord) { _, id in
                            if let record = logs.first(where: { $0.id == id }) {
                                weight = String(format: "%.1f", unit.displayValue(fromKilograms: record.weightKg))
                                date = record.date
                            }
                        }
                    }
                }
                Section {
                    HStack {
                        TextField(store.text("Starting weight", "基准体重"), text: $weight).keyboardType(.decimalPad).font(.title.bold())
                            .accessibilityIdentifier("baseline.weight")
                        Text(unit.symbol).foregroundStyle(.secondary)
                    }.padding(.vertical, 10)
                    Picker(store.text("Unit", "单位"), selection: $unit) {
                        Text("kg").tag(WeightUnit.kilogram)
                        Text("lb").tag(WeightUnit.pound)
                    }.pickerStyle(.segmented)
                    DatePicker(store.text("Baseline date", "基准日期"), selection: $date, in: ...Date(), displayedComponents: .date)
                } footer: { Text(store.text("This also saves a personal check-in for the selected date. If one exists, it will be replaced.", "基准也会保存为所选日期的个人记录。当天已有记录时，将会替换。")) }
                if let error { Text(error).foregroundStyle(.red) }
                Button { confirm = true } label: {
                    HStack {
                        if busy { ProgressView() }
                        Text(store.text(ready ? "Update this group's baseline" : "Set private baseline", ready ? "更新本组基准" : "设置私密基准"))
                    }.frame(maxWidth: .infinity, minHeight: 34)
                }.buttonStyle(.borderedProminent).disabled(kg == nil || busy)
            }
            .navigationTitle(store.text("Private baseline", "私密基准"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(store.text("Cancel", "取消")) { dismiss() }.disabled(busy) } }
            .confirmationDialog(store.text("Change your starting point?", "确认修改起点？"), isPresented: $confirm, titleVisibility: .visible) {
                Button(store.text("Update baseline", "确认更新基准"), role: .destructive) { Task { await save() } }
                Button(store.text("I meant to log weight", "我只是想记录新体重")) { logInstead = true }
                Button(store.text("Cancel", "取消"), role: .cancel) { }
            } message: { Text(store.text("Your entire delta history in \(group.name) will be recalculated. The chosen day's private weight record will also update.", "将重新计算「\(group.name)」里的全部变化记录，并更新所选日期的个人体重记录。")) }
            .sheet(isPresented: $logInstead) { LogEntrySheet(showActualWeight: false) }
            .onAppear { unit = store.unit }
            .onChange(of: unit) { old, new in
                if let value = weight.decimalValue { weight = String(format: "%.1f", new.displayValue(fromKilograms: old.kilograms(fromDisplayValue: value))) }
            }
            .interactiveDismissDisabled(busy)
        }
    }
    private func save() async {
        guard let kg, !busy else { return }
        busy = true
        defer { busy = false }
        do {
            try await store.client().mutate("/api/groups/\(group.id)/base", method: "PATCH", values: ["baseWeightKg": kg, "baseDate": Day.string(date)])
            await store.refresh(force: true)
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}
