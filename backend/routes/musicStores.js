// routes/musicStores.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/musicStoreController');

// GET /api/music-stores - Get all music stores
router.get('/', ctrl.getAllMusicStores);

// GET /api/music-stores/featured - Get featured music stores
router.get('/featured', ctrl.featuredMusicStores);

// GET /api/music-stores/search - Search music stores by name
router.get('/search', ctrl.searchMusicStores);

// GET /api/music-stores/filter - Filter music stores by rating
router.get('/filter', ctrl.filterMusicStoresByRating);

// GET /api/music-stores/:id - Get a specific music store by ID
router.get('/:id', ctrl.getMusicStoreById);

module.exports = router;