const User = require('../models/User');
const OTP = require('../models/OTP');
const jwt = require('jsonwebtoken');
const { sendOTP, sendPasswordResetOTP } = require('../utils/emailService');
const { Op } = require('sequelize');
const { sequelize } = require('../config/db');

function normalizeEmail(email) {
    return (email || '').trim().toLowerCase();
}

function validatePasswordStrength(password) {
    if (!password || typeof password !== 'string') return { ok: false, message: 'Password is required' };
    if (password.length < 8) return { ok: false, message: 'Password must be at least 8 characters' };
    if (!/[A-Z]/.test(password)) return { ok: false, message: 'Password must contain at least one capital letter' };
    if (!/[!@#$%^&*(),.?":{}|<>_\-+=[\]\\;'`~]/.test(password)) return { ok: false, message: 'Password must contain at least one special character (!@#$%^&* etc.)' };
    return { ok: true };
}

class UserController {
    static async sendOTP(req, res) {
        const rawEmail = req.body.email;
        if (!rawEmail) {
            return res.status(400).json({ message: 'Please provide an email' });
        }
        const email = normalizeEmail(rawEmail);

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
        const rawEmail = (req.body.email || '').trim().toLowerCase();
        const password = req.body.password;
        const otp = (req.body.otp || '').trim();

        if (!rawEmail || !password || !otp) {
            return res.status(400).json({ message: 'Please provide email, password, and OTP' });
        }
        const pwdCheck = validatePasswordStrength(password);
        if (!pwdCheck.ok) {
            return res.status(400).json({ message: pwdCheck.message });
        }
        const email = rawEmail;

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
            // Mobile signup: default role is clinician
            const role = (req.body.role === 'admin' ? 'admin' : 'clinician');
            const user = await User.create({ email, password, role });

            // Delete OTP after successful registration
            await OTP.destroy({ where: { email } });

            res.status(201).json({
                id: user.id,
                email: user.email,
                role: user.role,
                token: UserController.generateToken(user.id),
            });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(400).json({ message: 'Invalid user data' });
        }
    }

    static async authUser(req, res) {
        try {
            const body = req.body || {};
            const rawEmail = body.email != null ? String(body.email).trim() : '';
            const password = body.password != null ? String(body.password) : '';
            const email = normalizeEmail(rawEmail);

            if (!email || !password) {
                return res.status(400).json({ message: 'Please provide email and password' });
            }

            // Find user by email (case-insensitive so old data still works)
            const user = await User.findOne({
                where: sequelize.where(
                    sequelize.fn('LOWER', sequelize.col('email')),
                    email
                ),
            });

            if (!user) {
                console.log('Login fail: no user for email:', email);
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            let match = false;
            try {
                match = await user.matchPassword(password);
            } catch (pwErr) {
                console.error('Login password check error (wrong hash in DB?):', pwErr.message);
                return res.status(500).json({ message: 'Login failed. Please try again.' });
            }

            if (!match) {
                console.log('Login fail: wrong password for email:', email);
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            const userPayload = {
                id: user.id,
                email: user.email,
                role: user.role || 'clinician',
            };
            const token = UserController.generateToken(user.id);
            return res.status(200).json({
                user: userPayload,
                token,
                // Top-level email/username so mobile app (authService) can use data.email / data.username
                email: user.email,
                username: user.email,
            });
        } catch (err) {
            console.error('Login error:', err);
            return res.status(500).json({ message: 'Login failed. Please try again.' });
        }
    }

    static async updateUserPassword(req, res) {
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ message: 'Please provide old password and new password' });
        }
        const pwdCheck = validatePasswordStrength(newPassword);
        if (!pwdCheck.ok) {
            return res.status(400).json({ message: pwdCheck.message });
        }
        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(401).json({ message: 'Not authorized' });
        try {
            if (!(await user.matchPassword(oldPassword))) {
                return res.status(401).json({ message: 'Invalid old password' });
            }
            user.password = newPassword;
            await user.save();
            return res.json({ message: 'Password changed successfully' });
        } catch (err) {
            console.error('Change password error:', err);
            return res.status(500).json({ message: 'Failed to change password' });
        }
    }

    /** POST /forgot-password: send OTP to registered email only */
    static async forgotPassword(req, res) {
        const rawEmail = (req.body && req.body.email) != null ? String(req.body.email).trim() : '';
        const email = normalizeEmail(rawEmail);
        if (!email) {
            return res.status(400).json({ message: 'Please provide your email' });
        }
        const user = await User.findOne({
            where: sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), email),
        });
        if (!user) {
            return res.status(404).json({ message: 'No account found with this email' });
        }
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        try {
            await OTP.destroy({ where: { email } });
            await OTP.create({ email, otp: otpCode, expiresAt });
            await sendPasswordResetOTP(email, otpCode);
            return res.status(200).json({ message: 'Password reset code sent to your email' });
        } catch (err) {
            console.error('Forgot password send OTP error:', err);
            return res.status(500).json({ message: 'Failed to send reset code. Please try again.' });
        }
    }

    /** POST /reset-password: set new password using OTP (no login required) */
    static async resetPassword(req, res) {
        const rawEmail = (req.body && req.body.email) != null ? String(req.body.email).trim() : '';
        const email = normalizeEmail(rawEmail);
        const otp = (req.body && req.body.otp) != null ? String(req.body.otp).trim() : '';
        const newPassword = (req.body && req.body.newPassword) != null ? req.body.newPassword : '';
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ message: 'Please provide email, reset code, and new password' });
        }
        const pwdCheck = validatePasswordStrength(newPassword);
        if (!pwdCheck.ok) {
            return res.status(400).json({ message: pwdCheck.message });
        }
        const otpRecord = await OTP.findOne({
            where: { email, otp, expiresAt: { [Op.gt]: new Date() } },
        });
        if (!otpRecord) {
            return res.status(400).json({ message: 'Invalid or expired reset code' });
        }
        const user = await User.findOne({
            where: sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), email),
        });
        if (!user) {
            return res.status(404).json({ message: 'Account not found' });
        }
        try {
            user.password = newPassword;
            await user.save();
            await OTP.destroy({ where: { email } });
            return res.status(200).json({ message: 'Password reset successfully. You can now log in.' });
        } catch (err) {
            console.error('Reset password error:', err);
            return res.status(500).json({ message: 'Failed to reset password' });
        }
    }

    static generateToken(id) {
        return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
            expiresIn: '30d',
        });
    }
}

module.exports = UserController;
