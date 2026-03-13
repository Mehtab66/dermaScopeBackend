const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const ClinicianPatient = sequelize.define('ClinicianPatient', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
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
    patient_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'patients',
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
    clinician_patient_number: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Sequential number per clinician starting from 1',
    },
    total_photos: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    last_clicked: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName: 'clinician_patient',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

const User = require('./User');
const Patient = require('./Patient');

ClinicianPatient.belongsTo(User, { as: 'clinician', foreignKey: 'clinician_id' });
ClinicianPatient.belongsTo(Patient, { foreignKey: 'patient_id' });

module.exports = ClinicianPatient;

