// routes/bookings.js
const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/bookingController');

router.get('/', auth(true), ctrl.listBookingsForArtistOrBand);

// Create a booking (club creates a booking for an artist/band against an opportunity)
router.post('/', auth(true), ctrl.createBooking);

// Update booking (club owner can update)
router.patch('/:bookingId', auth(true), ctrl.updateBooking);

// Cancel booking (club owner or booked artist/band can cancel)
router.delete('/:bookingId', auth(true), ctrl.cancelBooking);

module.exports = router;
