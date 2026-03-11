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
    if (req.user && (req.user.role === 'superadmin' || req.user.role === 'admin')) return next();
    return res.status(403).json({ message: 'Admin access required' });
};

const requireSuperAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'superadmin') return next();
    return res.status(403).json({ message: 'Superadmin access required' });
};

router.get('/dashboard-data', protect, requireAdmin, AdminController.getDashboardData);
router.get('/users', protect, requireAdmin, AdminController.getUsers);
router.get('/stats', protect, requireAdmin, AdminController.getStats);
router.get('/next-username', protect, requireAdmin, AdminController.getNextUsername);
router.post('/add-user', protect, requireAdmin, AdminController.addUser);
router.put('/update-user/:id', protect, requireAdmin, AdminController.updateUser);
router.delete('/delete-user/:id', protect, requireAdmin, AdminController.deleteUser);
router.get('/audit-logs', protect, requireSuperAdmin, AdminController.getAuditLogs);

module.exports = router;
