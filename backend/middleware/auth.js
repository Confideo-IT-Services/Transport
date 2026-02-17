const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('❌ authenticateToken failed: No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('❌ authenticateToken failed: Invalid token', { error: err.message });
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    // Log decoded user info for debugging
    console.log('✅ Token verified:', {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      schoolId: user.schoolId,
      school_id: user.school_id
    });
    
    // Normalize schoolId - ensure both formats are available
    if (user.schoolId && !user.school_id) {
      user.school_id = user.schoolId;
    }
    if (user.school_id && !user.schoolId) {
      user.schoolId = user.school_id;
    }
    
    req.user = user;
    next();
  });
};

// Normalize role for comparison (DB/drivers may return "super admin", "super_admin", etc.)
function normalizeRole(role) {
  if (!role) return '';
  return String(role).toLowerCase().replace(/[\s_-]+/g, '');
}

// Check if user is super admin
const requireSuperAdmin = (req, res, next) => {
  if (normalizeRole(req.user.role) !== 'superadmin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
};

// Check if user is school admin
const requireAdmin = (req, res, next) => {
  // Debug logging
  if (!req.user) {
    console.log('❌ requireAdmin failed: No user in request');
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const userRole = req.user.role;
  console.log('🔍 requireAdmin check:', {
    role: userRole,
    roleType: typeof userRole,
    userId: req.user?.id,
    email: req.user?.email,
    schoolId: req.user?.schoolId,
    allUserProps: Object.keys(req.user || {})
  });
  
  // Check if role exists and is valid
  if (!userRole) {
    console.log('❌ requireAdmin failed: No role in user object');
    return res.status(403).json({ error: 'Admin access required: Role not found in token' });
  }
  
  // Normalize role to lowercase for comparison (in case of case mismatch)
  const normalizedRole = String(userRole).toLowerCase();
  
  if (normalizedRole !== 'admin' && normalizedRole !== 'superadmin') {
    console.log('❌ requireAdmin failed: Invalid role', { 
      role: userRole, 
      normalizedRole,
      expected: ['admin', 'superadmin']
    });
    return res.status(403).json({ 
      error: 'Admin access required',
      details: `Current role: ${userRole}. Required: admin or superadmin`
    });
  }
  
  console.log('✅ requireAdmin passed');
  next();
};

// Check if user is teacher (use normalized role so "super admin" etc. from token is accepted)
const requireTeacher = (req, res, next) => {
  const role = normalizeRole(req.user.role);
  if (role !== 'teacher' && role !== 'admin' && role !== 'superadmin') {
    return res.status(403).json({ error: 'Teacher access required' });
  }
  next();
};

// Check if user is parent
const requireParent = (req, res, next) => {
  if (normalizeRole(req.user.role) !== 'parent') {
    return res.status(403).json({ error: 'Parent access required' });
  }
  next();
};

// Generate JWT token
const generateToken = (user) => {
  // Ensure superadmin variants become exactly "superadmin" for frontend/requireSuperAdmin
  const rawRole = user.role ? String(user.role).toLowerCase() : '';
  const normalizedRole = rawRole.replace(/[\s_-]+/g, '') === 'superadmin' ? 'superadmin' : rawRole;

  const tokenPayload = {
    id: user.id,
    email: user.email,
    username: user.username,
    phone: user.phone, // Add phone for parent role
    role: normalizedRole,
    schoolId: user.school_id,
    schoolName: user.school_name
  };
  
  console.log('🔑 Generating token with payload:', {
    id: tokenPayload.id,
    email: tokenPayload.email,
    phone: tokenPayload.phone,
    role: tokenPayload.role,
    originalRole: user.role
  });
  
  return jwt.sign(
    tokenPayload,
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

module.exports = {
  authenticateToken,
  requireSuperAdmin,
  requireAdmin,
  requireTeacher,
  requireParent,
  generateToken
};
