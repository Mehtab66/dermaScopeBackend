/**
 * One-time seed: create/update superadmin and admin from env vars.
 * No credentials in code; run with SEED_SUPERADMIN_EMAIL, SEED_SUPERADMIN_PASSWORD, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD.
 * Usage: set env vars then run from repo root: node backend/scripts/seed-superadmin-admin.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { connectDB } = require('../config/db');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

const superadminEmail = process.env.SEED_SUPERADMIN_EMAIL;
const superadminPassword = process.env.SEED_SUPERADMIN_PASSWORD;
const adminEmail = process.env.SEED_ADMIN_EMAIL;
const adminPassword = process.env.SEED_ADMIN_PASSWORD;

async function seed() {
    if (!superadminEmail || !superadminPassword || !adminEmail || !adminPassword) {
        console.error('Set SEED_SUPERADMIN_EMAIL, SEED_SUPERADMIN_PASSWORD, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD');
        process.exit(1);
    }
    await connectDB();
    const hash1 = await bcrypt.hash(superadminPassword, 10);
    const hash2 = await bcrypt.hash(adminPassword, 10);
    const [u1] = await User.findOrCreate({
        where: { email: superadminEmail.trim().toLowerCase() },
        defaults: { password: hash1, role: 'superadmin' },
    });
    if (u1.role !== 'superadmin' || !(await bcrypt.compare(superadminPassword, u1.password))) {
        u1.password = hash1;
        u1.role = 'superadmin';
        await u1.save();
    }
    console.log('Superadmin:', superadminEmail);
    const [u2] = await User.findOrCreate({
        where: { email: adminEmail.trim().toLowerCase() },
        defaults: { password: hash2, role: 'admin' },
    });
    if (u2.role !== 'admin' || !(await bcrypt.compare(adminPassword, u2.password))) {
        u2.password = hash2;
        u2.role = 'admin';
        await u2.save();
    }
    console.log('Admin:', adminEmail);
    console.log('Done.');
    process.exit(0);
}
seed().catch((e) => {
    console.error(e);
    process.exit(1);
});
