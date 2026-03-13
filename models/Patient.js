const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Patient = sequelize.define('Patient', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    patient_number: {
        type: DataTypes.STRING(255),
        allowNull: true,
        // Unique per clinician (enforced by DB composite index with clinician_id)
        comment: 'App-provided id e.g. "001", unique per clinician',
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    total_photos_clicked: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    last_clicked: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    clinician_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
}, {
    tableName: 'patients',
    timestamps: true,
    createdAt: true,
    updatedAt: true,
});

const User = require('./User');
Patient.belongsTo(User, { foreignKey: 'clinician_id' });

module.exports = Patient;
