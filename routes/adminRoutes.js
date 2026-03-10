const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AdminController = require('../controllers/AdminController');

const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
            const user = await User.findByPk(decoded.id, { attributes: { exclude: ['password'] } });
            if (!user) return res.status(401).json({ message: 'User not found' });
            req.user = user;
            next();
        } catch (e) {
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }
    if (!token) return res.status(401).json({ message: 'Not authorized, no token' });
};

const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') return next();
    return res.status(403).json({ message: 'Admin access required' });
};

router.get('/dashboard-data', protect, requireAdmin, AdminController.getDashboardData);
router.get('/users', protect, requireAdmin, AdminController.getUsers);

module.exports = router;
