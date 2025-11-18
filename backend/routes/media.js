// routes/media.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/mediaController');

router.post('/', auth(true), upload.single('file'), ctrl.uploadMedia);
// List media (filter by owner_type and owner_id) - public
router.get('/', ctrl.listMedia);

// Get single media metadata
router.get('/:mediaId', ctrl.getMedia);

// Update metadata (owner only)
router.patch('/:mediaId', auth(true), ctrl.updateMedia);

// Replace file
router.post('/:mediaId/replace', auth(true), upload.single('file'), ctrl.replaceMedia);

// Set an existing Media item as the authenticated user's profile image
router.post('/:mediaId/set-as-profile', auth(true), ctrl.setMediaAsProfile);

// Convenience: set authenticated user's profile to their latest uploaded image
router.post('/sync-profile', auth(true), ctrl.syncProfileFromLatestMedia);

// Delete media (owner only)
router.delete('/:mediaId', auth(true), ctrl.deleteMedia);

module.exports = router;
