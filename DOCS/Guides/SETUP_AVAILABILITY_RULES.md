# Setting Up Availability Rules

## Problem: No Availability Showing

If you're getting empty blocks (`blocks: []`) for all dates, it means **no availability rules are configured** for the court.

## Solution: Create Availability Rules

Availability rules define when a court is available. You need to create rules for each day of the week.

### Day of Week Values

- `0` = Sunday
- `1` = Monday
- `2` = Tuesday
- `3` = Wednesday
- `4` = Thursday
- `5` = Friday
- `6` = Saturday

### Time Format

Times are stored as **minutes since midnight**:
- `540` = 09:00 (9 AM)
- `1080` = 18:00 (6 PM)
- `1440` = 24:00 (midnight)

### Example: Create Rules for Court 1

```sql
-- Monday to Friday: 9 AM to 6 PM
INSERT INTO court_availability_rules (court_id, day_of_week, start_time, end_time, is_active)
VALUES 
  (1, 1, 540, 1080, true),  -- Monday: 09:00-18:00
  (1, 2, 540, 1080, true),  -- Tuesday: 09:00-18:00
  (1, 3, 540, 1080, true),  -- Wednesday: 09:00-18:00
  (1, 4, 540, 1080, true),  -- Thursday: 09:00-18:00
  (1, 5, 540, 1080, true);  -- Friday: 09:00-18:00

-- Weekend: 10 AM to 8 PM
INSERT INTO court_availability_rules (court_id, day_of_week, start_time, end_time, is_active)
VALUES 
  (1, 6, 600, 1200, true),  -- Saturday: 10:00-20:00
  (1, 0, 600, 1200, true);  -- Sunday: 10:00-20:00
```

### Quick Time Conversion

| Time String | Minutes Since Midnight |
|-------------|------------------------|
| 09:00       | 540                    |
| 10:00       | 600                    |
| 12:00       | 720                    |
| 14:00       | 840                    |
| 18:00       | 1080                   |
| 20:00       | 1200                   |

### Verify Rules Created

```sql
SELECT 
  id,
  court_id,
  day_of_week,
  start_time,
  end_time,
  is_active
FROM court_availability_rules
WHERE court_id = 1
ORDER BY day_of_week, start_time;
```

### Using psql

```bash
psql -d sportsarena -c "
INSERT INTO court_availability_rules (court_id, day_of_week, start_time, end_time, is_active)
VALUES 
  (1, 1, 540, 1080, true),
  (1, 2, 540, 1080, true),
  (1, 3, 540, 1080, true),
  (1, 4, 540, 1080, true),
  (1, 5, 540, 1080, true),
  (1, 6, 600, 1200, true),
  (1, 0, 600, 1200, true);
"
```

## After Creating Rules

Once rules are created, the availability API will return blocks:

```json
{
  "blocks": [
    {
      "startTime": 540,
      "endTime": 570,
      "startTimeFormatted": "09:00",
      "endTimeFormatted": "09:30"
    },
    {
      "startTime": 570,
      "endTime": 600,
      "startTimeFormatted": "09:30",
      "endTimeFormatted": "10:00"
    }
    // ... more blocks
  ]
}
```

## Managing Availability Rules via API

Availability rules can be managed via admin API endpoints. See the [Availability Rules API Guide](../API/AVAILABILITY_RULES_API_GUIDE.md) for complete documentation:

- `GET /api/v1/courts/:id/availability/rules` - List rules
- `POST /api/v1/courts/:id/availability/rules` - Create rule
- `PUT /api/v1/courts/:id/availability/rules/:ruleId` - Update rule
- `DELETE /api/v1/courts/:id/availability/rules/:ruleId` - Delete rule

**Note:** These endpoints require authentication and facility_admin role (must be facility owner).

