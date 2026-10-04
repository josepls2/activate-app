import SwiftUI

struct ChatView: View {
    @EnvironmentObject private var store: AppStore
    @State private var messageText = ""

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(T.red.opacity(0.16))
                    Image(systemName: "person.crop.circle.fill")
                        .font(.title2)
                        .foregroundStyle(T.redLight)
                }
                .frame(width: 42, height: 42)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Equipo Activate")
                        .font(.headline)
                    Label("Conversación privada", systemImage: "lock.fill")
                        .font(.caption2)
                        .foregroundStyle(T.muted)
                }
                Spacer()
                Image(systemName: "lock.fill")
                    .font(.caption)
                    .foregroundStyle(T.muted)
                    .accessibilityLabel("Conversación privada")
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
            .background(T.card)

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        Text("HOY")
                            .font(.caption2.bold())
                            .foregroundStyle(T.muted)
                            .padding(.vertical, 8)
                        ForEach(store.messages) { message in
                            ChatBubble(message: message)
                                .id(message.id)
                        }
                    }
                    .padding(16)
                }
                .onChange(of: store.messages.count) {
                    if let last = store.messages.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }

            if store.currentUser?.role == .client {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        SuggestionChip(text: "¿Cuántas sesiones me quedan?") {
                            send("¿Cuántas sesiones me quedan?")
                        }
                        SuggestionChip(text: "¿Cuál es mi próxima sesión?") {
                            send("¿Cuál es mi próxima sesión?")
                        }
                        SuggestionChip(text: "Horario del gimnasio") {
                            send("Horario del gimnasio")
                        }
                    }
                    .padding(.horizontal, 16)
                }
                .padding(.vertical, 8)
            }

            HStack(spacing: 10) {
                TextField("Escribe un mensaje…", text: $messageText, axis: .vertical)
                    .lineLimit(1...4)
                    .padding(.horizontal, 15)
                    .padding(.vertical, 12)
                    .background(T.card2)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                Button {
                    send(messageText)
                } label: {
                    Image(systemName: "paperplane.fill")
                        .font(.headline)
                        .foregroundStyle(.white)
                        .frame(width: 44, height: 44)
                        .background(messageText.isEmpty ? T.card3 : T.red)
                        .clipShape(Circle())
                }
                .disabled(messageText.trimmingCharacters(in: .whitespaces).isEmpty)
                .accessibilityLabel("Enviar mensaje")
            }
            .padding(12)
            .background(T.card)
        }
        .background(T.background)
    }

    private func send(_ text: String) {
        store.sendMessage(text)
        messageText = ""
    }
}

private struct ChatBubble: View {
    let message: ChatMessage

    private var isUser: Bool { message.author == .user }

    var body: some View {
        HStack(alignment: .bottom) {
            if isUser { Spacer(minLength: 54) }
            if message.author == .ai {
                Image(systemName: "sparkles")
                    .font(.caption.bold())
                    .foregroundStyle(T.purple)
                    .frame(width: 24, height: 24)
                    .background(T.purple.opacity(0.14))
                    .clipShape(Circle())
            }
            VStack(alignment: isUser ? .trailing : .leading, spacing: 5) {
                if message.author == .ai {
                    Text("SOPORTE IA")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(T.purple)
                }
                Text(message.text)
                    .font(.subheadline)
                    .foregroundStyle(T.text)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 11)
                    .background(
                        isUser
                            ? T.red
                            : (message.author == .ai ? T.purple.opacity(0.14) : T.card2)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                Text(
                    message.timestamp.formatted(
                        .dateTime.hour().minute().locale(Locale(identifier: "es_ES"))
                    )
                )
                .font(.system(size: 9))
                .foregroundStyle(T.muted)
            }
            if !isUser { Spacer(minLength: 54) }
        }
    }
}

private struct SuggestionChip: View {
    let text: String
    let action: () -> Void

    var body: some View {
        Button(text, action: action)
            .font(.caption.bold())
            .foregroundStyle(T.text2)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(T.card2)
            .clipShape(Capsule())
            .overlay { Capsule().stroke(T.border) }
    }
}
