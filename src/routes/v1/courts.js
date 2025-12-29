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
 * Availability endpoints (rule-based system):
 * - GET    /courts/:id/availability - Get availability for single date
 * - GET    /courts/:id/availability/range - Get availability for date range
 * - GET    /courts/:id/availability/slots - Get duration-based slots
 * 
 * Availability rules management endpoints (admin):
 * - GET    /courts/:id/availability/rules - List availability rules
 * - POST   /courts/:id/availability/rules - Create availability rule
 * - PUT    /courts/:id/availability/rules/:ruleId - Update availability rule
 * - DELETE /courts/:id/availability/rules/:ruleId - Delete availability rule
 */

const express = require('express');
const router = express.Router();
const courtController = require('../../controllers/courtController');
const availabilityController = require('../../controllers/availabilityController');
const availabilityRuleController = require('../../controllers/availabilityRuleController');
const { authenticate } = require('../../middleware/auth');
const { requireFacilityAdmin } = require('../../middleware/authorization');

// Protected route (authentication and facility_admin role required)
router.put('/:id', authenticate, requireFacilityAdmin, courtController.updateCourt);

// Availability rules management routes (protected - admin only)
// IMPORTANT: More specific routes must come before less specific ones
router.get('/:id/availability/rules', authenticate, requireFacilityAdmin, availabilityRuleController.getAvailabilityRules);
router.post('/:id/availability/rules', authenticate, requireFacilityAdmin, availabilityRuleController.createAvailabilityRule);
router.put('/:id/availability/rules/:ruleId', authenticate, requireFacilityAdmin, availabilityRuleController.updateAvailabilityRule);
router.delete('/:id/availability/rules/:ruleId', authenticate, requireFacilityAdmin, availabilityRuleController.deleteAvailabilityRule);

// Availability routes (public - no authentication required)
// IMPORTANT: More specific routes must come before less specific ones
router.get('/:id/availability/range', availabilityController.getAvailabilityRange);
router.get('/:id/availability/slots', availabilityController.getAvailabilitySlots);
router.get('/:id/availability', availabilityController.getAvailability);

module.exports = router;

