const { Op } = require('sequelize');
const User = require('../models/User');
const Patient = require('../models/Patient');
const AuditLog = require('../models/AuditLog');
const { logAudit, fromRequest } = require('../utils/auditLog');
const { getPhotoCountForUser } = require('../utils/s3PhotoCount');

function validatePasswordStrength(password) {
    if (!password || typeof password !== 'string') return { ok: false, message: 'Password is required' };
    if (password.length < 8) return { ok: false, message: 'Password must be at least 8 characters' };
    if (!/[A-Z]/.test(password)) return { ok: false, message: 'Password must contain at least one capital letter' };
    if (!/[a-z]/.test(password)) return { ok: false, message: 'Password must contain at least one lowercase letter' };
    if (!/\d/.test(password)) return { ok: false, message: 'Password must contain at least one number' };
    if (!/[!@#$%^&*(),.?":{}|<>_\-+=[\]\\;'`~]/.test(password)) return { ok: false, message: 'Password must contain at least one special character' };
    return { ok: true };
}

/**
 * GET /api/admin/dashboard-data
 * Returns clinicians and admins for admin/superadmin dashboards, including patient summaries.
 * Patients are attached to the user they're assigned to (clinician_id).
 * Shape per user:
 * {
 *   id, email, username, role_name, hasFolder,
 *   totalPatients, totalPhotos,
 *   patients: [{ id, name, total_photos_clicked, last_clicked, createdAt }]
 * }
 */
async function getDashboardData(req, res) {
    try {
        // 1) Fetch clinicians and admins (so dashboard shows both; superadmin excluded)
        const staff = await User.findAll({
            where: { role: { [Op.in]: ['clinician', 'admin'] } },
            attributes: ['id', 'email', 'role', 'createdAt'],
            order: [['email', 'ASC']],
        });

        // 2) Fetch all patients once and group in memory
        const patients = await Patient.findAll({
            attributes: [
                'id',
                'patient_number',
                'name',
                'total_photos_clicked',
                'last_clicked',
                'clinician_id',
                'createdAt',
            ],
            order: [['createdAt', 'DESC']],
        });

        // 3) Create a map of user id → summary (so we can attach patients to whoever they're assigned to)
        const byUser = new Map();

        staff.forEach((u) => {
            byUser.set(u.id, {
                id: u.id,
                email: u.email,
                username: u.email,
                role_name: u.role,
                hasFolder: true,
                createdAt: u.createdAt,
                totalPatients: 0,
                totalPhotos: 0,
                patients: [],
            });
        });

        // 4) Attach patients to the user they're assigned to (clinician_id)
        patients.forEach((p) => {
            const group = byUser.get(p.clinician_id);
            if (!group) return; // patient linked to missing/non-staff user

            const id =
                p.patient_number != null && p.patient_number !== ''
                    ? String(p.patient_number)
                    : String(p.id);

            group.patients.push({
                id,
                name: p.name,
                total_photos_clicked: p.total_photos_clicked,
                last_clicked: p.last_clicked,
                createdAt: p.createdAt,
            });

            group.totalPatients += 1;
            group.totalPhotos += (p.total_photos_clicked || 0);
        });

        // 5) Override totalPhotos with live count from S3 (AWS) per staff
        await Promise.all(
            staff.map(async (u) => {
                const group = byUser.get(u.id);
                if (!group) return;
                try {
                    const s3Count = await getPhotoCountForUser(u.email || u.username);
                    group.totalPhotos = s3Count;
                } catch (err) {
                    console.warn('S3 photo count for', u.email, err.message);
                }
            })
        );

        // 6) Return staff in original email-sorted order
        const data = staff.map((u) => byUser.get(u.id));
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
 * For superadmin: total admins, clinicians, patients, totalPhotos (from S3).
 */
async function getStats(req, res) {
    try {
        const [totalAdmins, totalClinicians, totalPatients, staff] = await Promise.all([
            User.count({ where: { role: { [Op.in]: ['superadmin', 'admin'] } } }),
            User.count({ where: { role: 'clinician' } }),
            Patient.count(),
            User.findAll({
                where: { role: { [Op.in]: ['clinician', 'admin'] } },
                attributes: ['id', 'email'],
            }),
        ]);
        let totalPhotos = 0;
        await Promise.all(
            staff.map(async (u) => {
                try {
                    totalPhotos += await getPhotoCountForUser(u.email);
                } catch (e) {
                    // ignore per-user errors
                }
            })
        );
        res.json({ totalAdmins, totalClinicians, totalPatients, totalPhotos });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ message: 'Failed to load stats' });
    }
}

/**
 * GET /api/admin/next-username
 * Suggests next clinician identifier (email) for creation.
 */
async function getNextUsername(req, res) {
    try {
        const count = await User.count({ where: { role: 'clinician' } });
        const username = `clinician_${String(count + 1).padStart(3, '0')}@dermascope.local`;
        res.json({ username });
    } catch (err) {
        console.error('Next username error:', err);
        res.status(500).json({ message: 'Failed to get next username' });
    }
}

/**
 * POST /api/admin/add-user
 * Body: { email, password, role: 'admin' | 'clinician' }
 * Only superadmin can add admins; superadmin or admin can add clinicians.
 */
async function addUser(req, res) {
    try {
        const actorRole = req.user?.role;
        const { email: rawEmail, password, role } = req.body;
        const email = (rawEmail || '').trim().toLowerCase();
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
        const targetRole = role === 'admin' ? 'admin' : 'clinician';
        if (targetRole === 'admin' && actorRole !== 'superadmin') {
            return res.status(403).json({ message: 'Only superadmin can add admins' });
        }
        const pwdCheck = validatePasswordStrength(password);
        if (!pwdCheck.ok) {
            return res.status(400).json({ message: pwdCheck.message });
        }
        const existing = await User.findOne({ where: { email } });
        if (existing) {
            return res.status(409).json({ message: 'Email already registered' });
        }
        const user = await User.create({ email, password, role: targetRole });
        await logAudit(fromRequest(req, {
            action: 'user_create',
            resource_type: 'user',
            resource_id: String(user.id),
            details: JSON.stringify({ role: targetRole, email: user.email }),
        }));
        res.status(201).json({
            id: user.id,
            email: user.email,
            role: user.role,
        });
    } catch (err) {
        console.error('Add user error:', err);
        res.status(500).json({ message: 'Failed to add user' });
    }
}

/**
 * PUT /api/admin/update-user/:id
 * Body: { email?, password? }
 * Superadmin can update any; admin can update only clinicians.
 */
async function updateUser(req, res) {
    try {
        const actorRole = req.user?.role;
        const targetId = parseInt(req.params.id, 10);
        if (isNaN(targetId)) return res.status(400).json({ message: 'Invalid user id' });
        const target = await User.findByPk(targetId);
        if (!target) return res.status(404).json({ message: 'User not found' });
        if (target.role === 'superadmin' && actorRole !== 'superadmin') {
            return res.status(403).json({ message: 'Only superadmin can update superadmin' });
        }
        if (target.role === 'admin' && actorRole !== 'superadmin') {
            return res.status(403).json({ message: 'Only superadmin can update admins' });
        }
        const updates = {};
        if (req.body.email !== undefined) {
            const email = (req.body.email || '').trim().toLowerCase();
            if (!email) return res.status(400).json({ message: 'Email is required' });
            const existing = await User.findOne({ where: { email } });
            if (existing && existing.id !== targetId) {
                return res.status(409).json({ message: 'Email already in use' });
            }
            updates.email = email;
        }
        if (req.body.password !== undefined && req.body.password !== '') {
            const pwdCheck = validatePasswordStrength(req.body.password);
            if (!pwdCheck.ok) return res.status(400).json({ message: pwdCheck.message });
            updates.password = req.body.password;
        }
        if (Object.keys(updates).length === 0) {
            return res.status(200).json({ id: target.id, email: target.email, role: target.role });
        }
        await target.update(updates);
        await logAudit(fromRequest(req, {
            action: 'user_update',
            resource_type: 'user',
            resource_id: String(target.id),
            details: JSON.stringify({ updated_fields: Object.keys(updates) }),
        }));
        res.json({ id: target.id, email: target.email, role: target.role });
    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ message: 'Failed to update user' });
    }
}

