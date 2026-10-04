package com.activatepersonaltraining.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BookingPolicyTest {
    @Test
    fun durationsAreLimitedToPackDurations() {
        assertTrue(BookingPolicy.validDuration(45))
        assertTrue(BookingPolicy.validDuration(60))
        assertFalse(BookingPolicy.validDuration(55))
    }

    @Test
    fun trainerConfirmsAssignedTrainingDirectly() {
        assertTrue(
            BookingPolicy.canTransition(
                BookingStatus.PENDING_TRAINER,
                BookingStatus.CONFIRMED,
            ),
        )
        assertFalse(
            BookingPolicy.canTransition(
                BookingStatus.PENDING_TRAINER,
                BookingStatus.PENDING_BOSS,
            ),
        )
    }

    @Test
    fun overlappingSessionsAreDetected() {
        assertTrue(BookingPolicy.overlaps("09:00", 45, "09:30", 45))
        assertFalse(BookingPolicy.overlaps("09:00", 60, "10:00", 60))
    }
}
