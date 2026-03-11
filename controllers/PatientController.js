const Patient = require('../models/Patient');
const { logAudit, fromRequest } = require('../utils/auditLog');

/**
 * GET /api/patients – list all patients (array or { patients }).
 * App normalizes id/patient_id and name/patient_name.
 */
async function list(req, res) {
    try {
        const rows = await Patient.findAll({
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
 * POST /api/patients – create patient. Body: { id, name }.
 * Uses clinician_id from auth (req.user.id). On duplicate id → 409.
 */
async function create(req, res) {
    const raw = req.body || {};
    const id = raw.id != null ? String(raw.id).trim() : '';
    const name = raw.name != null ? String(raw.name).trim() : '';
    if (!id || !name) {
        return res.status(400).json({ message: 'id and name are required' });
    }
    const clinicianId = req.user && req.user.id;
    if (!clinicianId) {
        return res.status(401).json({ message: 'Authorization required to create patients' });
    }
    try {
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

module.exports = { list, create };
