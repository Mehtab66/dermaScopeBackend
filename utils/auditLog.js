const AuditLog = require('../models/AuditLog');

/**
 * Append an audit log entry (HIPAA audit trail). Fire-and-forget; never throw.
 * @param {Object} opts
 * @param {number} [opts.user_id] - Actor user id
 * @param {string} opts.action - e.g. 'login', 'logout', 'patient_create', 'patient_view', 'photo_view'
 * @param {string} [opts.resource_type] - e.g. 'user', 'patient', 'photo'
 * @param {string} [opts.resource_id] - Target id
 * @param {string} [opts.details] - JSON or safe text (avoid PHI in plain text)
 * @param {string} [opts.ip_address] - From req.ip or req.headers['x-forwarded-for']
 * @param {string} [opts.user_agent] - From req.headers['user-agent']
 */
async function logAudit(opts) {
    try {
        await AuditLog.create({
            user_id: opts.user_id ?? null,
            action: opts.action || 'unknown',
            resource_type: opts.resource_type ?? null,
            resource_id: opts.resource_id ?? null,
            details: opts.details ?? null,
            ip_address: opts.ip_address ?? null,
            user_agent: opts.user_agent ?? null,
        });
    } catch (err) {
        console.error('Audit log write failed:', err.message);
    }
}

/**
 * Add audit fields from Express req (ip, user_agent, user id from req.user).
 */
function fromRequest(req, overrides = {}) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'] ? req.headers['user-agent'].substring(0, 512) : null;
    return {
        user_id: req.user?.id ?? null,
        ip_address: ip || null,
        user_agent: userAgent,
        ...overrides,
    };
}

module.exports = { logAudit, fromRequest };
