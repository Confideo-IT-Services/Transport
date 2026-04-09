process.env.TZ = 'Asia/Kolkata';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');

const app = express();

/** Origins allowed for browser CORS (Vite, Expo, deployed app). */
const envOrigins = []
  .concat(process.env.FRONTEND_URLS ? String(process.env.FRONTEND_URLS).split(',') : [])
  .concat(process.env.FRONTEND_URL ? [String(process.env.FRONTEND_URL)] : [])
  .map((s) => String(s).trim())
  .filter(Boolean);

const corsStaticOrigins = [
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:8081', // Expo web
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:8081',
  ...envOrigins,
].filter(Boolean);

function corsOrigin(origin, callback) {
  // Non-browser clients (curl, server-to-server) send no Origin
  if (!origin) {
    return callback(null, true);
  }
  if (corsStaticOrigins.includes(origin)) {
    return callback(null, true);
  }
  if (/^exp:\/\//.test(origin)) {
    return callback(null, true);
  }
  // Dev: any localhost / 127.0.0.1 with a port (e.g. Vite on a different port)
  if (process.env.NODE_ENV !== 'production') {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
  }
  return callback(null, false);
}

// Middleware
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));
app.use(express.json());

// Security Note: 
// - All routes use authenticateToken middleware which ensures school_id is in req.user
// - Consider using SecureQueryBuilder (backend/utils/query-builder.js) for new routes
// - Audit logging available via backend/utils/audit-logger.js
// - Run security audits: node backend/scripts/audit-data-isolation.js
// - See backend/SECURITY_GUIDE.md for details

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
const visitorRequestsRoutes = require('./routes/visitorRequests');
const tutorRoutes = require('./routes/tutor');
const ragRoutes = require('./routes/rag');
const transportRoutes = require('./routes/transport');

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
app.use('/api/visitor-requests', visitorRequestsRoutes);
app.use('/api/tutor', tutorRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/transport', transportRoutes);

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
