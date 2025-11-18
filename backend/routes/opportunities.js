// routes/opportunities.js
const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/opportunityController');
const appCtrl = require('../controllers/applicationController');

router.post('/', auth(true), ctrl.createOpportunity);
router.get('/', ctrl.listOpportunities);
// current user's opportunities (role=club|artist)
router.get('/my', auth(true), ctrl.myOpportunities);
router.get('/:id', ctrl.getOpportunity);
// Artist applies to an opportunity
router.post('/:id/apply', auth(true), appCtrl.applyToOpportunity);
// Club lists applicants
router.get('/:id/applicants', auth(true), appCtrl.listApplicantsForOpportunity);
router.patch('/:id', auth(true), ctrl.updateOpportunity);
router.delete('/:id', auth(true), ctrl.deleteOpportunity);

module.exports = router;
