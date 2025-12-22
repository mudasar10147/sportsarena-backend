/**
 * Sport Routes
 * 
 * Following MVP_FULL_ROADMAP.md Step 2: Sport Routes
 * 
 * Endpoints:
 * - GET    /sports       - List all sports
 * - GET    /sports/:id   - Get details of a sport (optional)
 * - POST   /sports       - Create a Sport
 * 
 * Note: For MVP, sports are mostly static; no create/update routes needed initially.
 * However, POST endpoint is provided for admin use if needed.
 */

const express = require('express');
const router = express.Router();
const sportController = require('../../controllers/sportController');
const { authenticate } = require('../../middleware/auth');
const { requirePlatformAdmin } = require('../../middleware/authorization');

// Public routes (no authentication required)
router.get('/', sportController.listSports);
router.get('/:id', sportController.getSportDetails);

// Protected route (authentication and platform_admin role required)
// Note: Only platform admins can create sports as they are global/shared resources
router.post('/', authenticate, requirePlatformAdmin, sportController.createSport);

module.exports = router;

