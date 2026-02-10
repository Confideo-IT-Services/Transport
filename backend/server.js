require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:8081', // Expo web
    /^exp:\/\/.*/, // Allow all Expo URLs (mobile app)
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json());

// Import routes
const authRoutes = require('./routes/auth');
const schoolsRoutes = require('./routes/schools');
const teachersRoutes = require('./routes/teachers');
const classesRoutes = require('./routes/classes');
const studentsRoutes = require('./routes/students');
const homeworkRoutes = require('./routes/homework');
const schoolAdminsRoutes = require('./routes/schoolAdmins');
const registrationLinksRoutes = require('./routes/registrationLinks');
const uploadRoutes = require('./routes/upload');
const timetableRoutes = require('./routes/timetable');
const attendanceRoutes = require('./routes/attendance');
const testsRoutes = require('./routes/tests');
const academicYearsRoutes = require('./routes/academicYears');
const feesRoutes = require('./routes/fees');
const idCardTemplatesRoutes = require('./routes/idCardTemplates');
const idCardGenerationRoutes = require('./routes/idCardGeneration');
const otpRoutes = require('./routes/otp');
const notificationsRoutes = require('./routes/notifications');
const whatsappRoutes = require('./routes/whatsapp');
const parentRoutes = require('./routes/parents');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/schools', schoolsRoutes);
app.use('/api/teachers', teachersRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/homework', homeworkRoutes);
app.use('/api/school-admins', schoolAdminsRoutes);
app.use('/api/registration-links', registrationLinksRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/tests', testsRoutes);
app.use('/api/academic-years', academicYearsRoutes);
app.use('/api/fees', feesRoutes);
app.use('/api/id-templates', idCardTemplatesRoutes);
app.use('/api/id-cards', idCardGenerationRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/parents', parentRoutes);

// Import background jobs (optional)
if (process.env.ENABLE_WHATSAPP_STATUS_CHECK === 'true') {
  require('./jobs/checkWhatsAppStatus');
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Listen on all network interfaces

app.listen(PORT, HOST, () => {
  console.log(`🚀 ConventPulse API Server running on port ${PORT}`);
  console.log(`📍 API Base URL (localhost): http://localhost:${PORT}/api`);
  console.log(`📍 API Base URL (network): http://192.168.0.33:${PORT}/api`);
  console.log(`🌐 Server accessible from all network interfaces`);
});
