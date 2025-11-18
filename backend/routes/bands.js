// routes/bands.js
const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const ctrl = require('../controllers/bandController');

// Accept optional profile image as multipart field `file`
router.post('/', auth(true), upload.single('file'), ctrl.createBand);
// PATCH /api/bands/:bandId - update band profile (name, description, image)
router.patch('/:bandId', auth(true), upload.single('file'), ctrl.updateBand);
// Get bands for current authenticated user (includes members)
router.get('/', auth(true), ctrl.getMyBands);
router.post('/:bandId/invites', auth(true), ctrl.inviteToBand);
router.post('/invites/:inviteId/respond', auth(true), ctrl.respondInvite);
// Directly add a member (creator only)
router.post('/:bandId/members', auth(true), ctrl.addMemberDirect);
// Invite (creator) and respond (artist)
router.post('/:bandId/invite', auth(true), ctrl.inviteArtist);
router.post('/:bandId/invite/:inviteId/respond', auth(true), ctrl.respondToInvite);
// List invites for current artist
router.get('/invites', auth(true), ctrl.listMyInvites);
// List invites for a band (creator only)
router.get('/:bandId/invites', auth(true), ctrl.listBandInvites);
// Creator cancels an invite
router.delete('/:bandId/invites/:inviteId', auth(true), ctrl.cancelInvite);
// Invitee withdraws their invite
router.delete('/invites/:inviteId', auth(true), ctrl.withdrawInvite);
// Public: search bands
router.get('/search', ctrl.searchBands);
// Public: get featured or "now" bands
router.get('/featured', ctrl.featuredBands);
// Get band details (basic)
router.get('/:bandId', ctrl.getBand);
// Get band details (rich with members' bios/profile) - public
router.get('/:bandId/details', ctrl.getBandDetails);
// List band members
router.get('/:bandId/members', auth(true), ctrl.getBandMembers);
// Remove a member (creator or the member themselves)
router.delete('/:bandId/members/:artistId', auth(true), ctrl.removeBandMember);
// Update member role (creator only)
router.patch('/:bandId/members/:artistId', auth(true), ctrl.updateBandMemberRole);
// Delete a band (creator only)
router.delete('/:bandId', auth(true), ctrl.deleteBand);

module.exports = router;
