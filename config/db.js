const { Sequelize } = require('sequelize');

const DB_NAME = process.env.MYSQL_DB || 'dermascope';
const DB_USER = process.env.MYSQL_USER || 'root';
const DB_PASS = process.env.MYSQL_PASS || '';
const DB_HOST = process.env.MYSQL_HOST || 'localhost';
const DB_PORT = process.env.MYSQL_PORT || 3306;

// Step 1: Connect without database to create it if missing
const bootstrapSequelize = new Sequelize('', DB_USER, DB_PASS, {
    host: DB_HOST,
    port: DB_PORT,
    dialect: 'mysql',
    logging: false,
});

// Step 2: Main connection with the target database
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
    host: DB_HOST,
    port: DB_PORT,
    dialect: 'mysql',
    logging: false,
});

const connectDB = async () => {
    try {
        // Create database if it doesn't exist
        await bootstrapSequelize.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
        console.log(`Database '${DB_NAME}' is ready.`);
        await bootstrapSequelize.close();

        // Now connect to the actual database
        await sequelize.authenticate();
        console.log('MySQL Connected.');

        // Load models and set associations (Patient belongs to User; User has many Patients)
        const User = require('../models/User');
        const Patient = require('../models/Patient');
        User.hasMany(Patient, { foreignKey: 'clinician_id' });

        // Sync all models (creates/updates tables automatically)
        await sequelize.sync({ alter: true });
        console.log('Tables synced.');

        // Seed default admin if not exists (email: hussain@admin.com, password: hussain 12)
        const defaultAdminEmail = 'hussain@admin.com';
        const existing = await User.findOne({ where: { email: defaultAdminEmail } });
        if (!existing) {
            await User.create({
                email: defaultAdminEmail,
                password: 'hussain 12',
                role: 'admin',
            });
            console.log('Default admin created:', defaultAdminEmail);
        }
    } catch (error) {
        console.error('Database connection error:', error.message);
        process.exit(1);
    }
};

module.exports = { sequelize, connectDB };
