const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const authRoutes    = require('./routes/auth');
const adminRoutes   = require('./routes/admin');
const tenantRoutes  = require('./routes/tenant');

app.use('/api/auth',   authRoutes);
app.use('/api/admin',  adminRoutes);
app.use('/api/tenant', tenantRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'RentMS API Running', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB Connected');

    const User    = require('./models/User');
    const bcrypt  = require('bcryptjs');

    const existingAdmin = await User.findOne({ role: 'admin' });
if (!existingAdmin) {
  await User.create({
    name: 'System Admin',
    email: 'admin@rentms.com',
    phone: '9999999999',
    password: 'admin123',
    role: 'admin'
  });
  console.log('✅ Default admin created: admin@rentms.com / admin123');
}

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
