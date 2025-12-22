/**
 * Court Routes
 * 
 * Following MVP_FULL_ROADMAP.md Step 2: Court Routes
 * 
 * Endpoints:
 * - PUT    /courts/:id   - Update court details (admin)
 * 
 * Note: GET and POST endpoints are nested under facilities:
 * - GET    /facilities/:id/courts - List all courts for a facility
 * - POST   /facilities/:id/courts - Add new court to facility
 * 
 * TimeSlot Routes (nested):
 * - GET    /courts/:id/timeslots - Get all available slots for a court (next 7 days)
 * - POST   /courts/:id/timeslots - Add a new slot manually (facility admin) - DEPRECATED: Use generate-slots instead
 * - POST   /courts/:id/generate-slots - Generate slots automatically based on opening hours (facility admin)
 */

const express = require('express');
const router = express.Router();
const courtController = require('../../controllers/courtController');
const timeSlotController = require('../../controllers/timeSlotController');
const { authenticate } = require('../../middleware/auth');
const { requireFacilityAdmin } = require('../../middleware/authorization');

// Nested TimeSlot routes (must come before /:id route)
router.get('/:id/timeslots', timeSlotController.getCourtTimeSlots);
router.post('/:id/generate-slots', authenticate, requireFacilityAdmin, timeSlotController.generateSlotsForCourt);
router.post('/:id/timeslots', authenticate, requireFacilityAdmin, timeSlotController.createTimeSlot);

// Protected route (authentication and facility_admin role required)
router.put('/:id', authenticate, requireFacilityAdmin, courtController.updateCourt);

module.exports = router;

