import XCTest
@testable import CodexGym

@MainActor
final class AppStoreTests: XCTestCase {
    private let testDate = Calendar(identifier: .gregorian).date(
        from: DateComponents(year: 2026, month: 8, day: 31)
    )!

    func testClientOnlySeesOwnSessionsAndBookings() {
        let store = AppStore()
        store.currentUser = user(id: "client-1", role: .client)
        store.sessions = [
            session(id: "session-own", clientId: "client-1", trainerId: "trainer-1"),
            session(id: "session-other", clientId: "client-2", trainerId: "trainer-1"),
        ]
        store.bookings = [
            booking(id: "booking-own", clientId: "client-1", trainerId: "trainer-1"),
            booking(id: "booking-other", clientId: "client-2", trainerId: "trainer-1"),
        ]

        XCTAssertEqual(store.visibleSessions.map(\.id), ["session-own"])
        XCTAssertEqual(store.visibleBookings.map(\.id), ["booking-own"])
    }

    func testTrainerOnlySeesAssignedSessionsAndBookings() {
        let store = AppStore()
        store.currentUser = user(id: "trainer-1", role: .trainer)
        store.sessions = [
            session(id: "session-own", clientId: "client-1", trainerId: "trainer-1"),
            session(id: "session-other", clientId: "client-2", trainerId: "trainer-2"),
        ]
        store.bookings = [
            booking(id: "booking-own", clientId: "client-1", trainerId: "trainer-1"),
            booking(id: "booking-other", clientId: "client-2", trainerId: "trainer-2"),
        ]

        XCTAssertEqual(store.visibleSessions.map(\.id), ["session-own"])
        XCTAssertEqual(store.visibleBookings.map(\.id), ["booking-own"])
    }

    func testDirectionSeesAllSessionsAndBookings() {
        let store = AppStore()
        store.currentUser = user(id: "boss-1", role: .boss)
        store.sessions = [
            session(id: "session-1", clientId: "client-1", trainerId: "trainer-1"),
            session(id: "session-2", clientId: "client-2", trainerId: "trainer-2"),
        ]
        store.bookings = [
            booking(id: "booking-1", clientId: "client-1", trainerId: "trainer-1"),
            booking(id: "booking-2", clientId: "client-2", trainerId: "trainer-2"),
        ]

        XCTAssertEqual(Set(store.visibleSessions.map(\.id)), ["session-1", "session-2"])
        XCTAssertEqual(Set(store.visibleBookings.map(\.id)), ["booking-1", "booking-2"])
    }

    func testCycleTabOnlyAppearsForEnabledClient() {
        let store = AppStore()
        store.currentUser = user(id: "client-1", role: .client)

        XCTAssertFalse(store.availableTabs.contains(.cycle))

        var enabledClient = user(id: "client-1", role: .client)
        enabledClient.cycleTrackingEnabled = true
        store.currentUser = enabledClient

        XCTAssertTrue(store.availableTabs.contains(.cycle))
    }

    func testRoomOverlapAndAdjacentSlotRules() {
        let store = AppStore()
        store.occupiedSlots = [
            OccupiedSlot(
                id: "occupied-1",
                date: testDate,
                time: "09:00",
                duration: 60,
                room: "Sala de arriba",
                trainerId: "trainer-1"
            )
        ]

        XCTAssertTrue(
            store.isSlotOccupied(
                date: testDate,
                time: "09:30",
                duration: 45,
                room: "Sala de arriba",
                trainerId: nil
            )
        )
        XCTAssertFalse(
            store.isSlotOccupied(
                date: testDate,
                time: "10:00",
                duration: 45,
                room: "Sala de arriba",
                trainerId: nil
            )
        )
    }

    func testTrainerOverlapBlocksDifferentRoom() {
        let store = AppStore()
        store.occupiedSlots = [
            OccupiedSlot(
                id: "occupied-1",
                date: testDate,
                time: "09:00",
                duration: 60,
                room: "Sala de arriba",
                trainerId: "trainer-1"
            )
        ]

        XCTAssertTrue(
            store.isSlotOccupied(
                date: testDate,
                time: "09:30",
                duration: 45,
                room: "Sala de abajo",
                trainerId: "trainer-1"
            )
        )
        XCTAssertFalse(
            store.isSlotOccupied(
                date: testDate,
                time: "09:30",
                duration: 45,
                room: "Sala de abajo",
                trainerId: "trainer-2"
            )
        )
    }

    func testPackBalanceUsesCurrentFirebaseModel() {
        let store = AppStore()
        store.activePack = TrainingPack(
            id: "pack-1",
            name: "Pack 10 · 45 min",
            totalSessions: 10,
            usedSessions: 4,
            reservedSessions: 2,
            remainingSessions: 4,
            duration: 45
        )

        XCTAssertEqual(store.remainingSessions, 4)
        XCTAssertEqual(store.activePack.progress, 0.4, accuracy: 0.0001)
    }

    func testFortyFiveMinuteBookingsUseFortyFiveMinuteIntervals() {
        let slots = BookingTimeSlots.values(duration: 45)

        XCTAssertEqual(Array(slots.prefix(5)), [
            "07:00", "07:45", "08:30", "09:15", "10:00",
        ])
        XCTAssertFalse(slots.contains("07:30"))
        XCTAssertEqual(slots.last, "20:30")
    }

    func testSixtyMinuteBookingsUseHourlyIntervals() {
        let slots = BookingTimeSlots.values(duration: 60)

        XCTAssertEqual(Array(slots.prefix(4)), [
            "07:00", "08:00", "09:00", "10:00",
        ])
        XCTAssertFalse(slots.contains("07:45"))
        XCTAssertEqual(slots.last, "21:00")
    }

    func testLegacyTimeIsAlignedToTheNearestValidInterval() {
        XCTAssertEqual(
            BookingTimeSlots.normalizedTime("09:00", duration: 45),
            "09:15"
        )
        XCTAssertEqual(
            BookingTimeSlots.normalizedTime("09:30", duration: 60),
            "09:00"
        )
    }

    private func user(id: String, role: UserRole) -> AppUser {
        AppUser(
            id: id,
            email: "\(id)@example.com",
            name: id,
            role: role,
            trainerIds: role == .client ? ["trainer-1"] : [],
            phone: ""
        )
    }

    private func session(
        id: String,
        clientId: String,
        trainerId: String
    ) -> GymSession {
        GymSession(
            id: id,
            date: testDate,
            time: "09:00",
            duration: 45,
            clientId: clientId,
            clientName: clientId,
            trainerId: trainerId,
            trainerName: trainerId,
            type: "Fuerza",
            room: "Sala de arriba",
            status: .confirmed
        )
    }

    private func booking(
        id: String,
        clientId: String,
        trainerId: String
    ) -> BookingRequest {
        BookingRequest(
            id: id,
            clientId: clientId,
            clientName: clientId,
            trainerId: trainerId,
            trainerName: trainerId,
            requestedDate: testDate,
            requestedTime: "09:00",
            type: "Fuerza",
            duration: 45,
            room: "Sala de arriba",
            status: .pendingTrainer
        )
    }
}
