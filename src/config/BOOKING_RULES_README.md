# Booking Rules Configuration

This is the **centralized source of truth** for all time and booking rules in the SportsArena backend.

## Purpose

This configuration layer separates **policy** (what the rules are) from **business logic** (how they're implemented). All services must import and use these constants to ensure consistency across the entire system.

## Import Pattern

Import the configuration in any service, controller, or utility file:

```javascript
const bookingRules = require('../config/bookingRules');

// Or destructure specific constants/functions
const {
  TIME_GRANULARITY_MINUTES,
  MIN_BOOKING_DURATION_HOURS,
  isValidStartTime,
  validateBookingTimeRange
} = require('../config/bookingRules');
```

## Usage Examples

### Example 1: Validating a Start Time

```javascript
const { isValidStartTime } = require('../config/bookingRules');

function createTimeSlot(startTime) {
  if (!isValidStartTime(startTime)) {
    throw new Error('Start time must be on the hour or half-hour');
  }
  // ... rest of logic
}
```

### Example 2: Validating Booking Duration

```javascript
const { isValidDuration, MIN_BOOKING_DURATION_HOURS } = require('../config/bookingRules');

function validateBookingRequest(durationHours, facilityMaxDuration) {
  if (!isValidDuration(durationHours, facilityMaxDuration)) {
    throw new Error(
      `Duration must be between ${MIN_BOOKING_DURATION_HOURS} hours and ${facilityMaxDuration} hours`
    );
  }
}
```

### Example 3: Validating Complete Booking Range

```javascript
const { validateBookingTimeRange } = require('../config/bookingRules');

function createBooking(startTime, endTime, facility) {
  const validation = validateBookingTimeRange(startTime, endTime, {
    maxDurationHours: facility.maxBookingDurationHours,
    maxAdvanceDays: facility.maxAdvanceBookingDays || 30
  });
  
  if (!validation.isValid) {
    throw new Error(validation.errors.join(', '));
  }
  
  // ... proceed with booking creation
}
```

### Example 4: Rounding Times to Valid Granularity

```javascript
const { roundUpToGranularity } = require('../config/bookingRules');

function processUserTimeInput(userInputTime) {
  // Round user input to nearest valid time slot
  return roundUpToGranularity(new Date(userInputTime));
}
```

### Example 5: Checking Advance Booking Window

```javascript
const { isWithinAdvanceBookingWindow } = require('../config/bookingRules');

function canBookAtTime(startTime, facility) {
  const maxDays = facility.maxAdvanceBookingDays || 30;
  return isWithinAdvanceBookingWindow(startTime, maxDays);
}
```

## Where to Import

Import this configuration in:

- **Services** (`src/services/*.js`) - Business logic validation
- **Controllers** (`src/controllers/*.js`) - Request validation
- **Models** (`src/models/*.js`) - Data validation before database operations
- **Utilities** (`src/utils/*.js`) - Shared validation helpers
- **Middleware** (`src/middleware/*.js`) - Request-level validation

## Key Rules Summary

| Rule | Value | Notes |
|------|-------|-------|
| Time Granularity | 30 minutes | All times must align to this |
| Odd Start Times | Not allowed | Only :00 and :30 allowed |
| Min Booking Duration | 30 minutes | Cannot book less than this |
| Max Booking Duration | Configurable per facility | Default: 8 hours |
| Max Advance Booking | 30 days (default) | Configurable per facility |
| Custom Durations | Allowed | Must be in 30-min increments (0.5h, 1h, 1.5h, etc.) |

## Important Notes

1. **Never hardcode these values** - Always import from this file
2. **Facility-specific overrides** - Some rules (max duration, advance window) can be overridden per facility
3. **Policy vs Logic** - This file defines policy; services implement the logic
4. **Single Source of Truth** - Changes here affect the entire system

## Future Extensions

When adding new rules:
1. Add constants at the top
2. Add validation functions if needed
3. Update this README
4. Ensure all services use the new constants

