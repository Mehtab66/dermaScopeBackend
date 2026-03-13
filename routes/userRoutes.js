const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
            const user = await User.findByPk(decoded.id, {
                attributes: { exclude: ['password'] },
            });
            if (!user) {
                return res.status(401).json({ message: 'User not found' });
            }
            req.user = user;
            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

router.post('/send-otp', UserController.sendOTP);
router.post('/verify-otp', UserController.verifyOtp);
router.post('/register', UserController.registerUser);
router.post('/login', UserController.authUser);
router.post('/forgot-password', UserController.forgotPassword);
router.post('/reset-password', UserController.resetPassword);
router.put('/change-password', protect, UserController.updateUserPassword);
router.post('/send-change-password-otp', protect, UserController.sendChangePasswordOtp);
router.post('/verify-change-password-otp', protect, UserController.verifyChangePasswordOtp);
router.post('/change-password-with-otp', protect, UserController.changePasswordWithOtp);

module.exports = router;
