const express = require('express');
const router = express.Router();

/**
 * API v1 Base Route
 * All v1 API endpoints will be prefixed with /api/v1/
 * 
 * This follows REST API architecture:
 * - Resource-based endpoints
 * - Versioned base URL (/api/v1/)
 * - Simple and fast to implement
 * - Mobile-friendly JSON responses
 */

// API v1 Info endpoint
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SportsArena API v1',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      facilities: '/api/v1/facilities',
      sports: '/api/v1/sports',
      courts: '/api/v1/courts',
      bookings: '/api/v1/bookings',
      images: '/api/v1/images',
      payments: '/api/v1/payments'
    }
  });
});

// Import and mount route modules
const authRoutes = require('./auth');
const userRoutes = require('./users');
const facilityRoutes = require('./facilities');
const sportRoutes = require('./sports');
const courtRoutes = require('./courts');
const timeSlotRoutes = require('./timeslots');
const bookingRoutes = require('./bookings');
const imageRoutes = require('./images');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/facilities', facilityRoutes);
router.use('/sports', sportRoutes);
router.use('/courts', courtRoutes);
router.use('/timeslots', timeSlotRoutes);
router.use('/bookings', bookingRoutes);
router.use('/images', imageRoutes);
 
module.exports = router;

