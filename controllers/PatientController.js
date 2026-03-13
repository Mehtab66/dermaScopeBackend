const Patient = require('../models/Patient');
const { logAudit, fromRequest } = require('../utils/auditLog');
/**
 * GET /api/patients/next-id – next available patient number for this clinician.
 * Returns { id: "001" } (3-digit string). Protected.
 */
async function getNextId(req, res) {
    try {
        const clinicianId = req.user && req.user.id;
        if (!clinicianId) {
            return res.status(401).json({ message: 'Authorization required' });
        }
        const rows = await Patient.findAll({
            where: { clinician_id: clinicianId },
            attributes: ['patient_number'],
        });
        let maxNum = 0;
        rows.forEach((p) => {
            const num = parseInt(p.patient_number, 10);
            if (!Number.isNaN(num) && num > maxNum) maxNum = num;
        });
        const nextId = String(maxNum + 1).padStart(3, '0');
        res.json({ id: nextId });
    } catch (err) {
        console.error('Next patient id error:', err);
        res.status(500).json({ message: 'Failed to get next patient id' });
    }
}

/**
 * GET /api/patients – list patients.
 * If caller is clinician: only patients assigned to them (clinician_id = req.user.id).
 * If caller is admin/superadmin: all patients.
 * Requires auth (protect middleware).
 */
async function list(req, res) {
    try {
        const where = {};
        if (req.user && req.user.role === 'clinician') {
            where.clinician_id = req.user.id;
        }
        const rows = await Patient.findAll({
            where,
            attributes: ['id', 'patient_number', 'name', 'total_photos_clicked', 'last_clicked', 'clinician_id', 'createdAt'],
            order: [['name', 'ASC']],
        });
        const list = rows.map((p) => ({
            id: p.patient_number != null ? String(p.patient_number) : String(p.id),
            name: p.name,
        }));
        res.json(list);
    } catch (err) {
        console.error('List patients error:', err);
        res.status(500).json({ message: 'Failed to fetch patients' });
    }
}

/**
 * POST /api/patients – create patient. Body: { name } (id auto-assigned as next available).
 * Optional body: { id, name } for backward compat; if id omitted, backend assigns next id.
 * Uses clinician_id from auth (req.user.id).
 */
async function create(req, res) {
    const raw = req.body || {};
    let id = raw.id != null ? String(raw.id).trim() : '';
    const name = raw.name != null ? String(raw.name).trim() : '';
    if (!name) {
        return res.status(400).json({ message: 'name is required' });
    }
    const clinicianId = req.user && req.user.id;
    if (!clinicianId) {
        return res.status(401).json({ message: 'Authorization required to create patients' });
    }
    try {
        if (!id) {
            const rows = await Patient.findAll({
                where: { clinician_id: clinicianId },
                attributes: ['patient_number'],
            });
            let maxNum = 0;
            rows.forEach((p) => {
                const num = parseInt(p.patient_number, 10);
                if (!Number.isNaN(num) && num > maxNum) maxNum = num;
            });
            id = String(maxNum + 1).padStart(3, '0');
        }
        const existing = await Patient.findOne({ where: { patient_number: id } });
        if (existing) {
            return res.status(409).json({ message: 'Patient ID already exists' });
        }
        const patient = await Patient.create({
            patient_number: id,
            name,
            clinician_id: clinicianId,
            total_photos_clicked: 0,
        });
        logAudit(fromRequest(req, {
            action: 'patient_create',
            resource_type: 'patient',
            resource_id: String(patient.id),
            details: JSON.stringify({ patient_number: id, name }),
        }));
        res.status(201).json({
            id: patient.patient_number != null ? String(patient.patient_number) : String(patient.id),
            name: patient.name,
        });
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: 'Patient ID already exists' });
        }
        console.error('Create patient error:', err);
        res.status(500).json({ message: err.message || 'Failed to create patient' });
    }
}

module.exports = { list, create, getNextId };
