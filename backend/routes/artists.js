// routes/artists.js
const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/artistController');

// Featured artists
// GET /api/artists/featured?limit=
router.get('/featured', ctrl.featuredArtists);

// Search artists by name
// GET /api/artists/search?q=...&page=&limit=
router.get('/search', ctrl.searchArtists);

// Upcoming gigs for an artist
// GET /api/artists/:artistId/gigs?page=&per_page=
router.get('/:artistId/gigs', ctrl.getArtistGigs);

router.get('/:artistId', ctrl.getArtist);
// Get bands for an artist (membership info)
router.get('/:artistId/bands', ctrl.getBandsForArtist);
router.patch('/:artistId', auth(true), ctrl.updateArtist);
router.post('/:artistId/change-password', auth(true), (req, res, next) => {
	if (ctrl && typeof ctrl.changePassword === 'function') return ctrl.changePassword(req, res, next);
	return res.status(500).json({ error: 'changePassword handler not available' });
});

module.exports = router;
