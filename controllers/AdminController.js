const User = require('../models/User');

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

module.exports = {
    getDashboardData,
    getUsers,
};
