/**
 * Facility Routes
 * 
 * Following MVP_FULL_ROADMAP.md Step 2: Facility Routes
 * 
 * Endpoints:
 * - GET    /facilities       - List all facilities (with optional filters: city, sport)
 * - GET    /facilities/closest - Get top 7 closest arenas based on latitude/longitude
 * - GET    /facilities/:id   - Get details of a facility (photos, courts, opening hours)
 * - POST   /facilities       - Add a facility (only for admin/facility owner)
 * - PUT    /facilities/:id   - Update facility details (admin)
 * 
 * FacilitySport Routes (nested):
 * - GET    /facilities/:id/sports - Get sports offered by a facility
 * - POST   /facilities/:id/sports - Assign sport to a facility (admin/facility owner)
 * 
 * Court Routes (nested):
 * - GET    /facilities/:id/courts - List all courts for a facility
 * - POST   /facilities/:id/courts - Add new court to facility
 */

const express = require('express');
const router = express.Router();
const facilityController = require('../../controllers/facilityController');
const facilitySportController = require('../../controllers/facilitySportController');
const courtController = require('../../controllers/courtController');
const bookingController = require('../../controllers/bookingController');
const { authenticate, optionalAuthenticate } = require('../../middleware/auth');
const { requireFacilityAdmin } = require('../../middleware/authorization');
const { requireCompleteProfile } = require('../../middleware/profileCompleteness');

// Public routes (no authentication required, but check profile completeness if authenticated)
router.get('/', optionalAuthenticate, requireCompleteProfile, facilityController.listFacilities);
router.get('/closest', optionalAuthenticate, requireCompleteProfile, facilityController.getClosestArenas);
router.get('/cities', optionalAuthenticate, requireCompleteProfile, facilityController.getCities);

// Nested FacilitySport routes (must come before /:id route)
router.get('/:id/sports', optionalAuthenticate, requireCompleteProfile, facilitySportController.getFacilitySports);
router.post('/:id/sports', authenticate, requireCompleteProfile, requireFacilityAdmin, facilitySportController.assignSportToFacility);

// Nested Court routes (must come before /:id route)
router.get('/:id/courts', optionalAuthenticate, requireCompleteProfile, courtController.getFacilityCourts);
router.post('/:id/courts', authenticate, requireCompleteProfile, requireFacilityAdmin, courtController.createCourt);

// Booking management routes (must come before /:id route)
router.get('/:id/bookings/pending', authenticate, requireCompleteProfile, requireFacilityAdmin, bookingController.getPendingBookingsForFacility);

// Facility routes
router.get('/:id', optionalAuthenticate, requireCompleteProfile, facilityController.getFacilityDetails);

// Protected routes (authentication and facility_admin role required)
router.post('/', authenticate, requireCompleteProfile, requireFacilityAdmin, facilityController.createFacility);
router.put('/:id', authenticate, requireCompleteProfile, requireFacilityAdmin, facilityController.updateFacility);

module.exports = router;

