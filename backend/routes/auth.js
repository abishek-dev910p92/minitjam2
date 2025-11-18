// routes/auth.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');

router.post('/signup/artist', ctrl.signupArtist);
router.post('/signup/club', ctrl.signupClub);
router.post('/login', ctrl.login);

// Email OTP endpoints
router.post('/otp/send', ctrl.sendEmailOtp);
router.post('/otp/verify', ctrl.verifyEmailOtp);

module.exports = router;
