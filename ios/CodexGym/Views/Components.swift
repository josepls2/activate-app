import SwiftUI

struct ScreenHeader: View {
    let eyebrow: String
    let title: String
    var subtitle: String?
    var badge: Int?

    var body: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 4) {
                Text(eyebrow.uppercased())
                    .font(.caption2.bold())
                    .tracking(1.2)
                    .foregroundStyle(T.redLight)
                Text(title)
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                    .foregroundStyle(T.text)
                if let subtitle {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(T.muted)
                }
            }
            Spacer()
            if let badge, badge > 0 {
                Text("\(badge)")
                    .font(.caption.bold())
                    .foregroundStyle(.white)
                    .frame(minWidth: 28, minHeight: 28)
                    .background(T.red)
                    .clipShape(Circle())
                    .accessibilityLabel("\(badge) pendientes")
            }
        }
    }
}

struct SectionTitle: View {
    let title: String
    var count: Int?

    var body: some View {
        HStack {
            Text(title)
                .font(.headline)
                .foregroundStyle(T.text)
            if let count {
                Text("\(count)")
                    .font(.caption.bold())
                    .foregroundStyle(T.redLight)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(T.red.opacity(0.12))
                    .clipShape(Capsule())
            }
            Spacer()
        }
    }
}

struct StatusBadge: View {
    let status: SessionStatus

    var body: some View {
        Text(status.label)
            .font(.caption2.bold())
            .foregroundStyle(status.color)
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .background(status.color.opacity(0.14))
            .clipShape(Capsule())
            .accessibilityLabel("Estado: \(status.label)")
    }
}

struct BookingStatusBadge: View {
    let status: BookingStatus

    var body: some View {
        Label(status.label, systemImage: status.icon)
            .font(.caption2.bold())
            .foregroundStyle(status.color)
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .background(status.color.opacity(0.14))
            .clipShape(Capsule())
    }
}

struct SessionCard: View {
    let session: GymSession
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(session.clientName)
                            .font(.headline)
                            .foregroundStyle(T.text)
                        Text("\(session.time) · \(session.duration) min")
                            .font(.subheadline)
                            .foregroundStyle(T.muted)
                    }
                    Spacer()
                    StatusBadge(status: session.status)
                }

                HStack(spacing: 16) {
                    Label(session.trainerName, systemImage: "person.fill")
                    Label(session.room, systemImage: "door.left.hand.closed")
                }
                .font(.caption)
                .foregroundStyle(T.muted)

                if let number = session.packSessionNumber,
                   let total = session.packTotalSessions {
                    Label(
                        "Sesión \(number) de \(total) del pack",
                        systemImage: "number.circle.fill"
                    )
                    .font(.caption.bold())
                    .foregroundStyle(T.redLight)
                }

                if let feedback = session.feedback, !feedback.isEmpty {
                    VStack(alignment: .leading, spacing: 5) {
                        Label("Feedback", systemImage: "quote.bubble.fill")
                            .font(.caption.bold())
                            .foregroundStyle(T.blue)
                        Text(feedback)
                            .font(.caption)
                            .foregroundStyle(T.text2)
                            .lineLimit(2)
                    }
                    .padding(11)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(T.card2)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }
            .gymCard()
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Abre los detalles de la sesión")
    }
}

struct BookingRequestCard: View {
    let request: BookingRequest
    let actionTitle: String?
    let action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(request.clientName)
                        .font(.headline)
                        .foregroundStyle(T.text)
                    Text(
                        "\(request.type) · \(request.duration) min · \(request.requestedDate.shortGymDate())"
                    )
                        .font(.caption)
                        .foregroundStyle(T.muted)
                    Text(request.trainerName)
                        .font(.caption)
                        .foregroundStyle(T.muted)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 6) {
                    BookingStatusBadge(status: request.status)
                    if let time = request.proposedTime ?? request.finalTime {
                        Text(time)
                            .font(.subheadline.bold())
                            .foregroundStyle(T.orange)
                    }
                }
            }

            if let notes = request.trainerNotes, !notes.isEmpty {
                Text("“\(notes)”")
                    .font(.caption.italic())
                    .foregroundStyle(T.text2)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(T.card2)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }

            if let actionTitle {
                Button(action: action) {
                    Text(actionTitle)
                        .font(.subheadline.bold())
                        .foregroundStyle(T.redLight)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .frame(minHeight: 44)
                        .background(T.red.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 11))
                        .overlay {
                            RoundedRectangle(cornerRadius: 11)
                                .stroke(T.red.opacity(0.35))
                        }
                }
            }
        }
        .gymCard()
    }
}

struct RoomOccupancyCard: View {
    let room: GymRoom

    private var percentage: Double {
        min(1, Double(room.reserved) / Double(max(room.capacity, 1)))
    }

    private var color: Color {
        if percentage >= 0.75 { return T.red }
        if percentage >= 0.5 { return T.orange }
        return T.green
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(room.name)
                        .font(.headline)
                        .foregroundStyle(T.text)
                    Text(room.type)
                        .font(.caption)
                        .foregroundStyle(T.muted)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(room.reserved)/\(room.capacity)")
                        .font(.title3.bold())
                        .foregroundStyle(color)
                    Text("franjas ocupadas")
                        .font(.caption2)
                        .foregroundStyle(T.muted)
                }
            }

            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(T.card2)
                    Capsule()
                        .fill(color)
                        .frame(width: proxy.size.width * percentage)
                }
            }
            .frame(height: 6)

            Label(
                "Próxima: \(room.nextTrainer) · \(room.nextTime)",
                systemImage: "clock"
            )
            .font(.caption)
            .foregroundStyle(T.text2)
        }
        .gymCard()
        .accessibilityElement(children: .combine)
    }
}

struct EmptyState: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 30))
                .foregroundStyle(T.muted)
            Text(title)
                .font(.headline)
                .foregroundStyle(T.text)
            Text(message)
                .font(.caption)
                .foregroundStyle(T.muted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
        .gymCard()
    }
}
