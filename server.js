require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const patientRoutes = require('./routes/patientRoutes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10kb' }));

app.use((req, res, next) => {
    if (req.path === '/api/users/login' && req.method === 'POST') {
        console.log('POST /api/users/login received');
    }
    next();
});

app.get('/api/health', (req, res) => {
    console.log('GET /api/health – mobile app connection check');
    res.json({ ok: true, message: 'DermaScope API' });
});

app.use('/api/users', userRoutes);
app.use('/api/auth', userRoutes); // same routes for frontend login (e.g. /api/auth/login)
app.use('/api/admin', adminRoutes);
app.use('/api/patients', patientRoutes);

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

async function start() {
    try {
        await connectDB();
        app.listen(PORT, HOST, () => {
            console.log(`Server running on http://0.0.0.0:${PORT}`);
            console.log('From phone use: API_BASE_URL=http://YOUR_PC_IP:' + PORT);
        });
    } catch (err) {
        console.error('Failed to start server:', err.message);
        process.exit(1);
    }
}

start();
