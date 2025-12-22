/**
 * TimeSlot Routes
 * 
 * Following MVP_FULL_ROADMAP.md Step 2: TimeSlot Routes
 * 
 * Endpoints:
 * - PUT    /timeslots/:id   - Update/Block slot (e.g., maintenance)
 * 
 * Note: GET and POST endpoints are nested under courts:
 * - GET    /courts/:id/timeslots - Get all available slots for a court (next 7 days)
 * - POST   /courts/:id/timeslots - Add a new slot (facility admin)
 */

const express = require('express');
const router = express.Router();
const timeSlotController = require('../../controllers/timeSlotController');
const { authenticate } = require('../../middleware/auth');
const { requireFacilityAdmin } = require('../../middleware/authorization');

// Protected route (authentication and facility_admin role required)
router.put('/:id', authenticate, requireFacilityAdmin, timeSlotController.updateTimeSlot);

module.exports = router;

