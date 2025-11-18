// routes/applications.js
const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/applicationController');

router.post('/:opportunityId/apply', auth(true), ctrl.applyToOpportunity);
router.get('/club', auth(true), ctrl.listApplicationsForClub); // club's applications
router.post('/:applicationId/accept', auth(true), ctrl.acceptApplication);

module.exports = router;
