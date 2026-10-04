import SwiftUI

struct CycleView: View {
    @EnvironmentObject private var store: AppStore
    @State private var selectedDate = Date.now
    @State private var entry =
        CycleEntry(flow: .none, symptoms: [], mood: "🙂", notes: "")
    @State private var sharingEnabled = false

    private let symptoms = [
        "Dolor", "Fatiga", "Hinchazón", "Dolor de cabeza", "Buen ánimo",
    ]
    private let moods = ["😔", "😐", "🙂", "😊", "⚡️"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ScreenHeader(
                    eyebrow: "Bienestar",
                    title: "Mi ciclo",
                    subtitle: "Registro privado y bajo tu control"
                )

                DatePicker(
                    "Fecha",
                    selection: $selectedDate,
                    displayedComponents: .date
                )
                .datePickerStyle(.graphical)
                .tint(T.red)
                .padding(8)
                .background(T.card)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .onChange(of: selectedDate) {
                    entry = store.cycleEntry(for: selectedDate)
                }

                VStack(alignment: .leading, spacing: 13) {
                    SectionTitle(title: "Flujo")
                    HStack(spacing: 8) {
                        ForEach(CycleFlow.allCases) { flow in
                            Button {
                                entry.flow = flow
                            } label: {
                                Text(flow.label)
                                    .font(.caption.bold())
                                    .foregroundStyle(entry.flow == flow ? .white : T.text2)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 11)
                                    .background(entry.flow == flow ? T.red : T.card2)
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                            }
                        }
                    }
                }
                .gymCard()

                VStack(alignment: .leading, spacing: 13) {
                    SectionTitle(title: "¿Cómo te sientes?")
                    LazyVGrid(
                        columns: [GridItem(.adaptive(minimum: 120))],
                        spacing: 9
                    ) {
                        ForEach(symptoms, id: \.self) { symptom in
                            Button {
                                if entry.symptoms.contains(symptom) {
                                    entry.symptoms.remove(symptom)
                                } else {
                                    entry.symptoms.insert(symptom)
                                }
                            } label: {
                                Label(
                                    symptom,
                                    systemImage: entry.symptoms.contains(symptom)
                                        ? "checkmark.circle.fill"
                                        : "circle"
                                )
                                .font(.caption.bold())
                                .foregroundStyle(
                                    entry.symptoms.contains(symptom)
                                        ? T.redLight
                                        : T.text2
                                )
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(10)
                                .background(T.card2)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                            }
                        }
                    }

                    HStack {
                        ForEach(moods, id: \.self) { mood in
                            Button(mood) { entry.mood = mood }
                                .font(.title2)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                                .background(entry.mood == mood ? T.red.opacity(0.2) : T.card2)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                    }

                    TextEditor(text: $entry.notes)
                        .frame(height: 84)
                        .padding(9)
                        .scrollContentBackground(.hidden)
                        .background(T.card2)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .gymCard()

                Toggle(isOn: $sharingEnabled) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Compartir resumen con mis entrenadores")
                            .font(.subheadline.bold())
                        Text("Nunca se comparten notas privadas.")
                            .font(.caption)
                            .foregroundStyle(T.muted)
                    }
                }
                .tint(T.red)
                .gymCard()

                Button {
                    store.saveCycleEntry(entry, for: selectedDate)
                } label: {
                        Text("Guardar registro")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .frame(minHeight: 50)
                            .background(T.red)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                }
            }
            .padding(20)
            .padding(.bottom, 16)
            .frame(maxWidth: 760)
            .frame(maxWidth: .infinity)
        }
        .onAppear {
            entry = store.cycleEntry(for: selectedDate)
            sharingEnabled =
                store.currentUser?.cycleSharingEnabled ?? false
        }
        .onChange(of: sharingEnabled) {
            store.setCycleSharingEnabled(sharingEnabled)
        }
    }
}
