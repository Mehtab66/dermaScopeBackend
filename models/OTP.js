const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/**
 * OTPs sent to user email (sign-up, forgot-password, change-password) are stored here.
 * Table: otps
 * Columns: id (PK), email, otp (6 chars), expiresAt, createdAt, updatedAt
 */
const OTP = sequelize.define('OTP', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    otp: {
        type: DataTypes.STRING(6),
        allowNull: false,
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
    },
}, {
    tableName: 'otps',
    timestamps: true,
});

module.exports = OTP;
