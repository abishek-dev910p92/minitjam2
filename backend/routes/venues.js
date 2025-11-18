const express = require('express');
const router = express.Router();
const clubCtrl = require('../controllers/clubController');

// Public search for venues
// GET /api/venues/search?q=...&page=&limit=
router.get('/search', clubCtrl.searchVenues);

// Featured venues
// GET /api/venues/featured?limit=
router.get('/featured', clubCtrl.featuredVenues);

// GET /api/venues/:id - fetch single venue details
router.get('/:id', clubCtrl.getVenueById);

module.exports = router;
