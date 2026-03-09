const User = require('../models/User');
const OTP = require('../models/OTP');
const jwt = require('jsonwebtoken');
const { sendOTP } = require('../utils/emailService');
const { Op } = require('sequelize');

class UserController {
    static async sendOTP(req, res) {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Please provide an email' });
        }

        // Check if email already registered
        const userExists = await User.findOne({ where: { email } });
        if (userExists) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Generate 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

        try {
            // Remove old OTPs for this email
            await OTP.destroy({ where: { email } });

            // Save new OTP
            await OTP.create({ email, otp: otpCode, expiresAt });

            // Send OTP via Email
            await sendOTP(email, otpCode);

            res.status(200).json({ message: 'OTP sent to your email' });
        } catch (error) {
            console.error('Error sending OTP:', error.message || error);
            res.status(500).json({ message: `Failed to send OTP: ${error.message}` });
        }
    }

    static async registerUser(req, res) {
        const { email, password, otp } = req.body;

        if (!email || !password || !otp) {
            return res.status(400).json({ message: 'Please provide email, password, and OTP' });
        }

        // Find valid OTP
        const otpRecord = await OTP.findOne({
            where: {
                email,
                otp,
                expiresAt: { [Op.gt]: new Date() }, // not expired
            },
        });

        if (!otpRecord) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // Check again if user exists (race condition guard)
        const userExists = await User.findOne({ where: { email } });
        if (userExists) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        try {
            const user = await User.create({ email, password });

            // Delete OTP after successful registration
            await OTP.destroy({ where: { email } });

            res.status(201).json({
                id: user.id,
                email: user.email,
                token: UserController.generateToken(user.id),
            });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(400).json({ message: 'Invalid user data' });
        }
    }

    static async authUser(req, res) {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Please provide email and password' });
        }

        const user = await User.findOne({ where: { email } });

        if (user && (await user.matchPassword(password))) {
            res.json({
                id: user.id,
                email: user.email,
                token: UserController.generateToken(user.id),
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    }

    static async updateUserPassword(req, res) {
        const { oldPassword, newPassword } = req.body;
        const user = await User.findByPk(req.user.id);

        if (user && (await user.matchPassword(oldPassword))) {
            user.password = newPassword;
            await user.save();
            res.json({ message: 'Password changed successfully' });
        } else {
            res.status(401).json({ message: 'Invalid old password' });
        }
    }

    static generateToken(id) {
        return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
            expiresIn: '30d',
        });
    }
}

module.exports = UserController;
