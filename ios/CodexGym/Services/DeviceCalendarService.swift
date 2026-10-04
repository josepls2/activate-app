import EventKit
import Foundation

enum DeviceCalendarService {
    static func add(_ session: GymSession) async -> String {
        let eventStore = EKEventStore()
        do {
            guard try await eventStore.requestFullAccessToEvents() else {
                return "Permite el acceso al calendario desde Ajustes."
            }
            guard let startDate = combinedDate(
                day: session.date,
                time: session.time
            ) else {
                return "No se ha podido interpretar la fecha de la sesión."
            }

            let event = EKEvent(eventStore: eventStore)
            event.title = session.type
            event.startDate = startDate
            event.endDate = startDate.addingTimeInterval(
                TimeInterval(session.duration * 60)
            )
            event.location = "Activate Personal Training · \(session.room)"
            event.notes = "Entrenador: \(session.trainerName)"
            event.calendar = eventStore.defaultCalendarForNewEvents
            try eventStore.save(event, span: .thisEvent)
            return "Añadido al calendario"
        } catch {
            return "No se ha podido añadir al calendario."
        }
    }

    private static func combinedDate(day: Date, time: String) -> Date? {
        let values = time.split(separator: ":").compactMap { Int($0) }
        guard values.count == 2 else { return nil }
        return Calendar.current.date(
            bySettingHour: values[0],
            minute: values[1],
            second: 0,
            of: day
        )
    }
}