/**
 * DELETE /api/admin/delete-user/:id
 * Superadmin can delete admin or clinician; cannot delete last superadmin.
 */
async function deleteUser(req, res) {
    try {
        const actorRole = req.user?.role;
        const targetId = parseInt(req.params.id, 10);
        if (isNaN(targetId)) return res.status(400).json({ message: 'Invalid user id' });
        const target = await User.findByPk(targetId);
        if (!target) return res.status(404).json({ message: 'User not found' });
        if (target.role === 'superadmin') {
            const superadminCount = await User.count({ where: { role: 'superadmin' } });
            if (superadminCount <= 1) {
                return res.status(400).json({ message: 'Cannot delete the last superadmin' });
            }
            if (actorRole !== 'superadmin') {
                return res.status(403).json({ message: 'Only superadmin can delete superadmins' });
            }
        }
        if (target.role === 'admin' && actorRole !== 'superadmin') {
            return res.status(403).json({ message: 'Only superadmin can delete admins' });
        }
        const deletedEmail = target.email;
        const deletedRole = target.role;
        await target.destroy();
        await logAudit(fromRequest(req, {
            action: 'user_delete',
            resource_type: 'user',
            resource_id: String(targetId),
            details: JSON.stringify({ email: deletedEmail, role: deletedRole }),
        }));
        res.json({ message: 'User deleted' });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ message: 'Failed to delete user' });
    }
}

/**
 * GET /api/admin/audit-logs
 * Returns recent audit log entries (superadmin only).
 */
async function getAuditLogs(req, res) {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
        const offset = parseInt(req.query.offset, 10) || 0;
        const action = req.query.action ? String(req.query.action).trim() : null;
        const where = action ? { action } : {};
        const logs = await AuditLog.findAll({
            where,
            order: [['createdAt', 'DESC']],
            limit,
            offset,
            include: [{ model: User, as: 'User', attributes: ['id', 'email', 'role'], required: false }],
        });
        const total = await AuditLog.count({ where });
        res.json({ logs, total });
    } catch (err) {
        console.error('Audit logs error:', err);
        res.status(500).json({ message: 'Failed to load audit logs' });
    }
}

module.exports = {
    getDashboardData,
    getUsers,
    getStats,
    getNextUsername,
    addUser,
    updateUser,
    deleteUser,
    getAuditLogs,
};
