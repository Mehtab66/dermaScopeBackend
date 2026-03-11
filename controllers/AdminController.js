const { Op } = require('sequelize');
const User = require('../models/User');
const Patient = require('../models/Patient');

/**
 * GET /api/admin/dashboard-data
 * Returns all clinicians for admin dashboard (admin sees all clinicians and their folder links).
 */
async function getDashboardData(req, res) {
    try {
        const users = await User.findAll({
            where: { role: 'clinician' },
            attributes: ['id', 'email', 'role', 'createdAt'],
            order: [['email', 'ASC']],
        });
        const data = users.map((u) => ({
            id: u.id,
            email: u.email,
            username: u.email,
            role_name: u.role,
            hasFolder: true,
        }));
        res.json(data);
    } catch (err) {
        console.error('Dashboard data error:', err);
        res.status(500).json({ message: 'Failed to load dashboard data' });
    }
}

/**
 * GET /api/admin/users
 * Returns users (clinicians) for admin user management.
 */
async function getUsers(req, res) {
    try {
        const users = await User.findAll({
            attributes: ['id', 'email', 'role', 'createdAt'],
            order: [['email', 'ASC']],
        });
        const data = users.map((u) => ({
            id: u.id,
            email: u.email,
            username: u.email,
            role_name: u.role,
        }));
        res.json(data);
    } catch (err) {
        console.error('Users list error:', err);
        res.status(500).json({ message: 'Failed to load users' });
    }
}

/**
 * GET /api/admin/stats
 * For superadmin: total admins, clinicians, patients.
 */
async function getStats(req, res) {
    try {
        const [totalAdmins, totalClinicians, totalPatients] = await Promise.all([
            User.count({ where: { role: { [Op.in]: ['superadmin', 'admin'] } } }),
            User.count({ where: { role: 'clinician' } }),
            Patient.count(),
        ]);
        res.json({ totalAdmins, totalClinicians, totalPatients });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ message: 'Failed to load stats' });
    }
}

module.exports = {
    getDashboardData,
    getUsers,
    getStats,
};
