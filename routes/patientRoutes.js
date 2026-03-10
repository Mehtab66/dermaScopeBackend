const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const PatientController = require('../controllers/PatientController');

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

router.get('/', PatientController.list);
router.post('/', protect, PatientController.create);

module.exports = router;
