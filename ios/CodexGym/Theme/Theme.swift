import SwiftUI

enum T {
    static let red = Color(red: 0.88, green: 0.08, blue: 0.13)
    static let redLight = Color(red: 1, green: 0.12, blue: 0.18)
    static let redDark = Color(red: 0.62, green: 0.03, blue: 0.07)
    static let background = Color.black
    static let card = Color(red: 0.11, green: 0.11, blue: 0.12)
    static let card2 = Color(red: 0.17, green: 0.17, blue: 0.18)
    static let card3 = Color(red: 0.23, green: 0.23, blue: 0.24)
    static let text = Color.white
    static let text2 = Color.white.opacity(0.82)
    static let muted = Color(red: 0.56, green: 0.56, blue: 0.58)
    static let green = Color(red: 0.19, green: 0.82, blue: 0.34)
    static let orange = Color(red: 1, green: 0.62, blue: 0.04)
    static let error = Color(red: 1, green: 0.27, blue: 0.23)
    static let blue = Color(red: 0.04, green: 0.52, blue: 1)
    static let purple = Color(red: 0.75, green: 0.35, blue: 0.95)
    static let border = Color.white.opacity(0.1)
}

extension SessionStatus {
    var color: Color {
        switch self {
        case .confirmed: T.green
        case .pending: T.orange
        case .completed: T.blue
        case .cancelled: T.error
        }
    }
}

extension BookingStatus {
    var color: Color {
        switch self {
        case .pendingTrainer: T.blue
        case .pendingBoss: T.orange
        case .confirmed: T.green
        case .rejected: T.error
        }
    }
}

extension Date {
    func formattedGymDate() -> String {
        formatted(
            .dateTime
                .locale(Locale(identifier: "es_ES"))
                .weekday(.wide)
                .day()
                .month(.wide)
        )
    }

    func shortGymDate() -> String {
        formatted(
            .dateTime
                .locale(Locale(identifier: "es_ES"))
                .day()
                .month(.abbreviated)
        )
    }

    var firestoreDay: String {
        ISO8601DateFormatter.gymDay.string(from: self)
    }
}

extension ISO8601DateFormatter {
    static let gymDay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

struct CardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(16)
            .background(T.card)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(T.border, lineWidth: 1)
            }
    }
}

extension View {
    func gymCard() -> some View {
        modifier(CardModifier())
    }
}
