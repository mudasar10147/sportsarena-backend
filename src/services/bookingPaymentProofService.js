/**
 * Booking Payment Proof Service
 * 
 * Handles payment proof image upload and linking to bookings.
 * For bank transfer payments, users upload proof after creating booking.
 */

const Booking = require('../models/Booking');
const Image = require('../models/Image');
const imageService = require('./imageService');
const { pool } = require('../config/database');

/**
 * Link payment proof image to booking
 * 
 * This function links an already-created image to a booking.
 * The image should be created first via imageService.createImage.
 * 
 * @param {number} bookingId - Booking ID
 * @param {number} userId - User ID (must be booking owner)
 * @param {string} imageId - Image ID (UUID) to link
 * @returns {Promise<Object>} Updated booking
 * @throws {Error} If booking not found, user not authorized, or link fails
 */
const linkPaymentProof = async (bookingId, userId, imageId) => {
  // Step 1: Verify booking exists and user owns it
  const booking = await Booking.findById(bookingId);
  
  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    error.errorCode = 'BOOKING_NOT_FOUND';
    throw error;
  }

  if (booking.userId !== userId) {
    const error = new Error('You can only upload payment proof for your own bookings');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN';
    throw error;
  }

  // Step 2: Check if booking is in a state that allows payment proof upload
  if (booking.bookingStatus !== 'pending') {
    const error = new Error('Payment proof can only be uploaded for pending bookings');
    error.statusCode = 400;
    error.errorCode = 'INVALID_BOOKING_STATUS';
    throw error;
  }

  // Step 3: Verify image exists and belongs to this booking
  const Image = require('../models/Image');
  const image = await Image.findById(imageId);
  
  if (!image) {
    const error = new Error('Image not found');
    error.statusCode = 404;
    error.errorCode = 'IMAGE_NOT_FOUND';
    throw error;
  }

  if (image.entityType !== 'booking' || image.entityId !== bookingId) {
    const error = new Error('Image does not belong to this booking');
    error.statusCode = 400;
    error.errorCode = 'INVALID_IMAGE';
    throw error;
  }

  // Step 4: Link image to booking
  const updatedBooking = await Booking.update(bookingId, {
    paymentProofImageId: imageId
  });

  if (!updatedBooking) {
    const error = new Error('Failed to link payment proof to booking');
    error.statusCode = 500;
    error.errorCode = 'UPDATE_FAILED';
    throw error;
  }

  return updatedBooking;
};

/**
 * Remove payment proof image from booking
 * 
 * @param {number} bookingId - Booking ID
 * @param {number} userId - User ID (must be booking owner)
 * @returns {Promise<Object>} Updated booking
 * @throws {Error} If booking not found or user not authorized
 */
const removePaymentProof = async (bookingId, userId) => {
  // Verify booking exists and user owns it
  const booking = await Booking.findById(bookingId);
  
  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    error.errorCode = 'BOOKING_NOT_FOUND';
    throw error;
  }

  if (booking.userId !== userId) {
    const error = new Error('You can only remove payment proof for your own bookings');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN';
    throw error;
  }

  // Remove payment proof image link
  const updatedBooking = await Booking.update(bookingId, {
    paymentProofImageId: null
  });

  // Note: Image record itself is not deleted (soft delete handled by imageService)
  // This allows recovery if needed

  return updatedBooking;
};

module.exports = {
  linkPaymentProof,
  removePaymentProof
};

