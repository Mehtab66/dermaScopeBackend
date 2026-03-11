const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/**
 * HIPAA-aligned audit log: who did what, when, on which resource.
 * Immutable append-only; do not update/delete for compliance.
 */
const AuditLog = sequelize.define('AuditLog', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'Actor; null if system or before user resolved',
    },
    action: {
        type: DataTypes.STRING(64),
        allowNull: false,
        comment: 'e.g. login, logout, patient_create, patient_view, photo_view, user_create',
    },
    resource_type: {
        type: DataTypes.STRING(64),
        allowNull: true,
        comment: 'e.g. user, patient, photo, folder',
    },
    resource_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Target entity id if applicable',
    },
    details: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'JSON or free text for extra context (no PHI in plain text)',
    },
    ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
    },
    user_agent: {
        type: DataTypes.STRING(512),
        allowNull: true,
    },
}, {
    tableName: 'audit_logs',
    timestamps: true,
    updatedAt: false,
    createdAt: true,
    indexes: [
        { fields: ['user_id'] },
        { fields: ['createdAt'] },
        { fields: ['resource_type', 'resource_id'] },
        { fields: ['action'] },
    ],
});

const User = require('./User');
AuditLog.belongsTo(User, { foreignKey: 'user_id' });

module.exports = AuditLog;
