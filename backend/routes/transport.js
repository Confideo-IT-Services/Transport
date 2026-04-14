/**
 * Transport module API — drivers, buses, routes (PostgreSQL / RDS).
 * Create/list: transport admin secret OR JWT (school admin / superadmin).
 * Driver login: public; returns JWT with role transport_driver.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { generateToken, authenticateToken } = require('../middleware/auth');
const awsPolyline = require('@aws/polyline');
const { LocationClient, BatchUpdateDevicePositionCommand, GetDevicePositionCommand } = require('@aws-sdk/client-location');
const { sendTransportEmail } = require('../utils/sesMailer');

const router = express.Router();

function normalizeRole(role) {
  if (!role) return '';
  return String(role).trim().toLowerCase().replace(/[\s_-]+/g, '');
}

/** Transport admin UI (secret) or school admin / superadmin JWT */
function requireTransportAdmin(req, res, next) {
  const secret = req.headers['x-transport-admin-secret'];
  if (process.env.TRANSPORT_ADMIN_SECRET && secret === process.env.TRANSPORT_ADMIN_SECRET) {
    return next();
  }
  return authenticateToken(req, res, () => {
    const r = normalizeRole(req.user.role);
    if (r === 'admin' || r === 'superadmin') return next();
    return res.status(403).json({
      error: 'Forbidden',
      details: 'Set X-Transport-Admin-Secret header or login as school admin / superadmin',
    });
  });
}

/** Parent JWT OR transport admin secret OR admin/superadmin JWT */
function requireTransportParentOrAdmin(req, res, next) {
  const secret = req.headers['x-transport-admin-secret'];
  if (process.env.TRANSPORT_ADMIN_SECRET && secret === process.env.TRANSPORT_ADMIN_SECRET) {
    return next();
  }
  return authenticateToken(req, res, () => {
    const r = normalizeRole(req.user.role);
    if (r === 'parent' || r === 'admin' || r === 'superadmin') return next();
    return res.status(403).json({
      error: 'Forbidden',
      details: 'Parent/admin login required',
    });
  });
}

/** Transport admin secret OR any JWT (admin/superadmin/transport_driver) */
function requireTransportUser(req, res, next) {
  const secret = req.headers['x-transport-admin-secret'];
  if (process.env.TRANSPORT_ADMIN_SECRET && secret === process.env.TRANSPORT_ADMIN_SECRET) {
    return next();
  }
  return authenticateToken(req, res, () => {
    const r = normalizeRole(req.user.role);
    if (r === 'admin' || r === 'superadmin' || r === 'transportdriver') return next();
    return res.status(403).json({
      error: 'Forbidden',
      details: 'Login required',
    });
  });
}

/** RFID scanner (device) secret (header) OR transport admin secret OR admin/superadmin JWT */
function requireTransportScanner(req, res, next) {
  const scannerSecret = req.headers['x-transport-scanner-secret'];
  if (process.env.TRANSPORT_SCANNER_SECRET && scannerSecret === process.env.TRANSPORT_SCANNER_SECRET) {
    return next();
  }
  // Allow transport admin secret and admin JWT as fallback for manual testing.
  const adminSecret = req.headers['x-transport-admin-secret'];
  if (process.env.TRANSPORT_ADMIN_SECRET && adminSecret === process.env.TRANSPORT_ADMIN_SECRET) {
    return next();
  }
  return authenticateToken(req, res, () => {
    const r = normalizeRole(req.user.role);
    // Allow driver JWT so driver mobile web app can submit NFC scans.
    if (r === 'admin' || r === 'superadmin' || r === 'transportdriver') return next();
    return res.status(403).json({
      error: 'Forbidden',
      details: 'Set X-Transport-Scanner-Secret (device) or X-Transport-Admin-Secret / admin login',
    });
  });
}

function mapStopRow(r) {
  return {
    id: String(r.id),
    name: r.name,
    sequenceOrder: r.sequence_order,
    lat: r.lat != null ? Number(r.lat) : null,
    lng: r.lng != null ? Number(r.lng) : null,
  };
}

async function loadStopsForRoute(routeId, direction) {
  if (!routeId) return [];
  const order = direction === 'desc' ? 'DESC' : 'ASC';
  const [rows] = await db.query(
    `SELECT id, name, sequence_order, lat, lng FROM transport_route_stops WHERE route_id = ? ORDER BY sequence_order ${order}`,
    [routeId],
  );
  return (rows || []).map(mapStopRow);
}

function mapDriverSummary(row) {
  return {
    id: String(row.id),
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    licenseNo: row.license_no,
    busId: row.bus_id != null ? String(row.bus_id) : null,
    busName: row.bus_name || null,
    busRegistrationNo: row.bus_registration_no || null,
    busCapacity: row.bus_capacity != null ? Number(row.bus_capacity) : null,
    morningRouteId: row.morning_route_id != null ? String(row.morning_route_id) : null,
    morningRouteName: row.morning_route_name || null,
    eveningRouteId: row.evening_route_id != null ? String(row.evening_route_id) : null,
    eveningRouteName: row.evening_route_name || null,
    createdAt: row.created_at,
  };
}

async function buildDriverResponse(row) {
  const morningStops = await loadStopsForRoute(row.morning_route_id, 'asc');
  const eveningStops = await loadStopsForRoute(row.evening_route_id, 'desc');
  return {
    id: String(row.id),
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    licenseNo: row.license_no,
    busId: row.bus_id != null ? String(row.bus_id) : null,
    busName: row.bus_name || null,
    busRegistrationNo: row.bus_registration_no || null,
    busCapacity: row.bus_capacity != null ? Number(row.bus_capacity) : null,
    morningRouteId: row.morning_route_id != null ? String(row.morning_route_id) : null,
    morningRouteName: row.morning_route_name || null,
    morningStops,
    eveningRouteId: row.evening_route_id != null ? String(row.evening_route_id) : null,
    eveningRouteName: row.evening_route_name || null,
    eveningStops,
  };
}

/** GET /api/transport/buses */
router.get('/buses', requireTransportAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, registration_no, capacity, created_at FROM transport_buses ORDER BY name ASC',
      [],
    );
    res.json({
      buses: (rows || []).map((r) => ({
        id: String(r.id),
        name: r.name,
        registrationNo: r.registration_no,
        capacity: r.capacity,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error('transport list buses:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({
        error: 'Database not ready',
        details: 'Run backend/sql/2026-04-08-transport_fleet.sql',
      });
    }
    res.status(500).json({ error: 'Failed to list buses' });
  }
});

/**
 * GET /api/transport/buses/:busId/pickup-points?schoolId=...&tripType=morning
 * Returns pickup points derived from the assigned driver's route stops.
 * Also syncs stops into transport_pickup_points (route_stop_id) so assignment can store pickup_point_id.
 */
router.get('/buses/:busId/pickup-points', requireTransportAdmin, async (req, res) => {
  try {
    const busId = String(req.params.busId || '').trim();
    const tripType = req.query.tripType != null ? String(req.query.tripType).trim().toLowerCase() : 'morning';
    const schoolId = req.user?.schoolId || req.user?.school_id || null;
    const effectiveSchoolId = schoolId || (req.query.schoolId ? String(req.query.schoolId) : null);
    if (!busId) return res.status(400).json({ error: 'busId is required' });
    if (!effectiveSchoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (tripType !== 'morning' && tripType !== 'evening') return res.status(400).json({ error: 'tripType must be morning|evening' });

    const [drivers] = await db.query(
      `SELECT morning_route_id, evening_route_id FROM transport_drivers WHERE bus_id = ? LIMIT 1`,
      [busId],
    );
    if (!drivers || !drivers.length) {
      return res.json({ pickupPoints: [] });
    }
    const routeId = tripType === 'evening' ? drivers[0].evening_route_id : drivers[0].morning_route_id;
    if (!routeId) return res.json({ pickupPoints: [] });

    const order = tripType === 'evening' ? 'DESC' : 'ASC';
    const [stops] = await db.query(
      `SELECT id, name, lat, lng, sequence_order
       FROM transport_route_stops
       WHERE route_id = ?
       ORDER BY sequence_order ${order}`,
      [String(routeId)],
    );

    // Sync route stops into pickup points table so assignment can reference pickup_point_id.
    // Uses unique (school_id, route_stop_id) index.
    for (const s of stops || []) {
      try {
        await db.query(
          `
          INSERT INTO transport_pickup_points (school_id, route_stop_id, name, lat, lng)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (school_id, route_stop_id)
          DO UPDATE SET name = EXCLUDED.name, lat = EXCLUDED.lat, lng = EXCLUDED.lng
          `,
          [String(effectiveSchoolId), String(s.id), String(s.name || '').trim(), Number(s.lat), Number(s.lng)],
        );
      } catch (e) {
        console.error('transport bus pickup points sync stop failed:', e);
      }
    }

    const [rows] = await db.query(
      `
      SELECT id, name, lat, lng, route_stop_id
      FROM transport_pickup_points
      WHERE school_id = ? AND route_stop_id IS NOT NULL
        AND route_stop_id IN (${(stops || []).map(() => '?').join(',') || "NULL"})
      `,
      [String(effectiveSchoolId), ...(stops || []).map((s) => String(s.id))],
    );

    // Preserve stop order from route stops
    const byStopId = new Map((rows || []).map((r) => [String(r.route_stop_id), r]));
    const pickupPoints = (stops || [])
      .map((s) => {
        const r = byStopId.get(String(s.id));
        if (!r) return null;
        return {
          id: String(r.id),
          name: r.name,
          lat: Number(r.lat),
          lng: Number(r.lng),
          routeStopId: String(r.route_stop_id),
        };
      })
      .filter(Boolean);

    res.json({ busId, tripType, pickupPoints });
  } catch (err) {
    console.error('transport bus pickup points:', err);
    res.status(500).json({ error: 'Failed to load bus pickup points' });
  }
});

/** POST /api/transport/buses */
router.post('/buses', requireTransportAdmin, async (req, res) => {
  try {
    const { name, registrationNo, capacity } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const [insertRows] = await db.query(
      `INSERT INTO transport_buses (name, registration_no, capacity)
       VALUES (?, ?, ?) RETURNING id`,
      [
        String(name).trim(),
        registrationNo != null ? String(registrationNo).trim() : null,
        capacity != null ? parseInt(String(capacity), 10) : null,
      ],
    );
    const newId = insertRows && insertRows[0] && insertRows[0].id ? String(insertRows[0].id) : null;
    res.status(201).json({ ok: true, id: newId, message: 'Bus created' });
  } catch (err) {
    console.error('transport create bus:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({
        error: 'Database not ready',
        details: 'Run backend/sql/2026-04-08-transport_fleet.sql',
      });
    }
    res.status(500).json({ error: 'Failed to create bus' });
  }
});

/** PATCH /api/transport/buses/:id — update bus metadata */
router.patch('/buses/:id', requireTransportAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, registrationNo, capacity } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
    const cap = capacity != null ? parseInt(String(capacity), 10) : null;
    if (capacity != null && (Number.isNaN(cap) || cap < 1)) {
      return res.status(400).json({ error: 'capacity must be a positive integer' });
    }
    const [upd] = await db.query(
      `UPDATE transport_buses SET name = ?, registration_no = ?, capacity = ? WHERE id = ? RETURNING id`,
      [String(name).trim(), registrationNo != null ? String(registrationNo).trim() : null, cap, String(id)],
    );
    if (!upd || !upd.length) return res.status(404).json({ error: 'Bus not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('transport patch bus:', err);
    res.status(500).json({ error: 'Failed to update bus' });
  }
});

/** DELETE /api/transport/buses/:id — delete bus (only if unassigned) */
router.delete('/buses/:id', requireTransportAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id is required' });
    const [inUse] = await db.query(`SELECT id FROM transport_drivers WHERE bus_id = ? LIMIT 1`, [String(id)]);
    if (inUse && inUse.length) {
      return res.status(409).json({ error: 'Bus is assigned to a driver. Unassign it first.' });
    }
    const [childUse] = await db.query(`SELECT student_id FROM transport_student_assignments WHERE bus_id = ? LIMIT 1`, [
      String(id),
    ]);
    if (childUse && childUse.length) {
      return res.status(409).json({ error: 'Bus is assigned to children. Unassign them first.' });
    }
    const [del] = await db.query(`DELETE FROM transport_buses WHERE id = ? RETURNING id`, [String(id)]);
    if (!del || !del.length) return res.status(404).json({ error: 'Bus not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('transport delete bus:', err);
    res.status(500).json({ error: 'Failed to delete bus' });
  }
});

/** PATCH /api/transport/buses/:id/unassign-children — clears bus_id for all children assignments on this bus */
router.patch('/buses/:id/unassign-children', requireTransportAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id is required' });
    await db.query(
      `UPDATE transport_student_assignments
       SET bus_id = NULL, updated_at = NOW()
       WHERE bus_id = ?`,
      [String(id)],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('transport unassign bus children:', err);
    res.status(500).json({ error: 'Failed to unassign children from bus' });
  }
});

/** PATCH /api/transport/buses/:id/unassign-driver — clears driver assignment so bus can be deleted */
router.patch('/buses/:id/unassign-driver', requireTransportAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id is required' });

    // Unassign any driver currently bound to this bus.
    // Also clear routes to keep driver profile consistent.
    await db.query(
      `UPDATE transport_drivers
       SET bus_id = NULL, morning_route_id = NULL, evening_route_id = NULL
       WHERE bus_id = ?`,
      [String(id)],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('transport unassign driver from bus:', err);
    res.status(500).json({ error: 'Failed to unassign driver from bus' });
  }
});

/** GET /api/transport/routes */
router.get('/routes', requireTransportAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, created_at FROM transport_routes ORDER BY name ASC',
      [],
    );
    const routes = (rows || []).map((r) => ({
      id: String(r.id),
      name: r.name,
      createdAt: r.created_at,
    }));

    const includeStops = String(req.query.includeStops || '') === '1' || req.query.includeStops === 'true';
    if (!includeStops) {
      return res.json({ routes });
    }

    const out = [];
    for (const r of routes) {
      const [stops] = await db.query(
        'SELECT id, name, sequence_order, lat, lng FROM transport_route_stops WHERE route_id = ? ORDER BY sequence_order ASC',
        [r.id],
      );
      out.push({
        ...r,
        stops: (stops || []).map(mapStopRow),
      });
    }
    res.json({ routes: out });
  } catch (err) {
    console.error('transport list routes:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({
        error: 'Database not ready',
        details: 'Run backend/sql/2026-04-08-transport_fleet.sql',
      });
    }
    res.status(500).json({ error: 'Failed to list routes' });
  }
});

/**
 * GET /api/transport/routes/:routeId/stop-children?tripType=morning&date=YYYY-MM-DD
 * Admin-only. Returns route stops and children assigned to each stop (morning: pickup_point_id, evening: drop_point_id),
 * including today's onboard/verified status derived from transport_bus_boarding.
 */
router.get('/routes/:routeId/stop-children', requireTransportAdmin, async (req, res) => {
  try {
    const routeId = String(req.params.routeId || '').trim();
    if (!routeId) return res.status(400).json({ error: 'routeId is required' });

    const tripType = String(req.query.tripType || 'morning') === 'evening' ? 'evening' : 'morning';
    const pointCol = tripType === 'evening' ? 'drop_point_id' : 'pickup_point_id';
    const date = String(req.query.date || '').trim() || toUtcDateString(new Date());

    const [stopRows] = await db.query(
      'SELECT id, name, sequence_order, lat, lng FROM transport_route_stops WHERE route_id = ? ORDER BY sequence_order ASC',
      [routeId],
    );
    const stops = (stopRows || []).map(mapStopRow);
    if (!stops.length) {
      return res.status(404).json({ error: 'Route not found (no stops)' });
    }

    const [rows] = await db.query(
      `
      SELECT
        rs.id AS route_stop_id,
        c.id AS student_id,
        c.child_name,
        c.gender,
        c.parent_email,
        a.bus_id,
        rt.tag_uid AS rfid_tag_uid,
        bb.status AS boarding_status,
        bb.last_scanned_at
      FROM transport_route_stops rs
      LEFT JOIN transport_pickup_points pp
        ON pp.route_stop_id = rs.id
      LEFT JOIN transport_student_assignments a
        ON a.${pointCol} = pp.id
      LEFT JOIN transport_children c
        ON c.id = a.student_id
      LEFT JOIN transport_rfid_tags rt
        ON rt.assigned_student_id = c.id
      LEFT JOIN transport_bus_boarding bb
        ON bb.bus_id = a.bus_id
       AND bb.trip_type = ?
       AND bb.trip_date = ?::date
       AND bb.student_id = c.id
      WHERE rs.route_id = ?
      ORDER BY rs.sequence_order ASC, c.child_name ASC
      `,
      [tripType, date, routeId],
    );

    const byStopId = new Map();
    for (const r of rows || []) {
      const stopId = r.route_stop_id != null ? String(r.route_stop_id) : null;
      if (!stopId) continue;
      if (!r.student_id) continue;
      const list = byStopId.get(stopId) || [];
      list.push({
        id: String(r.student_id),
        childName: r.child_name,
        gender: r.gender || null,
        parentEmail: r.parent_email || null,
        busId: r.bus_id != null ? String(r.bus_id) : null,
        rfidTagUid: r.rfid_tag_uid || null,
        onboarded: String(r.boarding_status || '').toLowerCase() === 'on',
        lastScannedAt: r.last_scanned_at || null,
      });
      byStopId.set(stopId, list);
    }

    res.json({
      ok: true,
      routeId,
      tripType,
      date,
      stops: stops.map((s) => ({
        ...s,
        children: byStopId.get(String(s.id)) || [],
      })),
    });
  } catch (err) {
    console.error('transport route stop-children:', err);
    res.status(500).json({ error: 'Failed to load route stop children' });
  }
});

/** POST /api/transport/routes — body: { name, stops: [{ name, lat, lng }] } */
router.post('/routes', requireTransportAdmin, async (req, res) => {
  try {
    const { name, stops } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!Array.isArray(stops) || stops.length === 0) {
      return res.status(400).json({ error: 'stops must be a non-empty array' });
    }

    const conn = await db.getConnection();
    let routeId;
    try {
      await conn.beginTransaction();
      const [ins] = await conn.query(
        `INSERT INTO transport_routes (name) VALUES (?) RETURNING id`,
        [String(name).trim()],
      );
      routeId = ins && ins[0] && ins[0].id ? ins[0].id : null;
      if (!routeId) {
        throw new Error('Failed to create route');
      }
      let seq = 0;
      for (const s of stops) {
        seq += 1;
        const lat = s.lat != null ? Number(s.lat) : NaN;
        const lng = s.lng != null ? Number(s.lng) : NaN;
        if (!s.name || Number.isNaN(lat) || Number.isNaN(lng)) {
          throw new Error('Each stop needs name, lat, lng');
        }
        await conn.query(
          `INSERT INTO transport_route_stops (route_id, sequence_order, name, lat, lng) VALUES (?, ?, ?, ?, ?)`,
          [routeId, seq, String(s.name).trim(), lat, lng],
        );
      }
      await conn.commit();
      res.status(201).json({ ok: true, id: String(routeId), message: 'Route created' });
    } catch (e) {
      try {
        await conn.rollback();
      } catch (_) {
        /* ignore */
      }
      if (e.message && e.message.includes('Each stop')) {
        conn.release();
        return res.status(400).json({ error: e.message });
      }
      conn.release(e);
      throw e;
    }
    conn.release();
  } catch (err) {
    console.error('transport create route:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({
        error: 'Database not ready',
        details: 'Run backend/sql/2026-04-08-transport_fleet.sql',
      });
    }
    res.status(500).json({ error: 'Failed to create route' });
  }
});

/** POST /api/transport/driver/login */
router.post('/driver/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [rows] = await db.query(
      `SELECT d.id, d.email, d.password_hash, d.full_name, d.phone, d.license_no,
              d.bus_id, d.morning_route_id, d.evening_route_id,
              b.name AS bus_name, b.registration_no AS bus_registration_no, b.capacity AS bus_capacity,
              mr.name AS morning_route_name, er.name AS evening_route_name
       FROM transport_drivers d
       LEFT JOIN transport_buses b ON b.id = d.bus_id
       LEFT JOIN transport_routes mr ON mr.id = d.morning_route_id
       LEFT JOIN transport_routes er ON er.id = d.evening_route_id
       WHERE d.email = ?`,
      [String(email).trim().toLowerCase()],
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const row = rows[0];
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({
      id: String(row.id),
      email: row.email,
      username: row.full_name || row.email,
      role: 'transport_driver',
      school_id: null,
    });

    const driver = await buildDriverResponse(row);

    res.json({
      token,
      driver,
    });
  } catch (err) {
    console.error('transport driver login:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({
        error: 'Database not ready',
        details: 'Run transport SQL migrations on your database',
      });
    }
    res.status(500).json({ error: 'Login failed' });
  }
});

/** GET /api/transport/driver/me — Bearer transport_driver JWT */
router.get('/driver/me', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Bearer token required' });
    }
    const token = auth.slice(7);
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (normalizeRole(decoded.role) !== 'transportdriver') {
      return res.status(403).json({ error: 'Not a driver session' });
    }

    const [rows] = await db.query(
      `SELECT d.id, d.email, d.full_name, d.phone, d.license_no,
              d.bus_id, d.morning_route_id, d.evening_route_id,
              b.name AS bus_name, b.registration_no AS bus_registration_no, b.capacity AS bus_capacity,
              mr.name AS morning_route_name, er.name AS evening_route_name
       FROM transport_drivers d
       LEFT JOIN transport_buses b ON b.id = d.bus_id
       LEFT JOIN transport_routes mr ON mr.id = d.morning_route_id
       LEFT JOIN transport_routes er ON er.id = d.evening_route_id
       WHERE d.id = ?`,
      [decoded.id],
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    const driver = await buildDriverResponse(rows[0]);
    res.json({ driver });
  } catch (err) {
    console.error('transport driver me:', err);
    res.status(500).json({ error: 'Failed to load driver' });
  }
});

/** POST /api/transport/driver/password — change driver password (Bearer transport_driver JWT) */
router.post('/driver/password', authenticateToken, async (req, res) => {
  try {
    const r = normalizeRole(req.user?.role);
    if (r !== 'transportdriver') {
      return res.status(403).json({ error: 'Driver session required' });
    }
    const driverId = String(req.user.id || '');
    const currentPassword = req.body?.currentPassword != null ? String(req.body.currentPassword) : '';
    const newPassword = req.body?.newPassword != null ? String(req.body.newPassword) : '';
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const [rows] = await db.query(`SELECT password_hash FROM transport_drivers WHERE id = ? LIMIT 1`, [driverId]);
    if (!rows || !rows.length) return res.status(404).json({ error: 'Driver not found' });
    const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.query(`UPDATE transport_drivers SET password_hash = ? WHERE id = ?`, [hash, driverId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('transport driver change password:', err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

/** PATCH /api/transport/drivers/:id/password — admin reset driver password */
router.patch('/drivers/:id/password', requireTransportAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const newPassword = req.body?.newPassword != null ? String(req.body.newPassword) : '';
    if (!newPassword) return res.status(400).json({ error: 'newPassword is required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const hash = await bcrypt.hash(newPassword, 10);
    const [upd] = await db.query(`UPDATE transport_drivers SET password_hash = ? WHERE id = ? RETURNING id`, [
      hash,
      String(id),
    ]);
    if (!upd || !upd.length) return res.status(404).json({ error: 'Driver not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('transport admin reset driver password:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

/** GET /api/transport/drivers */
router.get('/drivers', requireTransportAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT d.id, d.email, d.full_name, d.phone, d.license_no,
              d.bus_id, d.morning_route_id, d.evening_route_id,
              b.name AS bus_name, mr.name AS morning_route_name, er.name AS evening_route_name,
              d.created_at
       FROM transport_drivers d
       LEFT JOIN transport_buses b ON b.id = d.bus_id
       LEFT JOIN transport_routes mr ON mr.id = d.morning_route_id
       LEFT JOIN transport_routes er ON er.id = d.evening_route_id
       ORDER BY d.created_at DESC`,
      [],
    );
    const drivers = (rows || []).map((r) => mapDriverSummary(r));
    res.json({ drivers });
  } catch (err) {
    console.error('transport list drivers:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({
        error: 'Database not ready',
        details: 'Run transport SQL migrations',
      });
    }
    res.status(500).json({ error: 'Failed to list drivers' });
  }
});

/** POST /api/transport/drivers */
router.post('/drivers', requireTransportAdmin, async (req, res) => {
  try {
    const { email, password, fullName, phone, licenseNo, busId, morningRouteId, eveningRouteId } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (!busId || !morningRouteId || !eveningRouteId) {
      return res.status(400).json({ error: 'busId, morningRouteId, and eveningRouteId are required' });
    }
    if (String(morningRouteId) === String(eveningRouteId)) {
      return res.status(400).json({ error: 'Morning and evening route must be different' });
    }

    // Enforce: a route can only be assigned to ONE driver at a time (either slot).
    const [conflicts] = await db.query(
      `SELECT id, email FROM transport_drivers
       WHERE morning_route_id IN (?, ?) OR evening_route_id IN (?, ?)
       LIMIT 1`,
      [String(morningRouteId), String(eveningRouteId), String(morningRouteId), String(eveningRouteId)],
    );
    if (conflicts && conflicts.length) {
      return res.status(409).json({ error: 'Route is already assigned to another driver' });
    }

    // Enforce: a bus can only be assigned to ONE driver at a time.
    const [busConflicts] = await db.query(
      `SELECT id, email FROM transport_drivers WHERE bus_id = ? LIMIT 1`,
      [String(busId)],
    );
    if (busConflicts && busConflicts.length) {
      return res.status(409).json({ error: 'Bus is already assigned to another driver' });
    }

    const hash = await bcrypt.hash(String(password), 10);
    const emailNorm = String(email).trim().toLowerCase();

    const [insertRows] = await db.query(
      `INSERT INTO transport_drivers (email, password_hash, full_name, phone, license_no, bus_id, morning_route_id, evening_route_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        emailNorm,
        hash,
        fullName ? String(fullName).trim() : null,
        phone ? String(phone).trim() : null,
        licenseNo ? String(licenseNo).trim() : null,
        String(busId),
        String(morningRouteId),
        String(eveningRouteId),
      ],
    );

    const newId = insertRows && insertRows[0] && insertRows[0].id ? String(insertRows[0].id) : null;
    res.status(201).json({
      ok: true,
      id: newId,
      message: 'Driver created',
    });
  } catch (err) {
    console.error('transport create driver:', err);
    if (err.code === 'ER_DUP_ENTRY' || err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === '23503') {
      return res.status(400).json({ error: 'Invalid bus or route id' });
    }
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({
        error: 'Database not ready',
        details: 'Run transport SQL migrations',
      });
    }
    res.status(500).json({ error: 'Failed to create driver' });
  }
});

function placesForwardHeaders(req) {
  const fallbackBase = (process.env.FRONTEND_URL || 'http://localhost:8081').trim().replace(/\/$/, '');
  const refererHeader = req.get('referer') || req.get('Referer') || `${fallbackBase}/`;
  let originHeader = req.get('origin') || req.get('Origin');
  if (!originHeader) {
    try {
      originHeader = new URL(refererHeader).origin;
    } catch {
      originHeader = fallbackBase;
    }
  }
  return { Referer: refererHeader, Origin: originHeader };
}

function getPlacesRegion() {
  return (process.env.AWS_PLACES_REGION || process.env.AWS_REGION || 'ap-south-1').trim();
}

function getTrackerRegion() {
  return (process.env.AWS_TRACKER_REGION || process.env.AWS_REGION || 'ap-south-1').trim();
}

function getTrackerName() {
  return (process.env.AWS_TRACKER_NAME || '').trim();
}

function getLocationClient(region) {
  // Allow dedicated credentials for Location Tracker calls (common when tracker is in a different AWS account).
  const accessKeyId = (process.env.AWS_TRACKER_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.AWS_TRACKER_SECRET_ACCESS_KEY || '').trim();
  const sessionToken = (process.env.AWS_TRACKER_SESSION_TOKEN || '').trim();
  const credentials =
    accessKeyId && secretAccessKey
      ? {
          accessKeyId,
          secretAccessKey,
          sessionToken: sessionToken || undefined,
        }
      : undefined;
  return new LocationClient({
    region,
    credentials,
  });
}

function toUtcDateString(d = new Date()) {
  // YYYY-MM-DD in UTC
  return d.toISOString().slice(0, 10);
}

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (n) => (n * Math.PI) / 180;
  const dLat = toRad((b.lat || 0) - (a.lat || 0));
  const dLng = toRad((b.lng || 0) - (a.lng || 0));
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const c =
    2 *
    Math.asin(
      Math.min(
        1,
        Math.sqrt(
          s1 * s1 +
            Math.cos(toRad(a.lat || 0)) * Math.cos(toRad(b.lat || 0)) * s2 * s2,
        ),
      ),
    );
  return R * c;
}

/** Bias for Autocomplete [lng, lat] — default Hyderabad. */
function getPlacesBias() {
  const lng = parseFloat(process.env.AWS_PLACES_BIAS_LNG || '78.4747');
  const lat = parseFloat(process.env.AWS_PLACES_BIAS_LAT || '17.3850');
  if (Number.isNaN(lng) || Number.isNaN(lat)) {
    return [78.4747, 17.3850];
  }
  return [lng, lat];
}

/** Optional country filter for Autocomplete, e.g. IND. Set AWS_PLACES_INCLUDE_COUNTRIES= to disable. */
function getAutocompleteCountryFilter() {
  const raw = process.env.AWS_PLACES_INCLUDE_COUNTRIES;
  if (raw === '') {
    return null;
  }
  const codes = (raw || 'IND')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return codes.length ? codes : null;
}

/**
 * GET /api/transport/places/autocomplete?q=...
 * Proxies Amazon Location Places Autocomplete (API key on server).
 */
router.get('/places/autocomplete', requireTransportAdmin, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      return res.json({ suggestions: [] });
    }
    const key = (process.env.AWS_LOCATION_API_KEY || '').trim();
    if (!key) {
      return res.status(503).json({ error: 'AWS_LOCATION_API_KEY is not set on the server' });
    }
    const region = getPlacesRegion();
    // Prefer Suggest for POI discovery (e.g., malls/apartments) — more complete than Autocomplete in many cases.
    const url = `https://places.geo.${region}.amazonaws.com/suggest?key=${encodeURIComponent(key)}`;
    const urlV2 = `https://places.geo.${region}.amazonaws.com/v2/suggest?key=${encodeURIComponent(key)}`;
    const body = {
      QueryText: q,
      MaxResults: 20,
      BiasPosition: getPlacesBias(),
      Language: 'en',
    };
    const countries = getAutocompleteCountryFilter();
    if (countries) {
      body.Filter = { IncludeCountries: countries };
    }
    const headers = {
      'Content-Type': 'application/json',
      ...placesForwardHeaders(req),
    };

    async function postJson(targetUrl) {
      const r = await fetch(targetUrl, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await r.json().catch(() => ({}));
      return { r, data };
    }

    let { r, data } = await postJson(url);
    // Some accounts/regions behave as if Suggest is only exposed under /v2/suggest for API keys.
    if (!r.ok) {
      const msg = String((data && (data.message || data.Message || data.error)) || '');
      if (r.status === 403 && /determine service\/operation name to be authorized/i.test(msg)) {
        ({ r, data } = await postJson(urlV2));
      }
    }
    if (!r.ok) {
      console.error('transport places autocomplete', r.status, data);
      return res.status(r.status >= 400 ? r.status : 502).json({
        error: data.message || data.Message || data.error || 'Autocomplete failed',
      });
    }
    const suggestions = (data.ResultItems || [])
      .filter((it) => it && it.Place && it.Place.PlaceId)
      .map((it) => {
        const place = it.Place || {};
        const title = it.Title || place.Title || '';
        const subtitle =
          place.Address && place.Address.Label
            ? place.Address.Label
            : place.Address && place.Address.Locality
              ? place.Address.Locality
              : '';
        return { placeId: place.PlaceId, title, subtitle };
      });
    res.json({ suggestions });
  } catch (err) {
    console.error('transport places autocomplete:', err);
    res.status(500).json({ error: 'Autocomplete failed' });
  }
});

/**
 * GET /api/transport/places/reverse-geocode?lat=..&lng=..
 * Returns a label/title for the cursor position (used for map hover tooltips).
 */
router.get('/places/reverse-geocode', requireTransportUser, async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }
    const key = (process.env.AWS_LOCATION_API_KEY || '').trim();
    if (!key) {
      return res.status(503).json({ error: 'AWS_LOCATION_API_KEY is not set on the server' });
    }
    const region = getPlacesRegion();
    const qs = new URLSearchParams({
      key,
      language: 'en',
      'intended-use': 'SingleUse',
    });
    // Places API keys use v2 endpoints; v1 can return 403 with "Unable to determine service/operation name..."
    const url = `https://places.geo.${region}.amazonaws.com/v2/reverse-geocode?${qs.toString()}`;
    const body = { QueryPosition: [lng, lat], MaxResults: 1 };
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...placesForwardHeaders(req),
      },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('transport reverse-geocode', r.status, data);
      return res.status(r.status >= 400 ? r.status : 502).json({
        error: data.message || data.Message || data.error || 'ReverseGeocode failed',
      });
    }
    const item = data.ResultItems && data.ResultItems[0] ? data.ResultItems[0] : null;
    const label =
      (item && item.Address && item.Address.Label) ||
      (item && item.Title) ||
      (item && item.PlaceId ? String(item.PlaceId) : '');
    res.json({ label: label || 'Unknown', lat, lng });
  } catch (err) {
    console.error('transport reverse-geocode:', err);
    res.status(500).json({ error: 'ReverseGeocode failed' });
  }
});

/**
 * GET /api/transport/places/details?placeId=...
 * Resolves PlaceId to name + lat/lng (GetPlace).
 */
router.get('/places/details', requireTransportAdmin, async (req, res) => {
  try {
    const placeId = String(req.query.placeId || '').trim();
    if (!placeId) {
      return res.status(400).json({ error: 'placeId is required' });
    }
    const key = (process.env.AWS_LOCATION_API_KEY || '').trim();
    if (!key) {
      return res.status(503).json({ error: 'AWS_LOCATION_API_KEY is not set on the server' });
    }
    const region = getPlacesRegion();
    const pathSeg = encodeURIComponent(placeId);
    const qs = new URLSearchParams({
      key,
      language: 'en',
      'intended-use': 'SingleUse',
    });
    const url = `https://places.geo.${region}.amazonaws.com/v2/place/${pathSeg}?${qs.toString()}`;
    const r = await fetch(url, {
      method: 'GET',
      headers: {
        ...placesForwardHeaders(req),
      },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('transport places details', r.status, data);
      return res.status(r.status >= 400 ? r.status : 502).json({
        error: data.message || data.error || 'GetPlace failed',
      });
    }
    const pos = data.Position;
    if (!Array.isArray(pos) || pos.length < 2) {
      return res.status(502).json({ error: 'No coordinates for this place' });
    }
    const lng = Number(pos[0]);
    const lat = Number(pos[1]);
    let name = '';
    if (data.Address && data.Address.Label) {
      name = data.Address.Label;
    } else if (typeof data.Title === 'string') {
      name = data.Title;
    } else if (Array.isArray(data.Title) && data.Title[0] && data.Title[0].Value) {
      name = data.Title[0].Value;
    } else {
      name = 'Stop';
    }
    res.json({
      placeId: data.PlaceId || placeId,
      name,
      lat,
      lng,
    });
  } catch (err) {
    console.error('transport places details:', err);
    res.status(500).json({ error: 'GetPlace failed' });
  }
});

/** PATCH /api/transport/drivers/:id — assign bus + morning/evening routes */
router.patch('/drivers/:id', requireTransportAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { busId, morningRouteId, eveningRouteId } = req.body || {};
    // Allow explicit unassign by sending null; but if one is set, both must be set.
    const busVal = busId != null ? String(busId) : null;
    const mVal = morningRouteId != null ? String(morningRouteId) : null;
    const eVal = eveningRouteId != null ? String(eveningRouteId) : null;
    if (!busVal) {
      return res.status(400).json({ error: 'busId is required' });
    }
    if ((mVal && !eVal) || (!mVal && eVal)) {
      return res.status(400).json({ error: 'Set both morningRouteId and eveningRouteId (or set both to null to unassign)' });
    }
    if (mVal && eVal && mVal === eVal) {
      return res.status(400).json({ error: 'Morning and evening route must be different' });
    }

    if (mVal && eVal) {
      const [conflicts] = await db.query(
        `SELECT id, email FROM transport_drivers
         WHERE id <> ? AND (morning_route_id IN (?, ?) OR evening_route_id IN (?, ?))
         LIMIT 1`,
        [String(id), mVal, eVal, mVal, eVal],
      );
      if (conflicts && conflicts.length) {
        return res.status(409).json({ error: 'Route is already assigned to another driver' });
      }
    }

    const [busConflicts] = await db.query(
      `SELECT id, email FROM transport_drivers WHERE id <> ? AND bus_id = ? LIMIT 1`,
      [String(id), busVal],
    );
    if (busConflicts && busConflicts.length) {
      return res.status(409).json({ error: 'Bus is already assigned to another driver' });
    }
    const [upd] = await db.query(
      `UPDATE transport_drivers SET bus_id = ?, morning_route_id = ?, evening_route_id = ? WHERE id = ? RETURNING id`,
      [busVal, mVal, eVal, String(id)],
    );
    if (!upd || !upd.length) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    res.json({ ok: true, message: 'Driver assignment updated' });
  } catch (err) {
    console.error('transport patch driver:', err);
    if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === '23503') {
      return res.status(400).json({ error: 'Invalid bus or route id' });
    }
    res.status(500).json({ error: 'Failed to update driver' });
  }
});

/**
 * Proxy Amazon Location map/tile requests with the server-side API key.
 */
router.get('/maps-proxy', async (req, res) => {
  const key = (process.env.AWS_LOCATION_API_KEY || '').trim();
  if (!key) {
    return res.status(503).json({ error: 'AWS_LOCATION_API_KEY is not set on the server' });
  }
  const raw = req.query.u;
  if (!raw || typeof raw !== 'string') {
    return res.status(400).json({ error: 'Missing query parameter u' });
  }
  let target;
  try {
    target = new URL(raw);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  if (!/^maps\.geo\.[a-z0-9-]+\.amazonaws\.com$/i.test(target.hostname)) {
    return res.status(400).json({ error: 'Host not allowed' });
  }
  target.searchParams.set('key', key);

  const refererHeader = req.get('referer') || req.get('Referer') || 'http://localhost:8081/';
  let originHeader = req.get('origin') || req.get('Origin');
  if (!originHeader) {
    try {
      originHeader = new URL(refererHeader).origin;
    } catch {
      originHeader = 'http://localhost:8081';
    }
  }

  try {
    const r = await fetch(target.toString(), {
      headers: {
        Referer: refererHeader,
        Origin: originHeader,
      },
    });
    const ct = r.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    const cc = r.headers.get('cache-control');
    if (cc) {
      res.setHeader('Cache-Control', cc);
    } else {
      res.setHeader('Cache-Control', 'public, max-age=300');
    }
    if (!r.ok) {
      console.error('transport maps-proxy upstream', r.status, target.origin + target.pathname);
    }
    const ab = await r.arrayBuffer();
    res.status(r.status).send(Buffer.from(ab));
  } catch (err) {
    console.error('transport maps-proxy:', err);
    res.status(502).json({ error: 'Upstream fetch failed' });
  }
});

/**
 * POST /api/transport/routes/calculate
 * Body: { stops: [{ lat, lng }, ...], travelMode?: "Car"|"Truck"|"Scooter"|"Pedestrian" }
 *
 * Returns: { lineString: [[lng,lat],...], distanceMeters, durationSeconds }
 *
 * Uses Amazon Location Routes V2: POST /routes?key=...
 */
router.post('/routes/calculate', requireTransportUser, async (req, res) => {
  try {
    const key = (process.env.AWS_LOCATION_API_KEY || '').trim();
    if (!key) {
      return res.status(503).json({ error: 'AWS_LOCATION_API_KEY is not set on the server' });
    }
    const region = (process.env.AWS_ROUTES_REGION || process.env.AWS_PLACES_REGION || process.env.AWS_REGION || 'ap-south-1').trim();
    const stops = Array.isArray(req.body?.stops) ? req.body.stops : [];
    const travelModeRaw = String(req.body?.travelMode || 'Car').trim();
    const travelMode = ['Car', 'Truck', 'Scooter', 'Pedestrian'].includes(travelModeRaw) ? travelModeRaw : 'Car';

    // Defensive: ignore invalid/null coordinates instead of failing with 400.
    // Frontend can temporarily hold null/string lat/lng (during editing) and older DB rows may have missing coords.
    const coords = (stops || [])
      .map((s) => ({ lat: Number(s?.lat), lng: Number(s?.lng) }))
      .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng));
    if (coords.length < 2) {
      return res.status(400).json({
        error: 'stops must have at least 2 valid points',
        details: 'At least 2 stops need numeric lat/lng (others were null/invalid).',
      });
    }

    const origin = [coords[0].lng, coords[0].lat];
    const destination = [coords[coords.length - 1].lng, coords[coords.length - 1].lat];
    const waypoints = coords.slice(1, -1).map((c) => ({ Position: [c.lng, c.lat] }));

    // Routes API endpoint: some AWS docs/examples use `/routes` while others show `/v2/routes`.
    // Use `/routes` first and fall back to `/v2/routes` if needed.
    const url = `https://routes.geo.${region}.amazonaws.com/routes?key=${encodeURIComponent(key)}`;
    const urlV2 = `https://routes.geo.${region}.amazonaws.com/v2/routes?key=${encodeURIComponent(key)}`;
    const body = {
      Origin: origin,
      Destination: destination,
      Waypoints: waypoints.length ? waypoints : undefined,
      TravelMode: travelMode,
    };

    const postJson = async (targetUrl) => {
      const r = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // API keys with referrer restrictions often require Origin/Referer; forward from client.
          ...placesForwardHeaders(req),
        },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      return { r, data };
    };

    let { r, data } = await postJson(url);
    if (!r.ok) {
      ({ r, data } = await postJson(urlV2));
    }
    if (!r.ok) {
      console.error('transport routes calculate', r.status, data);
      return res.status(r.status >= 400 ? r.status : 502).json({
        error: data.message || data.Message || data.error || 'Route calculation failed',
      });
    }

    const route = data && data.Routes && data.Routes[0] ? data.Routes[0] : null;
    if (!route || !Array.isArray(route.Legs) || route.Legs.length === 0) {
      return res.status(502).json({ error: 'No route legs returned' });
    }

    // Prefer LineString geometry returned by Routes v2.
    // Keep FlexiblePolyline decode as a fallback for backward compatibility.
    awsPolyline.setCompressionAlgorithm(awsPolyline.CompressionAlgorithm.FlexiblePolyline);
    const line = [];
    for (const leg of route.Legs) {
      const enc = leg && leg.Geometry ? leg.Geometry.Polyline : null;
      if (typeof enc === 'string' && enc.trim()) {
        try {
          const coords = awsPolyline.decodeToLngLatArray(enc);
          for (const p of coords) {
            if (!Array.isArray(p) || p.length < 2) continue;
            const lng = Number(p[0]);
            const lat = Number(p[1]);
            if (Number.isNaN(lng) || Number.isNaN(lat)) continue;
            const last = line.length ? line[line.length - 1] : null;
            if (last && last[0] === lng && last[1] === lat) continue;
            line.push([lng, lat]);
          }
          continue;
        } catch (e) {
          console.error('transport routes calculate polyline decode failed:', e);
          // fall through to LineString fallback
        }
      }

      const ls = leg && leg.Geometry && Array.isArray(leg.Geometry.LineString) ? leg.Geometry.LineString : null;
      if (!ls) continue;
      for (const p of ls) {
        if (!Array.isArray(p) || p.length < 2) continue;
        const lng = Number(p[0]);
        const lat = Number(p[1]);
        if (Number.isNaN(lng) || Number.isNaN(lat)) continue;
        const last = line.length ? line[line.length - 1] : null;
        if (last && last[0] === lng && last[1] === lat) continue;
        line.push([lng, lat]);
      }
    }

    const summary = route.Summary && route.Summary.Overview ? route.Summary.Overview : null;
    res.json({
      lineString: line,
      distanceMeters: summary && summary.Distance != null ? Number(summary.Distance) : null,
      durationSeconds: summary && summary.Duration != null ? Number(summary.Duration) : null,
    });
  } catch (err) {
    console.error('transport routes calculate:', err);
    res.status(500).json({ error: 'Route calculation failed' });
  }
});

/**
 * POST /api/transport/tracker/position
 * Body: { deviceId?: string, lat: number, lng: number, accuracyMeters?: number, sampleTime?: ISO string }
 *
 * Driver auth (Bearer transport_driver) OR transport admin secret/JWT.
 *
 * Notes:
 * - Tracker APIs require SigV4 (AWS credentials), not Amazon Location API keys.
 * - We default deviceId to the driver's busId if available; else driverId.
 */
router.post('/tracker/position', requireTransportUser, async (req, res) => {
  try {
    const trackerName = getTrackerName();
    if (!trackerName) {
      return res.status(503).json({ error: 'AWS_TRACKER_NAME is not set on the server' });
    }
    const region = getTrackerRegion();

    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng are required (numbers)' });
    }

    const accuracyMetersRaw = req.body?.accuracyMeters;
    const accuracyMeters = accuracyMetersRaw != null ? Number(accuracyMetersRaw) : null;
    const sampleTime = req.body?.sampleTime ? new Date(String(req.body.sampleTime)) : new Date();
    if (Number.isNaN(sampleTime.getTime())) {
      return res.status(400).json({ error: 'sampleTime must be a valid ISO timestamp' });
    }

    let deviceId = req.body?.deviceId != null ? String(req.body.deviceId).trim() : '';
    // If driver JWT exists, prefer binding to busId/driverId so the client can't spoof another bus.
    if (req.user && normalizeRole(req.user.role) === 'transportdriver') {
      const driverId = req.user.id != null ? String(req.user.id) : '';
      // Load busId for driver so deviceId can be stable per bus.
      const [rows] = await db.query(`SELECT bus_id FROM transport_drivers WHERE id = ? LIMIT 1`, [driverId]);
      const busId = rows && rows[0] && rows[0].bus_id != null ? String(rows[0].bus_id) : '';
      deviceId = busId || driverId;
      if (!deviceId) {
        return res.status(400).json({ error: 'Driver has no device identifier (bus_id missing)' });
      }
    } else if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required for admin updates' });
    }

    const client = getLocationClient(region);
    const cmd = new BatchUpdateDevicePositionCommand({
      TrackerName: trackerName,
      Updates: [
        {
          DeviceId: deviceId,
          SampleTime: sampleTime,
          Position: [lng, lat],
          Accuracy: accuracyMeters != null && !Number.isNaN(accuracyMeters) ? { Horizontal: accuracyMeters } : undefined,
        },
      ],
    });
    const out = await client.send(cmd);
    if (out && Array.isArray(out.Errors) && out.Errors.length) {
      return res.status(502).json({ error: 'Tracker update failed', details: out.Errors });
    }

    // Best-effort: geofence-style "bus reached pickup point" notifications via email (SES).
    // We keep this non-blocking and deduped via transport_geofence_events.
    let geofenceDebug = {
      activeTripType: null,
      routeId: null,
      nearestPickupPointId: null,
      nearestPickupPointName: null,
      nearestStopId: null,
      insertedEvent: false,
      matchedParents: 0,
      emailAttempted: 0,
      emailSent: 0,
      emailError: null,
      note: null,
    };
    try {
      const today = toUtcDateString(new Date(sampleTime));
      // Determine active trip type for this bus (deviceId == busId for driver updates).
      const [tripRows] = await db.query(
        `
        SELECT trip_type
        FROM transport_bus_trips
        WHERE bus_id = ? AND trip_date = ? AND status = 'active'
        ORDER BY started_at DESC
        LIMIT 2
        `,
        [deviceId, today],
      );
      const activeTripType =
        tripRows && tripRows.length === 1
          ? String(tripRows[0].trip_type || '').toLowerCase()
          : '';
      geofenceDebug.activeTripType = activeTripType || null;
      if (activeTripType === 'morning' || activeTripType === 'evening') {
        // Load route_id for this bus + tripType via assigned driver.
        const [drvRows] = await db.query(
          `SELECT morning_route_id, evening_route_id FROM transport_drivers WHERE bus_id = ? LIMIT 1`,
          [deviceId],
        );
        const routeId =
          drvRows && drvRows.length
            ? String(
                activeTripType === 'morning'
                  ? drvRows[0].morning_route_id || ''
                  : drvRows[0].evening_route_id || '',
              )
            : '';
        geofenceDebug.routeId = routeId || null;
        if (routeId) {
          const RADIUS_M = Number(process.env.TRANSPORT_GEOFENCE_RADIUS_M || 90);

          // Pickup/drop points assigned to this bus (the real geofence targets).
          // Morning uses pickup_point_id. Evening uses drop_point_id.
          const pointCol = activeTripType === 'evening' ? 'drop_point_id' : 'pickup_point_id';
          const [ppRows] = await db.query(
            `
            SELECT DISTINCT pp.id, pp.name, pp.lat, pp.lng, pp.route_stop_id
            FROM transport_student_assignments a
            JOIN transport_pickup_points pp ON pp.id = a.${pointCol}
            WHERE a.bus_id = ?
              AND pp.lat IS NOT NULL
              AND pp.lng IS NOT NULL
            `,
            [deviceId],
          );
          const pickupPoints = (ppRows || []).map((p) => ({
            id: String(p.id),
            name: p.name || 'Pickup point',
            lat: Number(p.lat),
            lng: Number(p.lng),
            routeStopId: p.route_stop_id != null ? String(p.route_stop_id) : null,
          }));

          // Route stops are used only to map legacy pickup points missing route_stop_id
          // and to determine "last stop" for reached-school logic.
          const [stopRows] = await db.query(
            `SELECT id, sequence_order, name, lat, lng
             FROM transport_route_stops
             WHERE route_id = ?
             ORDER BY sequence_order ASC`,
            [routeId],
          );
          const stops = (stopRows || []).map((s) => ({
            id: String(s.id),
            order: Number(s.sequence_order) || 0,
            name: s.name,
            lat: Number(s.lat),
            lng: Number(s.lng),
          }));

          let nearestPickup = null;
          let nearestPickupDist = Infinity;
          for (const p of pickupPoints) {
            if (Number.isNaN(p.lat) || Number.isNaN(p.lng)) continue;
            const d = haversineMeters({ lat, lng }, p);
            if (d < nearestPickupDist) {
              nearestPickupDist = d;
              nearestPickup = p;
            }
          }

          if (nearestPickup && nearestPickupDist <= RADIUS_M) {
            geofenceDebug.nearestPickupPointId = nearestPickup.id;
            geofenceDebug.nearestPickupPointName = nearestPickup.name;

            let reachedStopId = nearestPickup.routeStopId;
            if (!reachedStopId && stops.length) {
              let best = null;
              let bestD = Infinity;
              for (const s of stops) {
                const d = haversineMeters({ lat: nearestPickup.lat, lng: nearestPickup.lng }, s);
                if (d < bestD) {
                  bestD = d;
                  best = s;
                }
              }
              reachedStopId = best ? best.id : null;
            }
            geofenceDebug.nearestStopId = reachedStopId || null;

            if (!reachedStopId) {
              geofenceDebug.note = 'pickup point has no route_stop_id and could not map to a route stop';
            } else {
              const [rows] = await db.query(
                `
                SELECT c.parent_email, c.child_name, pp.name AS pickup_name
                FROM transport_student_assignments a
                JOIN transport_children c ON c.id = a.student_id
                JOIN transport_pickup_points pp ON pp.id = a.${pointCol}
                WHERE a.bus_id = ?
                  AND c.parent_email IS NOT NULL
                  AND a.${pointCol} = ?
                `,
                [deviceId, nearestPickup.id],
              );
              const emails = (rows || [])
                .map((r) => ({
                  to: r.parent_email ? String(r.parent_email).trim() : '',
                  childName: r.child_name || 'Your child',
                  pickupName: r.pickup_name || nearestPickup.name || 'your pickup point',
                }))
                .filter((x) => x.to);
              geofenceDebug.matchedParents = emails.length;

              const [ins] = await db.query(
                `
                INSERT INTO transport_geofence_events (bus_id, trip_date, trip_type, route_stop_id, event_type)
                VALUES (?, ?::date, ?, ?, 'reached_stop')
                ON CONFLICT (bus_id, trip_date, trip_type, route_stop_id, event_type) DO NOTHING
                RETURNING id
                `,
                [deviceId, today, activeTripType, reachedStopId],
              );
              const inserted = Boolean(ins && ins.length && ins[0].id);
              geofenceDebug.insertedEvent = inserted;

              const idxInStops = stops.findIndex((s) => String(s.id) === String(reachedStopId));
              const next = idxInStops >= 0 ? stops[idxInStops + 1] || null : null;

              if (inserted) {
                // Rule 3: bus reached your location (this stop)
                for (const e of emails) {
                  const subject = `Transport update: bus reached your location`;
                  const textBody =
                    `Bus has reached your ${activeTripType === 'evening' ? 'drop' : 'pickup'} point.\n\n` +
                    `${activeTripType === 'evening' ? 'Drop' : 'Pickup'}: ${e.pickupName}\n` +
                    `Child: ${e.childName}\n\n` +
                    `Time: ${new Date().toISOString()}`;
                  geofenceDebug.emailAttempted += 1;
                  try {
                    // eslint-disable-next-line no-await-in-loop
                    await sendTransportEmail(e.to, { subject, textBody });
                    geofenceDebug.emailSent += 1;
                  } catch (mailErr) {
                    if (!geofenceDebug.emailError) {
                      geofenceDebug.emailError = mailErr && mailErr.message ? String(mailErr.message) : String(mailErr);
                    }
                  }
                }

                // Rule 2: bus reached previous pickup point -> notify NEXT point parents (approaching).
                if (next && next.id) {
                  const nextStopId = String(next.id);
                  const [ins2] = await db.query(
                    `
                    INSERT INTO transport_geofence_events (bus_id, trip_date, trip_type, route_stop_id, event_type)
                    VALUES (?, ?::date, ?, ?, 'approaching_stop')
                    ON CONFLICT (bus_id, trip_date, trip_type, route_stop_id, event_type) DO NOTHING
                    RETURNING id
                    `,
                    [deviceId, today, activeTripType, nextStopId],
                  );
                  const insertedApproach = Boolean(ins2 && ins2.length && ins2[0].id);
                  if (insertedApproach) {
                    const [rowsN] = await db.query(
                      `
                      SELECT c.parent_email, c.child_name, pp.name AS pickup_name
                      FROM transport_student_assignments a
                      JOIN transport_children c ON c.id = a.student_id
                      JOIN transport_pickup_points pp ON pp.id = a.${pointCol}
                      WHERE a.bus_id = ?
                        AND c.parent_email IS NOT NULL
                        AND pp.route_stop_id = ?::uuid
                      `,
                      [deviceId, nextStopId],
                    );
                    const emailsN = (rowsN || [])
                      .map((r) => ({
                        to: r.parent_email ? String(r.parent_email).trim() : '',
                        childName: r.child_name || 'Your child',
                        pickupName: r.pickup_name || next.name || 'your pickup point',
                      }))
                      .filter((x) => x.to);
                    for (const e of emailsN) {
                      const subject = `Transport update: bus reached previous pickup point`;
                      const textBody =
                        `Bus has reached the previous stop and is heading to your ${activeTripType === 'evening' ? 'drop' : 'pickup'} point.\n\n` +
                        `Next stop: ${e.pickupName}\n` +
                        `Child: ${e.childName}\n\n` +
                        `Time: ${new Date().toISOString()}`;
                      geofenceDebug.emailAttempted += 1;
                      try {
                        // eslint-disable-next-line no-await-in-loop
                        await sendTransportEmail(e.to, { subject, textBody });
                        geofenceDebug.emailSent += 1;
                      } catch (mailErr) {
                        if (!geofenceDebug.emailError) {
                          geofenceDebug.emailError =
                            mailErr && mailErr.message ? String(mailErr.message) : String(mailErr);
                        }
                      }
                    }
                  }
                }

                if (!next && activeTripType === 'morning') {
                  const [rows3] = await db.query(
                    `
                    SELECT DISTINCT c.parent_email
                    FROM transport_student_assignments a
                    JOIN transport_children c ON c.id = a.student_id
                    WHERE a.bus_id = ?
                      AND c.parent_email IS NOT NULL
                    `,
                    [deviceId],
                  );
                  const tos = (rows3 || [])
                    .map((r) => (r.parent_email ? String(r.parent_email).trim() : ''))
                    .filter(Boolean);
                  for (const to of tos) {
                    const subject = `Transport update: bus reached school`;
                    const textBody =
                      `Bus has reached the destination (school).\n\n` +
                      `Trip: ${activeTripType}\n` +
                      `Time: ${new Date().toISOString()}`;
                    // eslint-disable-next-line no-await-in-loop
                    await sendTransportEmail(to, { subject, textBody });
                  }
                }
              }

              if (!inserted) {
                geofenceDebug.note = 'deduped: stop already reached today';
              }
            }
          } else {
            geofenceDebug.note = pickupPoints.length ? 'not within radius of any assigned pickup point' : 'no pickup points assigned to this bus';
          }
        }
      }
    } catch (notifyErr) {
      geofenceDebug.emailError =
        geofenceDebug.emailError || (notifyErr && notifyErr.message ? String(notifyErr.message) : String(notifyErr));
      console.error('transport tracker geofence notify failed:', notifyErr && notifyErr.message ? notifyErr.message : notifyErr);
    }

    res.json({
      ok: true,
      trackerName,
      deviceId,
      sampleTime: sampleTime.toISOString(),
      geofence: geofenceDebug,
    });
  } catch (err) {
    // Surface AWS error details to speed up setup (permissions/region/tracker name issues).
    const name = err && err.name ? String(err.name) : 'Error';
    const message = err && err.message ? String(err.message) : 'Failed to update device position';
    const httpStatus = err && err.$metadata && err.$metadata.httpStatusCode ? Number(err.$metadata.httpStatusCode) : null;
    console.error('transport tracker update position:', name, message);
    res.status(502).json({
      error: 'Failed to update device position',
      awsError: { name, message, httpStatus },
      hint:
        'Tracker APIs require AWS IAM permissions (geo:BatchUpdateDevicePosition) on the tracker ARN and correct AWS_TRACKER_REGION/AWS_TRACKER_NAME.',
    });
  }
});

/**
 * GET /api/transport/tracker/position/me
 * Driver-only (Bearer transport_driver). Returns last known position for the driver's assigned bus.
 *
 * IMPORTANT: define this BEFORE /tracker/position/:deviceId (otherwise "me" matches :deviceId).
 */
router.get('/tracker/position/me', authenticateToken, async (req, res) => {
  try {
    const r = normalizeRole(req.user?.role);
    if (r !== 'transportdriver') {
      return res.status(403).json({ error: 'Driver session required' });
    }
    const trackerName = getTrackerName();
    if (!trackerName) {
      return res.status(503).json({ error: 'AWS_TRACKER_NAME is not set on the server' });
    }
    const region = getTrackerRegion();

    const driverId = String(req.user.id || '');
    const [rows] = await db.query(`SELECT bus_id FROM transport_drivers WHERE id = ? LIMIT 1`, [driverId]);
    const busId = rows && rows[0] && rows[0].bus_id != null ? String(rows[0].bus_id) : '';
    if (!busId) {
      return res.status(400).json({ error: 'Driver has no bus assigned' });
    }

    const client = getLocationClient(region);
    const cmd = new GetDevicePositionCommand({
      TrackerName: trackerName,
      DeviceId: busId,
    });
    const out = await client.send(cmd);
    const pos = out && Array.isArray(out.Position) ? out.Position : null;
    if (!pos || pos.length < 2) {
      return res.status(404).json({ error: 'No position found' });
    }
    res.json({
      trackerName,
      deviceId: busId,
      lng: Number(pos[0]),
      lat: Number(pos[1]),
      sampleTime: out.SampleTime ? new Date(out.SampleTime).toISOString() : null,
      receivedTime: out.ReceivedTime ? new Date(out.ReceivedTime).toISOString() : null,
    });
  } catch (err) {
    const name = err && err.name ? String(err.name) : '';
    const message = err && err.message ? String(err.message) : 'Failed to load device position';
    const httpStatus = err && err.$metadata && err.$metadata.httpStatusCode ? Number(err.$metadata.httpStatusCode) : null;
    console.error('transport tracker get my position:', name, message);
    if (name === 'ResourceNotFoundException') {
      return res.status(404).json({ error: 'Tracker/device not found' });
    }
    res.status(502).json({
      error: 'Failed to load device position',
      awsError: { name, message, httpStatus },
    });
  }
});

/**
 * GET /api/transport/geofence-events?busId=...&tripType=morning&date=YYYY-MM-DD
 * Admin-only. Returns reached_stop events (deduped) for UI timelines.
 */
router.get('/geofence-events', requireTransportUser, async (req, res) => {
  try {
    const busId = req.query.busId != null ? String(req.query.busId).trim() : '';
    const tripType = req.query.tripType != null ? String(req.query.tripType).trim().toLowerCase() : '';
    const date = req.query.date != null ? String(req.query.date).trim() : '';
    if (!busId) return res.status(400).json({ error: 'busId is required' });
    if (tripType !== 'morning' && tripType !== 'evening') return res.status(400).json({ error: 'tripType must be morning|evening' });
    if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });

    const [rows] = await db.query(
      `
      SELECT route_stop_id, event_type, created_at
      FROM transport_geofence_events
      WHERE bus_id = ? AND trip_date = ?::date AND trip_type = ?
      ORDER BY created_at ASC
      `,
      [busId, date, tripType],
    );
    res.json({
      busId,
      tripType,
      date,
      events: (rows || []).map((r) => ({
        routeStopId: r.route_stop_id != null ? String(r.route_stop_id) : null,
        eventType: r.event_type,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error('transport geofence events:', err);
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === '42P01') {
      return res.status(503).json({ error: 'Database not ready', details: 'Run backend/sql/2026-04-10-transport_geofence_events.sql' });
    }
    res.status(500).json({ error: 'Failed to load geofence events' });
  }
});

/**
 * GET /api/transport/tracker/position/:deviceId
 * Admin-only (secret/JWT). Returns last known position for a device.
 */
router.get('/tracker/position/:deviceId', requireTransportAdmin, async (req, res) => {
  try {
    const trackerName = getTrackerName();
    if (!trackerName) {
      return res.status(503).json({ error: 'AWS_TRACKER_NAME is not set on the server' });
    }
    const region = getTrackerRegion();
    const deviceId = String(req.params.deviceId || '').trim();
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const client = getLocationClient(region);
    const cmd = new GetDevicePositionCommand({
      TrackerName: trackerName,
      DeviceId: deviceId,
    });
    const out = await client.send(cmd);
    const pos = out && Array.isArray(out.Position) ? out.Position : null;
    if (!pos || pos.length < 2) {
      return res.status(404).json({ error: 'No position found' });
    }
    res.json({
      trackerName,
      deviceId,
      lng: Number(pos[0]),
      lat: Number(pos[1]),
      sampleTime: out.SampleTime ? new Date(out.SampleTime).toISOString() : null,
      receivedTime: out.ReceivedTime ? new Date(out.ReceivedTime).toISOString() : null,
    });
  } catch (err) {
    // AWS SDK throws ResourceNotFoundException, ValidationException, etc.
    const name = err && err.name ? String(err.name) : '';
    const message = err && err.message ? String(err.message) : 'Failed to load device position';
    const httpStatus = err && err.$metadata && err.$metadata.httpStatusCode ? Number(err.$metadata.httpStatusCode) : null;
    console.error('transport tracker get position:', name, message);
    if (name === 'ResourceNotFoundException') {
      return res.status(404).json({ error: 'Tracker/device not found' });
    }
    res.status(502).json({
      error: 'Failed to load device position',
      awsError: { name, message, httpStatus },
    });
  }
});

/**
 * POST /api/transport/driver/trip/start
 * Body: { tripType: "morning"|"evening" }
 * Driver-only. Records "active" status for today in DB.
 */
router.post('/driver/trip/start', authenticateToken, async (req, res) => {
  try {
    const r = normalizeRole(req.user?.role);
    if (r !== 'transportdriver') {
      return res.status(403).json({ error: 'Driver session required' });
    }
    const driverId = String(req.user.id || '');
    const tripType = String(req.body?.tripType || '').trim().toLowerCase();
    if (tripType !== 'morning' && tripType !== 'evening') {
      return res.status(400).json({ error: 'tripType must be morning or evening' });
    }

    const [rows] = await db.query(`SELECT bus_id FROM transport_drivers WHERE id = ? LIMIT 1`, [driverId]);
    const busId = rows && rows[0] && rows[0].bus_id != null ? String(rows[0].bus_id) : '';
    if (!busId) {
      return res.status(400).json({ error: 'Driver has no bus assigned' });
    }

    const today = toUtcDateString();
    // Upsert: create or update today's row.
    await db.query(
      `
      INSERT INTO transport_bus_trips (bus_id, driver_id, trip_date, trip_type, status, started_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', NOW(), NOW())
      ON CONFLICT (bus_id, trip_date, trip_type)
      DO UPDATE SET
        driver_id = EXCLUDED.driver_id,
        status = 'active',
        started_at = COALESCE(transport_bus_trips.started_at, NOW()),
        ended_at = NULL,
        updated_at = NOW()
      `,
      [busId, driverId, today, tripType],
    );

    // Best-effort: notify parents on this bus that trip started (email for now).
    try {
      const [rows2] = await db.query(
        `
        SELECT c.parent_email, c.child_name
        FROM transport_student_assignments a
        JOIN transport_children c ON c.id = a.student_id
        WHERE a.bus_id = ? AND c.parent_email IS NOT NULL
        `,
        [busId],
      );
      // Dedupe: one email per parent (a parent may have multiple children assigned to same bus).
      const byParent = new Map();
      for (const r of rows2 || []) {
        const to = r.parent_email ? String(r.parent_email).trim() : '';
        if (!to) continue;
        const childName = r.child_name || 'Your child';
        if (!byParent.has(to)) byParent.set(to, []);
        byParent.get(to).push(childName);
      }
      for (const [to, children] of byParent.entries()) {
        const subject = `Transport update: ${tripType} trip started`;
        const kids = Array.from(new Set(children)).filter(Boolean);
        const textBody =
          `The ${tripType} trip has started.\n\n` +
          (kids.length ? `Children: ${kids.join(', ')}\n\n` : '') +
          `You will receive pickup point updates.`;
        // eslint-disable-next-line no-await-in-loop
        await sendTransportEmail(to, { subject, textBody });
      }
    } catch (e) {
      console.error('transport trip start parent email failed:', e && e.message ? e.message : e);
    }

    res.json({ ok: true, busId, tripType, status: 'active', tripDate: today });
  } catch (err) {
    console.error('transport trip start:', err);
    res.status(500).json({ error: 'Failed to start trip' });
  }
});

/**
 * POST /api/transport/driver/trip/end
 * Body: { tripType: "morning"|"evening" }
 * Driver-only. Records "ended" status for today in DB.
 */
router.post('/driver/trip/end', authenticateToken, async (req, res) => {
  try {
    const r = normalizeRole(req.user?.role);
    if (r !== 'transportdriver') {
      return res.status(403).json({ error: 'Driver session required' });
    }
    const driverId = String(req.user.id || '');
    const tripType = String(req.body?.tripType || '').trim().toLowerCase();
    if (tripType !== 'morning' && tripType !== 'evening') {
      return res.status(400).json({ error: 'tripType must be morning or evening' });
    }

    const [rows] = await db.query(`SELECT bus_id FROM transport_drivers WHERE id = ? LIMIT 1`, [driverId]);
    const busId = rows && rows[0] && rows[0].bus_id != null ? String(rows[0].bus_id) : '';
    if (!busId) {
      return res.status(400).json({ error: 'Driver has no bus assigned' });
    }

    const today = toUtcDateString();
    await db.query(
      `
      INSERT INTO transport_bus_trips (bus_id, driver_id, trip_date, trip_type, status, started_at, ended_at, updated_at)
      VALUES (?, ?, ?, ?, 'ended', NOW(), NOW(), NOW())
      ON CONFLICT (bus_id, trip_date, trip_type)
      DO UPDATE SET
        driver_id = EXCLUDED.driver_id,
        status = 'ended',
        started_at = COALESCE(transport_bus_trips.started_at, NOW()),
        ended_at = NOW(),
        updated_at = NOW()
      `,
      [busId, driverId, today, tripType],
    );

    res.json({ ok: true, busId, tripType, status: 'ended', tripDate: today });
  } catch (err) {
    console.error('transport trip end:', err);
    res.status(500).json({ error: 'Failed to end trip' });
  }
});

/**
 * GET /api/transport/driver/trips/today
 * Driver-only. Returns today's trip status for the driver's assigned bus (morning + evening).
 */
router.get('/driver/trips/today', authenticateToken, async (req, res) => {
  try {
    const r = normalizeRole(req.user?.role);
    if (r !== 'transportdriver') {
      return res.status(403).json({ error: 'Driver session required' });
    }
    const driverId = String(req.user.id || '');
    const [rows] = await db.query(`SELECT bus_id FROM transport_drivers WHERE id = ? LIMIT 1`, [driverId]);
    const busId = rows && rows[0] && rows[0].bus_id != null ? String(rows[0].bus_id) : '';
    if (!busId) {
      return res.status(400).json({ error: 'Driver has no bus assigned' });
    }

    const today = toUtcDateString();
    const [tripRows] = await db.query(
      `
      SELECT trip_type, status, started_at, ended_at, updated_at
      FROM transport_bus_trips
      WHERE bus_id = ? AND trip_date = ?
      `,
      [busId, today],
    );

    const byType = { morning: null, evening: null };
    for (const tr of tripRows || []) {
      const t = String(tr.trip_type || '').toLowerCase();
      if (t !== 'morning' && t !== 'evening') continue;
      byType[t] = {
        tripType: t,
        status: tr.status || 'idle',
        startedAt: tr.started_at ? new Date(tr.started_at).toISOString() : null,
        endedAt: tr.ended_at ? new Date(tr.ended_at).toISOString() : null,
        updatedAt: tr.updated_at ? new Date(tr.updated_at).toISOString() : null,
      };
    }

    res.json({
      tripDate: today,
      busId,
      trips: [
        byType.morning || { tripType: 'morning', status: 'idle', startedAt: null, endedAt: null, updatedAt: null },
        byType.evening || { tripType: 'evening', status: 'idle', startedAt: null, endedAt: null, updatedAt: null },
      ],
    });
  } catch (err) {
    console.error('transport driver trips today:', err);
    res.status(500).json({ error: 'Failed to load trips' });
  }
});

/**
 * GET /api/transport/driver/assigned-children?tripType=morning
 * Driver-only. Returns children assigned to this driver's bus and whether each is onboarded for today.
 */
router.get('/driver/assigned-children', authenticateToken, async (req, res) => {
  try {
    const r = normalizeRole(req.user?.role);
    if (r !== 'transportdriver') {
      return res.status(403).json({ error: 'Driver session required' });
    }
    const tripType = req.query.tripType != null ? String(req.query.tripType).trim().toLowerCase() : 'morning';
    if (tripType !== 'morning' && tripType !== 'evening') {
      return res.status(400).json({ error: 'tripType must be morning|evening' });
    }

    const driverId = String(req.user.id || '');
    const [rows] = await db.query(`SELECT bus_id FROM transport_drivers WHERE id = ? LIMIT 1`, [driverId]);
    const busId = rows && rows[0] && rows[0].bus_id != null ? String(rows[0].bus_id) : '';
    if (!busId) {
      return res.status(400).json({ error: 'Driver has no bus assigned' });
    }

    const today = toUtcDateString();
    const [children] = await db.query(
      `
      SELECT
        c.id,
        c.child_name,
        c.parent_email,
        c.gender,
        c.address,
        COALESCE(bb.status, NULL) AS boarding_status,
        bb.last_scanned_at
      FROM transport_student_assignments a
      JOIN transport_children c ON c.id = a.student_id
      LEFT JOIN transport_bus_boarding bb
        ON bb.bus_id = a.bus_id
       AND bb.trip_type = ?
       AND bb.student_id = a.student_id
       AND bb.trip_date = ?
      WHERE a.bus_id = ?
      ORDER BY c.child_name ASC
      `,
      [tripType, today, busId],
    );

    res.json({
      busId,
      tripType,
      tripDate: today,
      children: (children || []).map((c) => ({
        id: String(c.id),
        childName: c.child_name,
        parentEmail: c.parent_email,
        gender: c.gender || null,
        address: c.address || null,
        onboarded: String(c.boarding_status || '').toLowerCase() === 'on',
        lastScannedAt: c.last_scanned_at || null,
      })),
    });
  } catch (err) {
    console.error('transport driver assigned children:', err);
    res.status(500).json({ error: 'Failed to load assigned children' });
  }
});

/**
 * GET /api/transport/driver/stop-children?tripType=morning&date=YYYY-MM-DD
 * Driver-only. Returns route stops + children assigned to each pickup point on this driver's bus,
 * with onboard/verified status from transport_bus_boarding for the given date.
 */
router.get('/driver/stop-children', authenticateToken, async (req, res) => {
  try {
    const r = normalizeRole(req.user?.role);
    if (r !== 'transportdriver') {
      return res.status(403).json({ error: 'Driver session required' });
    }
    const tripType = req.query.tripType != null ? String(req.query.tripType).trim().toLowerCase() : 'morning';
    if (tripType !== 'morning' && tripType !== 'evening') {
      return res.status(400).json({ error: 'tripType must be morning|evening' });
    }
    const pointCol = tripType === 'evening' ? 'drop_point_id' : 'pickup_point_id';
    const date = req.query.date != null ? String(req.query.date).trim() : '';
    const tripDate = date || toUtcDateString();

    const driverId = String(req.user.id || '');
    const [drv] = await db.query(`SELECT bus_id, morning_route_id, evening_route_id FROM transport_drivers WHERE id = ? LIMIT 1`, [
      driverId,
    ]);
    const busId = drv && drv[0] && drv[0].bus_id != null ? String(drv[0].bus_id) : '';
    if (!busId) {
      return res.status(400).json({ error: 'Driver has no bus assigned' });
    }
    const routeId =
      drv && drv[0]
        ? String(tripType === 'morning' ? drv[0].morning_route_id || '' : drv[0].evening_route_id || '')
        : '';
    if (!routeId) {
      return res.status(400).json({ error: 'No route assigned for this trip type' });
    }

    const [stopRows] = await db.query(
      `SELECT id, name, sequence_order, lat, lng
       FROM transport_route_stops
       WHERE route_id = ?
       ORDER BY sequence_order ASC`,
      [routeId],
    );
    const stops = (stopRows || []).map(mapStopRow);

    const [rows] = await db.query(
      `
      SELECT
        rs.id AS route_stop_id,
        c.id AS student_id,
        c.child_name,
        rt.tag_uid AS rfid_tag_uid,
        bb.status AS boarding_status,
        bb.last_scanned_at
      FROM transport_route_stops rs
      LEFT JOIN transport_pickup_points pp
        ON pp.route_stop_id = rs.id
      LEFT JOIN transport_student_assignments a
        ON a.${pointCol} = pp.id
       AND a.bus_id = ?
      LEFT JOIN transport_children c
        ON c.id = a.student_id
      LEFT JOIN transport_rfid_tags rt
        ON rt.assigned_student_id = c.id
      LEFT JOIN transport_bus_boarding bb
        ON bb.bus_id = a.bus_id
       AND bb.trip_type = ?
       AND bb.trip_date = ?::date
       AND bb.student_id = c.id
      WHERE rs.route_id = ?
      ORDER BY rs.sequence_order ASC, c.child_name ASC
      `,
      [busId, tripType, tripDate, routeId],
    );

    const byStopId = new Map();
    for (const r2 of rows || []) {
      const stopId = r2.route_stop_id != null ? String(r2.route_stop_id) : null;
      if (!stopId) continue;
      if (!r2.student_id) continue;
      const list = byStopId.get(stopId) || [];
      list.push({
        id: String(r2.student_id),
        childName: r2.child_name,
        rfidTagUid: r2.rfid_tag_uid || null,
        onboarded: String(r2.boarding_status || '').toLowerCase() === 'on',
        lastScannedAt: r2.last_scanned_at || null,
      });
      byStopId.set(stopId, list);
    }

    res.json({
      ok: true,
      busId,
      tripType,
      date: tripDate,
      stops: stops.map((s) => ({
        ...s,
        children: byStopId.get(String(s.id)) || [],
      })),
    });
  } catch (err) {
    console.error('transport driver stop children:', err);
    res.status(500).json({ error: 'Failed to load stop children' });
  }
});

/**
 * GET /api/transport/trips/today
 * Admin-only. Returns per-bus trip status for today (morning/evening).
 */
router.get('/trips/today', requireTransportAdmin, async (req, res) => {
  try {
    const today = toUtcDateString();
    const [rows] = await db.query(
      `
      SELECT bus_id, trip_type, status, started_at, ended_at, updated_at
      FROM transport_bus_trips
      WHERE trip_date = ?
      `,
      [today],
    );
    const trips = (rows || []).map((r) => ({
      busId: String(r.bus_id),
      tripType: r.trip_type,
      status: r.status,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      updatedAt: r.updated_at,
    }));
    res.json({ tripDate: today, trips });
  } catch (err) {
    console.error('transport trips today:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({
        error: 'Database not ready',
        details: 'Run backend/sql/2026-04-07-transport_trips.sql',
      });
    }
    res.status(500).json({ error: 'Failed to load trips' });
  }
});

/**
 * PATCH /api/transport/trips/:busId/:tripType
 * Admin-only. Allows transport admin to restart/undo end and edit started/ended timestamps for TODAY.
 *
 * Body: { status?: "idle"|"active"|"ended", startedAt?: ISO|null, endedAt?: ISO|null }
 */
router.patch('/trips/:busId/:tripType', requireTransportAdmin, async (req, res) => {
  try {
    const busId = String(req.params.busId || '').trim();
    const tripType = String(req.params.tripType || '').trim().toLowerCase();
    if (!busId) return res.status(400).json({ error: 'busId is required' });
    if (tripType !== 'morning' && tripType !== 'evening') {
      return res.status(400).json({ error: 'tripType must be morning|evening' });
    }

    const statusRaw = req.body?.status != null ? String(req.body.status).trim().toLowerCase() : null;
    const status = statusRaw && ['idle', 'active', 'ended'].includes(statusRaw) ? statusRaw : null;

    const parseIsoOrNull = (v) => {
      if (v === null) return null;
      if (v == null) return undefined;
      const d = new Date(String(v));
      if (Number.isNaN(d.getTime())) return undefined;
      return d.toISOString();
    };

    const startedAtIso = parseIsoOrNull(req.body?.startedAt);
    const endedAtIso = parseIsoOrNull(req.body?.endedAt);
    if (req.body?.startedAt != null && startedAtIso === undefined) {
      return res.status(400).json({ error: 'startedAt must be ISO datetime or null' });
    }
    if (req.body?.endedAt != null && endedAtIso === undefined) {
      return res.status(400).json({ error: 'endedAt must be ISO datetime or null' });
    }

    const today = toUtcDateString();

    // Ensure a row exists, then apply updates (keep driver_id if any).
    await db.query(
      `
      INSERT INTO transport_bus_trips (bus_id, trip_date, trip_type, status, started_at, ended_at, updated_at)
      VALUES (?, ?, ?, COALESCE(?, 'idle'), ?::timestamptz, ?::timestamptz, NOW())
      ON CONFLICT (bus_id, trip_date, trip_type)
      DO UPDATE SET
        status = COALESCE(EXCLUDED.status, transport_bus_trips.status),
        started_at = COALESCE(EXCLUDED.started_at, transport_bus_trips.started_at),
        ended_at = EXCLUDED.ended_at,
        updated_at = NOW()
      `,
      [
        busId,
        today,
        tripType,
        status,
        startedAtIso === undefined ? null : startedAtIso,
        endedAtIso === undefined ? null : endedAtIso,
      ],
    );

    // If explicitly setting active, ensure ended_at is NULL (restart/undo end).
    if (status === 'active') {
      await db.query(
        `UPDATE transport_bus_trips SET status = 'active', ended_at = NULL, updated_at = NOW()
         WHERE bus_id = ? AND trip_date = ? AND trip_type = ?`,
        [busId, today, tripType],
      );
    }

    const [rows] = await db.query(
      `SELECT bus_id, trip_type, status, started_at, ended_at, updated_at
       FROM transport_bus_trips
       WHERE bus_id = ? AND trip_date = ? AND trip_type = ?
       LIMIT 1`,
      [busId, today, tripType],
    );
    const r = rows && rows.length ? rows[0] : null;
    return res.json({
      ok: true,
      tripDate: today,
      trip: r
        ? {
            busId: String(r.bus_id),
            tripType: String(r.trip_type),
            status: String(r.status),
            startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
            endedAt: r.ended_at ? new Date(r.ended_at).toISOString() : null,
            updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
          }
        : null,
    });
  } catch (err) {
    console.error('transport patch trip:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ error: 'Database not ready', details: 'Run backend/sql/2026-04-07-transport_trips.sql' });
    }
    return res.status(500).json({ error: 'Failed to update trip' });
  }
});

// --- Attendance (RFID scans) ---

/** POST /api/transport/attendance/scan
 * body: { tagUid, busId, tripType, direction?: 'on'|'off', scannedAt?: ISO string }
 * auth: X-Transport-Scanner-Secret (recommended) OR transport admin secret/admin JWT for testing.
 */
router.post('/attendance/scan', requireTransportScanner, async (req, res) => {
  try {
    const tagUidRaw = req.body?.tagUid ?? req.body?.rfid ?? req.body?.uid;
    const tagUid = tagUidRaw != null ? String(tagUidRaw).trim() : '';
    let busId = req.body?.busId != null ? String(req.body.busId).trim() : '';
    let tripType = req.body?.tripType != null ? String(req.body.tripType).trim().toLowerCase() : '';
    const direction = req.body?.direction != null ? String(req.body.direction).trim().toLowerCase() : 'on';
    const scannedAt = req.body?.scannedAt ? new Date(String(req.body.scannedAt)) : new Date();

    if (!tagUid) return res.status(400).json({ error: 'tagUid is required' });

    // Resolve RFID first so unknown/unassigned tags get clear errors before trip inference
    // (avoids "Multiple active trips" when the real problem is an unregistered card).
    let studentId;
    try {
      const [tagRows] = await db.query(
        `SELECT assigned_student_id FROM transport_rfid_tags WHERE LOWER(tag_uid) = LOWER(?) LIMIT 2`,
        [tagUid],
      );
      if (!tagRows || tagRows.length === 0) {
        return res.status(404).json({ error: 'Unknown RFID', details: 'Tag not found in transport_rfid_tags' });
      }
      if (tagRows.length > 1) {
        return res.status(409).json({
          error: 'Ambiguous RFID',
          details: 'Multiple tags matched; ensure tag_uid is unique',
        });
      }
      studentId =
        tagRows[0].assigned_student_id != null ? String(tagRows[0].assigned_student_id) : null;
      if (!studentId) {
        return res.status(409).json({
          error: 'RFID not assigned',
          details: 'This tag has no assigned_student_id',
        });
      }
    } catch (e) {
      if (e && e.code === '42P01') {
        return res.status(503).json({
          error: 'Database not ready',
          details: 'Run backend/sql/2026-04-07-transport_rfid_pickup_points.sql',
        });
      }
      console.error('transport attendance scan tag lookup failed:', e);
      return res.status(500).json({ error: 'Failed to validate RFID tag' });
    }

    // If busId/tripType are not provided by the scanner, infer them from today's active trip(s).
    // This avoids hardcoding BUS_ID/TRIP_TYPE into ESP32 code.
    if (!busId || !tripType) {
      try {
        const today = toUtcDateString(new Date());
        const [activeTrips] = await db.query(
          `
          SELECT bus_id, trip_type
          FROM transport_bus_trips
          WHERE trip_date = ? AND status = 'active'
          ORDER BY started_at DESC
          `,
          [today],
        );
        if (!activeTrips || activeTrips.length === 0) {
          return res.status(409).json({
            error: 'No active trip',
            details: 'Driver must start a trip before RFID scanning is accepted',
          });
        }
        if (activeTrips.length > 1) {
          // Prefer the bus this child is assigned to (fleet: multiple buses may be "active").
          let chosen = null;
          try {
            const [assignRows] = await db.query(
              `SELECT bus_id FROM transport_student_assignments WHERE student_id = ? LIMIT 1`,
              [studentId],
            );
            const assignedBus =
              assignRows && assignRows.length && assignRows[0].bus_id != null
                ? String(assignRows[0].bus_id)
                : '';
            if (assignedBus) {
              const matches = activeTrips.filter((t) => String(t.bus_id) === assignedBus);
              if (matches.length === 1) {
                chosen = matches[0];
              }
            }
          } catch (assignErr) {
            console.error('transport attendance scan assignment lookup failed:', assignErr);
          }
          if (!chosen) {
            return res.status(409).json({
              error: 'Multiple active trips',
              details: 'Provide busId and tripType to disambiguate',
              trips: activeTrips.map((t) => ({
                busId: String(t.bus_id),
                tripType: String(t.trip_type),
              })),
            });
          }
          busId = String(chosen.bus_id);
          tripType = String(chosen.trip_type).toLowerCase();
        } else {
          busId = String(activeTrips[0].bus_id);
          tripType = String(activeTrips[0].trip_type).toLowerCase();
        }
      } catch (e) {
        if (e && e.code === '42P01') {
          return res.status(503).json({
            error: 'Database not ready',
            details: 'Run backend/sql/2026-04-07-transport_trips.sql',
          });
        }
        console.error('transport attendance scan infer active trip failed:', e);
        return res.status(503).json({ error: 'Trip status unavailable' });
      }
    }

    if (!busId) return res.status(400).json({ error: 'busId is required' });
    if (tripType !== 'morning' && tripType !== 'evening') return res.status(400).json({ error: 'tripType must be morning|evening' });
    if (direction !== 'on' && direction !== 'off') return res.status(400).json({ error: "direction must be 'on'|'off'" });

    // Gate scanning by trip status:
    // Only accept scans when the driver has started today's trip for this bus + tripType.
    // When driver ends the trip, scans should stop until the next start (e.g. evening).
    try {
      const today = toUtcDateString(new Date());
      const [tripRows] = await db.query(
        `
        SELECT status
        FROM transport_bus_trips
        WHERE bus_id = ? AND trip_date = ? AND trip_type = ?
        LIMIT 1
        `,
        [busId, today, tripType],
      );
      const status = tripRows && tripRows.length ? String(tripRows[0].status || '').toLowerCase() : '';
      if (status !== 'active') {
        return res.status(409).json({
          error: 'Trip not active',
          details: 'Driver must start the trip before RFID scanning is accepted',
          busId,
          tripType,
          tripDate: today,
          status: status || null,
        });
      }
    } catch (e) {
      // If trips table isn't migrated, guide user.
      if (e && e.code === '42P01') {
        return res.status(503).json({
          error: 'Database not ready',
          details: 'Run backend/sql/2026-04-07-transport_trips.sql',
        });
      }
      // If trip gating query fails for any other reason, be safe and block scans.
      console.error('transport attendance scan trip gate failed:', e);
      return res.status(503).json({
        error: 'Trip status unavailable',
        details: 'Unable to verify trip status; please try again',
      });
    }

    // Load previous boarding state to avoid duplicate emails on repeated scans.
    let prevStatus = null;
    try {
      const [prev] = await db.query(
        `
        SELECT status
        FROM transport_bus_boarding
        WHERE bus_id = ? AND trip_type = ? AND student_id = ? AND trip_date = (NOW() AT TIME ZONE 'UTC')::date
        LIMIT 1
        `,
        [busId, tripType, studentId],
      );
      if (prev && prev.length) prevStatus = prev[0].status || null;
    } catch (_) {
      // ignore
    }

    // Record scan event (append-only)
    await db.query(
      `INSERT INTO transport_attendance_scans (bus_id, trip_type, direction, tag_uid, student_id, scanned_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [busId, tripType, direction, tagUid, studentId, scannedAt],
    );

    // Upsert latest boarding state (green=on)
    await db.query(
      `
      INSERT INTO transport_bus_boarding (bus_id, trip_type, student_id, tag_uid, status, last_scanned_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON CONFLICT (bus_id, trip_date, trip_type, student_id)
      DO UPDATE SET
        tag_uid = EXCLUDED.tag_uid,
        status = EXCLUDED.status,
        last_scanned_at = EXCLUDED.last_scanned_at,
        updated_at = NOW()
      `,
      [busId, tripType, studentId, tagUid, direction, scannedAt],
    );

    // Resolve child details (Transport module) for email notifications.
    let childName = null;
    let parentEmail = null;
    let gender = null;
    try {
      const [rows] = await db.query(
        `SELECT child_name, parent_email, gender FROM transport_children WHERE id = ? LIMIT 1`,
        [studentId],
      );
      if (rows && rows.length) {
        childName = rows[0].child_name || null;
        parentEmail = rows[0].parent_email || null;
        gender = rows[0].gender || null;
      }
    } catch (_) {
      // ignore if table isn't migrated yet
    }

    // Optional: resolve student name if the students table exists in this DB.
    let studentName = null;
    try {
      const [stu] = await db.query(`SELECT name FROM students WHERE id = ? LIMIT 1`, [studentId]);
      if (stu && stu.length) studentName = stu[0].name || null;
    } catch (e) {
      // ignore if students table is not in this DB
    }

    // Send email to parent on "onboard" transition (best-effort; do not block scan).
    let emailSent = false;
    let emailError = null;
    if ((direction === 'on' || direction === 'off') && parentEmail && prevStatus !== direction) {
      try {
        // Resolve bus + driver details for parent email.
        let busName = null;
        let driverFullName = null;
        let driverPhone = null;
        let driverEmail = null;
        try {
          const [busRows] = await db.query(`SELECT name FROM transport_buses WHERE id = ? LIMIT 1`, [busId]);
          if (busRows && busRows.length) busName = busRows[0].name || null;
        } catch (_) {
          // ignore
        }
        try {
          const [drvRows] = await db.query(
            `SELECT full_name, phone, email FROM transport_drivers WHERE bus_id = ? LIMIT 1`,
            [busId],
          );
          if (drvRows && drvRows.length) {
            driverFullName = drvRows[0].full_name || null;
            driverPhone = drvRows[0].phone || null;
            driverEmail = drvRows[0].email || null;
          }
        } catch (_) {
          // ignore
        }

        const displayName = childName || studentName || 'Your child';
        const subject =
          direction === 'on'
            ? `Transport update: ${displayName} onboarded`
            : `Transport update: ${displayName} offboarded`;
        const lines = [
          direction === 'on' ? `${displayName} has onboarded the bus.` : `${displayName} has offboarded the bus.`,
          '',
          `Trip: ${tripType}`,
          `Time: ${scannedAt.toISOString()}`,
          busName ? `Bus: ${busName}` : `Bus ID: ${busId}`,
          '',
          `Driver: ${driverFullName || 'N/A'}`,
          `Driver phone: ${driverPhone || 'N/A'}`,
          `Driver email: ${driverEmail || 'N/A'}`,
          '',
          `RFID: ${tagUid}`,
        ];
        const textBody = lines.join('\n');
        await sendTransportEmail(parentEmail, { subject, textBody });
        emailSent = true;
      } catch (e) {
        emailError = e && e.message ? String(e.message) : 'Failed to send email';
        console.error('transport attendance scan email failed:', emailError);
      }
    }

    res.json({
      ok: true,
      busId,
      tripType,
      direction,
      tagUid,
      studentId,
      studentName: childName || studentName,
      gender,
      parentEmail: parentEmail ? String(parentEmail) : null,
      emailSent,
      emailError,
    });
  } catch (err) {
    console.error('transport attendance scan:', err);
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === '42P01') {
      return res.status(503).json({ error: 'Database not ready', details: 'Run backend/sql/2026-04-07-transport_attendance_rfid.sql' });
    }
    res.status(500).json({ error: 'Failed to record scan' });
  }
});

/** POST /api/transport/attendance/manual
 * body: { studentId, tripType, direction?: 'on'|'off', scannedAt?: ISO string }
 * auth: Driver JWT only (fallback when NFC is unavailable).
 */
router.post('/attendance/manual', authenticateToken, async (req, res) => {
  try {
    const r = normalizeRole(req.user?.role);
    if (r !== 'transportdriver') {
      return res.status(403).json({ error: 'Driver session required' });
    }

    const studentIdRaw = req.body?.studentId ?? req.body?.childId;
    const studentId = studentIdRaw != null ? String(studentIdRaw).trim() : '';
    let tripType = req.body?.tripType != null ? String(req.body.tripType).trim().toLowerCase() : '';
    const direction = req.body?.direction != null ? String(req.body.direction).trim().toLowerCase() : 'on';
    const scannedAt = req.body?.scannedAt ? new Date(String(req.body.scannedAt)) : new Date();

    if (!studentId) return res.status(400).json({ error: 'studentId is required' });
    if (tripType !== 'morning' && tripType !== 'evening') {
      return res.status(400).json({ error: 'tripType must be morning|evening' });
    }
    if (direction !== 'on' && direction !== 'off') {
      return res.status(400).json({ error: 'direction must be on|off' });
    }
    if (Number.isNaN(scannedAt.getTime())) {
      return res.status(400).json({ error: 'scannedAt must be a valid ISO timestamp' });
    }

    const driverId = String(req.user.id || '');
    const [drvRows] = await db.query(`SELECT bus_id FROM transport_drivers WHERE id = ? LIMIT 1`, [driverId]);
    const busId = drvRows && drvRows[0] && drvRows[0].bus_id != null ? String(drvRows[0].bus_id) : '';
    if (!busId) {
      return res.status(400).json({ error: 'Driver has no bus assigned' });
    }

    // Security: driver can only mark children assigned to THEIR bus.
    const [assignRows] = await db.query(
      `SELECT bus_id FROM transport_student_assignments WHERE student_id = ? LIMIT 1`,
      [studentId],
    );
    const assignedBus = assignRows && assignRows.length && assignRows[0].bus_id != null ? String(assignRows[0].bus_id) : '';
    if (!assignedBus || assignedBus !== busId) {
      return res.status(403).json({ error: 'Forbidden', details: 'Child is not assigned to this bus' });
    }

    // Use a synthetic tag_uid to satisfy NOT NULL constraint in transport_attendance_scans.
    const tagUid = `manual:${studentId}`;

    await db.query(
      `INSERT INTO transport_attendance_scans (bus_id, trip_type, direction, tag_uid, student_id, scanned_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [busId, tripType, direction, tagUid, studentId, scannedAt],
    );

    const today = toUtcDateString(new Date(scannedAt));
    await db.query(
      `
      INSERT INTO transport_bus_boarding (bus_id, trip_type, student_id, tag_uid, status, last_scanned_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON CONFLICT (bus_id, trip_date, trip_type, student_id)
      DO UPDATE SET status = EXCLUDED.status, tag_uid = EXCLUDED.tag_uid, last_scanned_at = EXCLUDED.last_scanned_at, updated_at = NOW()
      `,
      [busId, tripType, studentId, tagUid, direction, scannedAt],
    );

    res.json({ ok: true, busId, tripType, direction, studentId });
  } catch (err) {
    console.error('transport attendance manual:', err);
    res.status(500).json({ error: 'Manual attendance failed' });
  }
});

/** GET /api/transport/attendance/bus/:busId?tripType=morning&date=YYYY-MM-DD */
router.get('/attendance/bus/:busId', requireTransportAdmin, async (req, res) => {
  try {
    const busId = String(req.params.busId || '').trim();
    const tripType = req.query.tripType != null ? String(req.query.tripType).trim().toLowerCase() : 'morning';
    const date = req.query.date != null ? String(req.query.date).trim() : null;
    if (!busId) return res.status(400).json({ error: 'busId is required' });
    if (tripType !== 'morning' && tripType !== 'evening') return res.status(400).json({ error: 'tripType must be morning|evening' });

    const whereDate = date ? `trip_date = ?` : `trip_date = (NOW() AT TIME ZONE 'UTC')::date`;
    const params = date ? [busId, tripType, date] : [busId, tripType];

    const [rows] = await db.query(
      `
      SELECT student_id, tag_uid, status, last_scanned_at
      FROM transport_bus_boarding
      WHERE bus_id = ?
        AND trip_type = ?
        AND ${whereDate}
      ORDER BY last_scanned_at DESC
      `,
      params,
    );

    res.json({
      busId,
      tripType,
      date: date || toUtcDateString(new Date()),
      boarded: (rows || []).filter((r) => r.status === 'on').map((r) => ({
        studentId: String(r.student_id),
        tagUid: r.tag_uid || null,
        boardedAt: r.last_scanned_at,
      })),
      all: (rows || []).map((r) => ({
        studentId: String(r.student_id),
        tagUid: r.tag_uid || null,
        status: r.status,
        lastScannedAt: r.last_scanned_at,
      })),
    });
  } catch (err) {
    console.error('transport attendance bus:', err);
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === '42P01') {
      return res.status(503).json({ error: 'Database not ready', details: 'Run backend/sql/2026-04-07-transport_attendance_rfid.sql' });
    }
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// --- RFID tags (admin) ---

/** GET /api/transport/rfid-tags */
router.get('/rfid-tags', requireTransportAdmin, async (req, res) => {
  try {
    const schoolId = req.user?.schoolId || req.user?.school_id || null;
    // When using admin secret (no JWT), caller must pass schoolId explicitly.
    const effectiveSchoolId = schoolId || (req.query.schoolId ? String(req.query.schoolId) : null);
    if (!effectiveSchoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }
    const [rows] = await db.query(
      `SELECT id, tag_uid, tag_name, assigned_student_id, created_at
       FROM transport_rfid_tags
       WHERE school_id = ?
       ORDER BY created_at DESC`,
      [String(effectiveSchoolId)],
    );
    res.json({
      tags: (rows || []).map((r) => ({
        id: String(r.id),
        tagUid: r.tag_uid,
        tagName: r.tag_name || null,
        assignedStudentId: r.assigned_student_id != null ? String(r.assigned_student_id) : null,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error('transport list rfid tags:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ error: 'Database not ready', details: 'Run backend/sql/2026-04-07-transport_rfid_pickup_points.sql' });
    }
    res.status(500).json({ error: 'Failed to list RFID tags' });
  }
});

/** POST /api/transport/rfid-tags body: { schoolId, tagUid } */
router.post('/rfid-tags', requireTransportAdmin, async (req, res) => {
  try {
    const schoolId = req.user?.schoolId || req.user?.school_id || req.body?.schoolId;
    const tagUid = req.body?.tagUid != null ? String(req.body.tagUid).trim() : '';
    const tagName = req.body?.tagName != null ? String(req.body.tagName).trim() : '';
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!tagUid) return res.status(400).json({ error: 'tagUid is required' });
    const [ins] = await db.query(
      `INSERT INTO transport_rfid_tags (school_id, tag_uid, tag_name) VALUES (?, ?, ?) RETURNING id`,
      [String(schoolId), tagUid, tagName || null],
    );
    const newId = ins && ins[0] && ins[0].id ? String(ins[0].id) : null;
    res.status(201).json({ ok: true, id: newId });
  } catch (err) {
    console.error('transport create rfid tag:', err);
    if (err.code === 'ER_DUP_ENTRY' || err.code === '23505') {
      return res.status(409).json({ error: 'RFID already exists or already assigned' });
    }
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ error: 'Database not ready', details: 'Run backend/sql/2026-04-07-transport_rfid_pickup_points.sql' });
    }
    res.status(500).json({ error: 'Failed to create RFID tag' });
  }
});

/** PATCH /api/transport/rfid-tags/:id/assign body: { studentId } (studentId == transport_children.id for now) */
router.patch('/rfid-tags/:id/assign', requireTransportAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const studentId = req.body?.studentId != null ? String(req.body.studentId).trim() : '';
    if (!id) return res.status(400).json({ error: 'id is required' });
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    const [upd] = await db.query(
      `UPDATE transport_rfid_tags SET assigned_student_id = ? WHERE id = ? RETURNING id`,
      [studentId, String(id)],
    );
    if (!upd || !upd.length) return res.status(404).json({ error: 'RFID tag not found' });

    // Best-effort: email parent with card details on assignment.
    let emailSent = false;
    let emailError = null;
    try {
      const [rows] = await db.query(
        `
        SELECT c.child_name, c.parent_email, t.tag_uid, t.tag_name
        FROM transport_children c
        JOIN transport_rfid_tags t ON t.id = ?
        WHERE c.id = ?
        LIMIT 1
        `,
        [String(id), String(studentId)],
      );
      if (rows && rows.length) {
        const r = rows[0];
        const to = r.parent_email ? String(r.parent_email).trim() : '';
        if (to) {
          const childName = r.child_name || 'Your child';
          const tagUid = r.tag_uid || '';
          const tagName = r.tag_name || '';
          const subject = `Transport RFID assigned for ${childName}`;
          const textBody =
            `RFID card assigned successfully.\n\n` +
            `Child: ${childName}\n` +
            `Card UID: ${tagUid}\n` +
            (tagName ? `Card name: ${tagName}\n` : '') +
            `\nPlease keep this card safe.`;
          await sendTransportEmail(to, { subject, textBody });
          emailSent = true;
        }
      }
    } catch (e) {
      emailError = e && e.message ? String(e.message) : 'Failed to send email';
      console.error('transport rfid assign email failed:', emailError);
    }
    res.json({ ok: true, emailSent, emailError });
  } catch (err) {
    console.error('transport assign rfid tag:', err);
    if (err.code === 'ER_DUP_ENTRY' || err.code === '23505') {
      return res.status(409).json({ error: 'This student already has an RFID assigned (or RFID already assigned)' });
    }
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === '42P01') {
      return res.status(503).json({ error: 'Database not ready', details: 'Run backend/sql/2026-04-09-transport_children_rfid_tag_name.sql' });
    }
    res.status(500).json({ error: 'Failed to assign RFID tag' });
  }
});

/** PATCH /api/transport/rfid-tags/:id/unassign — clears assigned_student_id so tag can be reused */
router.patch('/rfid-tags/:id/unassign', requireTransportAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id is required' });
    const [upd] = await db.query(
      `UPDATE transport_rfid_tags SET assigned_student_id = NULL WHERE id = ? RETURNING id`,
      [String(id)],
    );
    if (!upd || !upd.length) return res.status(404).json({ error: 'RFID tag not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('transport unassign rfid tag:', err);
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === '42P01') {
      return res.status(503).json({ error: 'Database not ready' });
    }
    res.status(500).json({ error: 'Failed to unassign RFID tag' });
  }
});

/** DELETE /api/transport/rfid-tags/:id — permanently deletes RFID tag row */
router.delete('/rfid-tags/:id', requireTransportAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id is required' });
    const [del] = await db.query(`DELETE FROM transport_rfid_tags WHERE id = ? RETURNING id`, [String(id)]);
    if (!del || !del.length) return res.status(404).json({ error: 'RFID tag not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('transport delete rfid tag:', err);
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === '42P01') {
      return res.status(503).json({ error: 'Database not ready' });
    }
    res.status(500).json({ error: 'Failed to delete RFID tag' });
  }
});

// --- Reports (admin) ---

/**
 * GET /api/transport/reports/driver?busId=...&tripType=morning&date=YYYY-MM-DD
 * Generates a JSON report from DB events and stores it in S3.
 */
router.get('/reports/driver', requireTransportAdmin, async (req, res) => {
  try {
    const busId = req.query.busId != null ? String(req.query.busId).trim() : '';
    const tripType = req.query.tripType != null ? String(req.query.tripType).trim().toLowerCase() : '';
    const date = req.query.date != null ? String(req.query.date).trim() : '';
    if (!busId) return res.status(400).json({ error: 'busId is required' });
    if (tripType !== 'morning' && tripType !== 'evening') return res.status(400).json({ error: 'tripType must be morning|evening' });
    if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });

    // Trip summary (start/end/status)
    const [tripRows] = await db.query(
      `
      SELECT status, started_at, ended_at, updated_at
      FROM transport_bus_trips
      WHERE bus_id = ? AND trip_date = ?::date AND trip_type = ?
      LIMIT 1
      `,
      [busId, date, tripType],
    );
    const trip = tripRows && tripRows.length ? tripRows[0] : null;

    // Resolve route stops for this bus/trip type (via assigned driver route)
    const [drvRows] = await db.query(
      `SELECT morning_route_id, evening_route_id FROM transport_drivers WHERE bus_id = ? LIMIT 1`,
      [busId],
    );
    const routeId =
      drvRows && drvRows.length
        ? String(tripType === 'evening' ? drvRows[0].evening_route_id || '' : drvRows[0].morning_route_id || '')
        : '';
    const [stopRows] = routeId
      ? await db.query(
          `SELECT id, sequence_order, name, lat, lng
           FROM transport_route_stops
           WHERE route_id = ?
           ORDER BY sequence_order ASC`,
          [routeId],
        )
      : [[], undefined];
    const stops = (stopRows || []).map((s) => ({
      id: String(s.id),
      order: Number(s.sequence_order) || 0,
      name: s.name,
      lat: s.lat != null ? Number(s.lat) : null,
      lng: s.lng != null ? Number(s.lng) : null,
    }));

    // Reached stop events
    const [evRows] = await db.query(
      `
      SELECT route_stop_id, event_type, created_at
      FROM transport_geofence_events
      WHERE bus_id = ? AND trip_date = ?::date AND trip_type = ?
      ORDER BY created_at ASC
      `,
      [busId, date, tripType],
    );
    const reached = (evRows || [])
      .filter((e) => e.event_type === 'reached_stop' && e.route_stop_id)
      .map((e) => ({ routeStopId: String(e.route_stop_id), at: e.created_at }));

    const reachedByStopId = new Map();
    for (const r of reached) reachedByStopId.set(r.routeStopId, r.at);

    const tripOut = trip
      ? {
          status: trip.status || null,
          startedAt: trip.started_at ? new Date(trip.started_at).toISOString() : null,
          endedAt: trip.ended_at ? new Date(trip.ended_at).toISOString() : null,
          updatedAt: trip.updated_at ? new Date(trip.updated_at).toISOString() : null,
        }
      : null;

    res.json({
      ok: true,
      busId,
      tripType,
      date,
      trip: tripOut,
      route: routeId ? { routeId } : null,
      stops: stops.map((s) => ({
        id: s.id,
        order: s.order,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        reachedAt: reachedByStopId.get(s.id) || null,
      })),
      events: (evRows || []).map((e) => ({
        eventType: e.event_type,
        routeStopId: e.route_stop_id != null ? String(e.route_stop_id) : null,
        at: e.created_at,
      })),
    });
  } catch (err) {
    console.error('transport driver report:', err);
    res.status(500).json({ error: 'Failed to generate driver report' });
  }
});

// --- Announcements (admin → parents in-app) ---

/** GET /api/transport/announcements?schoolId=...&busId=... */
router.get('/announcements', requireTransportParentOrAdmin, async (req, res) => {
  try {
    const role = normalizeRole(req.user?.role);
    const tokenSchoolId = req.user?.schoolId || req.user?.school_id || null;
    const effectiveSchoolId =
      role === 'parent'
        ? tokenSchoolId
        : tokenSchoolId || (req.query.schoolId ? String(req.query.schoolId) : null);
    if (!effectiveSchoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }
    const busId = req.query.busId ? String(req.query.busId) : null;

    const [rows] = await db.query(
      `
      SELECT id, school_id, bus_id, title, message, created_at
      FROM transport_announcements
      WHERE school_id = ?
        AND (?::uuid IS NULL OR bus_id = ?::uuid OR bus_id IS NULL)
      ORDER BY created_at DESC
      LIMIT 200
      `,
      [String(effectiveSchoolId), busId, busId],
    );

    return res.json({
      announcements: (rows || []).map((r) => ({
        id: String(r.id),
        schoolId: String(r.school_id),
        busId: r.bus_id != null ? String(r.bus_id) : null,
        title: r.title,
        message: r.message,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error('transport list announcements:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res
        .status(503)
        .json({ error: 'Database not ready', details: 'Run backend/sql/2026-04-10-transport_announcements.sql' });
    }
    return res.status(500).json({ error: 'Failed to list announcements' });
  }
});

/** POST /api/transport/announcements body: { schoolId, busId?, title, message } */
router.post('/announcements', requireTransportAdmin, async (req, res) => {
  try {
    const schoolId = req.user?.schoolId || req.user?.school_id || req.body?.schoolId;
    const busId = req.body?.busId != null ? String(req.body.busId).trim() : '';
    const title = req.body?.title != null ? String(req.body.title).trim() : '';
    const message = req.body?.message != null ? String(req.body.message).trim() : '';
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!title) return res.status(400).json({ error: 'title is required' });
    if (!message) return res.status(400).json({ error: 'message is required' });

    const createdByUserId = req.user?.id ? String(req.user.id) : null;
    const createdByRole = req.user?.role ? String(req.user.role) : null;

    const [ins] = await db.query(
      `
      INSERT INTO transport_announcements (school_id, bus_id, title, message, created_by_user_id, created_by_role)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING id
      `,
      [String(schoolId), busId || null, title, message, createdByUserId, createdByRole],
    );
    const newId = ins && ins[0] && ins[0].id ? String(ins[0].id) : null;
    return res.status(201).json({ ok: true, id: newId });
  } catch (err) {
    console.error('transport create announcement:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res
        .status(503)
        .json({ error: 'Database not ready', details: 'Run backend/sql/2026-04-10-transport_announcements.sql' });
    }
    return res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// --- Children (admin) ---

/** GET /api/transport/children?schoolId=... */
router.get('/children', requireTransportAdmin, async (req, res) => {
  try {
    const schoolId = req.user?.schoolId || req.user?.school_id || null;
    const effectiveSchoolId = schoolId || (req.query.schoolId ? String(req.query.schoolId) : null);
    if (!effectiveSchoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }
    const [rows] = await db.query(
      `
      SELECT c.id, c.school_id, c.child_name, c.gender, c.parent_email, c.address, c.created_at, c.updated_at,
             a.bus_id, a.pickup_point_id, a.drop_point_id,
             pp.name AS pickup_point_name,
             dp.name AS drop_point_name,
             rt.id AS rfid_tag_id,
             rt.tag_uid AS rfid_tag_uid
      FROM transport_children c
      LEFT JOIN transport_student_assignments a ON a.student_id = c.id
      LEFT JOIN transport_pickup_points pp ON pp.id = a.pickup_point_id
      LEFT JOIN transport_pickup_points dp ON dp.id = a.drop_point_id
      LEFT JOIN transport_rfid_tags rt ON rt.assigned_student_id = c.id
      WHERE c.school_id = ?
      ORDER BY c.created_at DESC
      `,
      [String(effectiveSchoolId)],
    );
    res.json({
      children: (rows || []).map((r) => ({
        id: String(r.id),
        schoolId: String(r.school_id),
        childName: r.child_name,
        gender: r.gender || null,
        parentEmail: r.parent_email,
        address: r.address || null,
        busId: r.bus_id != null ? String(r.bus_id) : null,
        pickupPointId: r.pickup_point_id != null ? String(r.pickup_point_id) : null,
        pickupPointName: r.pickup_point_name || null,
        dropPointId: r.drop_point_id != null ? String(r.drop_point_id) : null,
        dropPointName: r.drop_point_name || null,
        rfidTagId: r.rfid_tag_id != null ? String(r.rfid_tag_id) : null,
        rfidTagUid: r.rfid_tag_uid || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (err) {
    console.error('transport list children:', err);
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === '42P01') {
      return res.status(503).json({ error: 'Database not ready', details: 'Run backend/sql/2026-04-09-transport_children_rfid_tag_name.sql' });
    }
    res.status(500).json({ error: 'Failed to list children', details: err.message || undefined });
  }
});

/** POST /api/transport/children body: { schoolId, childName, gender?, parentEmail, address } */
router.post('/children', requireTransportAdmin, async (req, res) => {
  try {
    const schoolId = req.user?.schoolId || req.user?.school_id || req.body?.schoolId;
    const childName = req.body?.childName != null ? String(req.body.childName).trim() : '';
    const parentEmail = req.body?.parentEmail != null ? String(req.body.parentEmail).trim() : '';
    const gender = req.body?.gender != null ? String(req.body.gender).trim() : '';
    const address = req.body?.address != null ? String(req.body.address).trim() : '';

    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!childName) return res.status(400).json({ error: 'childName is required' });
    if (!parentEmail) return res.status(400).json({ error: 'parentEmail is required' });
    if (!address) return res.status(400).json({ error: 'address is required' });

    let ins;
    [ins] = await db.query(
      `
      INSERT INTO transport_children (school_id, child_name, gender, parent_email, address)
      VALUES (?, ?, ?, ?, ?)
      RETURNING id
      `,
      [String(schoolId), childName, gender || null, parentEmail, address],
    );
    const newId = ins && ins[0] && ins[0].id ? String(ins[0].id) : null;
    res.status(201).json({ ok: true, id: newId });
  } catch (err) {
    console.error('transport create child:', err);
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === '42P01') {
      return res.status(503).json({ error: 'Database not ready', details: 'Run backend/sql/2026-04-09-transport_children_rfid_tag_name.sql' });
    }
    res.status(500).json({ error: 'Failed to create child', details: err.message || undefined });
  }
});

/** PATCH /api/transport/children/:id/assignment body: { busId?, pickupPointId?, dropPointId? } */
router.patch('/children/:id/assignment', requireTransportAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const busId = req.body?.busId != null ? String(req.body.busId).trim() : null;
    const pickupPointId = req.body?.pickupPointId != null ? String(req.body.pickupPointId).trim() : null;
    const dropPointId = req.body?.dropPointId != null ? String(req.body.dropPointId).trim() : null;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const [c] = await db.query(`SELECT school_id, child_name, parent_email FROM transport_children WHERE id = ? LIMIT 1`, [String(id)]);
    if (!c || !c.length) return res.status(404).json({ error: 'Child not found' });
    const schoolId = String(c[0].school_id);
    const childName = c[0].child_name || 'Your child';
    const parentEmail = c[0].parent_email ? String(c[0].parent_email).trim() : '';

    await db.query(
      `
      INSERT INTO transport_student_assignments (student_id, school_id, bus_id, pickup_point_id, drop_point_id, updated_at)
      VALUES (?, ?, ?, ?, ?, NOW())
      ON CONFLICT (student_id)
      DO UPDATE SET
        school_id = EXCLUDED.school_id,
        bus_id = EXCLUDED.bus_id,
        pickup_point_id = EXCLUDED.pickup_point_id,
        drop_point_id = EXCLUDED.drop_point_id,
        updated_at = NOW()
      `,
      [String(id), schoolId, busId || null, pickupPointId || null, dropPointId || null],
    );

    // Notify parent about bus/pickup assignment (best-effort).
    let emailSent = false;
    let emailError = null;
    if (parentEmail && (busId || pickupPointId || dropPointId)) {
      try {
        let busName = '';
        let pickupName = '';
        let dropName = '';
        if (busId) {
          const [b] = await db.query(`SELECT name FROM transport_buses WHERE id = ? LIMIT 1`, [String(busId)]);
          if (b && b.length) busName = b[0].name || '';
        }
        if (pickupPointId) {
          const [p] = await db.query(`SELECT name FROM transport_pickup_points WHERE id = ? LIMIT 1`, [String(pickupPointId)]);
          if (p && p.length) pickupName = p[0].name || '';
        }
        if (dropPointId) {
          const [d] = await db.query(`SELECT name FROM transport_pickup_points WHERE id = ? LIMIT 1`, [String(dropPointId)]);
          if (d && d.length) dropName = d[0].name || '';
        }
        const subject = `Transport assignment updated for ${childName}`;
        const textBody =
          `Transport assignment updated.\n\n` +
          `Child: ${childName}\n` +
          (pickupName ? `Pickup point: ${pickupName}\n` : '') +
          (dropName ? `Drop point: ${dropName}\n` : '') +
          (busName ? `Bus: ${busName}\n` : '') +
          `\nThank you.`;
        await sendTransportEmail(parentEmail, { subject, textBody });
        emailSent = true;
      } catch (e) {
        emailError = e && e.message ? String(e.message) : 'Failed to send email';
        console.error('transport child assignment email failed:', emailError);
      }
    }

    res.json({ ok: true, emailSent, emailError });
  } catch (err) {
    console.error('transport patch child assignment:', err);
    res.status(500).json({ error: 'Failed to update child assignment' });
  }
});

/** DELETE /api/transport/children/:id — permanently deletes child + related assignment + RFID linkage */
router.delete('/children/:id', requireTransportAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id is required' });

    // Best-effort cleanup: unassign RFID tag + delete assignment row first.
    await db.query(`UPDATE transport_rfid_tags SET assigned_student_id = NULL WHERE assigned_student_id = ?`, [String(id)]);
    await db.query(`DELETE FROM transport_student_assignments WHERE student_id = ?`, [String(id)]);

    const [del] = await db.query(`DELETE FROM transport_children WHERE id = ? RETURNING id`, [String(id)]);
    if (!del || !del.length) return res.status(404).json({ error: 'Child not found' });

    res.json({ ok: true, id: String(del[0].id) });
  } catch (err) {
    console.error('transport delete child:', err);
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === '42P01') {
      return res.status(503).json({ error: 'Database not ready' });
    }
    res.status(500).json({ error: 'Failed to delete child' });
  }
});

// --- Pickup points (admin) ---

/** POST /api/transport/pickup-points body: { schoolId, name, lat, lng } */
router.post('/pickup-points', requireTransportAdmin, async (req, res) => {
  try {
    const schoolId = req.user?.schoolId || req.user?.school_id || req.body?.schoolId;
    const name = req.body?.name != null ? String(req.body.name).trim() : '';
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (Number.isNaN(lat) || Number.isNaN(lng)) return res.status(400).json({ error: 'lat and lng are required (numbers)' });
    const [ins] = await db.query(
      `INSERT INTO transport_pickup_points (school_id, name, lat, lng) VALUES (?, ?, ?, ?) RETURNING id`,
      [String(schoolId), name, lat, lng],
    );
    const newId = ins && ins[0] && ins[0].id ? String(ins[0].id) : null;
    res.status(201).json({ ok: true, id: newId });
  } catch (err) {
    console.error('transport create pickup point:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ error: 'Database not ready', details: 'Run backend/sql/2026-04-07-transport_rfid_pickup_points.sql' });
    }
    res.status(500).json({ error: 'Failed to create pickup point' });
  }
});

/** GET /api/transport/pickup-points?schoolId=... */
router.get('/pickup-points', requireTransportAdmin, async (req, res) => {
  try {
    const schoolId = req.user?.schoolId || req.user?.school_id || null;
    const effectiveSchoolId = schoolId || (req.query.schoolId ? String(req.query.schoolId) : null);
    if (!effectiveSchoolId) return res.status(400).json({ error: 'schoolId is required' });
    const [rows] = await db.query(
      `SELECT id, name, lat, lng, created_at
       FROM transport_pickup_points
       WHERE school_id = ?
       ORDER BY created_at DESC`,
      [String(effectiveSchoolId)],
    );
    res.json({
      pickupPoints: (rows || []).map((r) => ({
        id: String(r.id),
        schoolId: String(effectiveSchoolId),
        name: r.name,
        lat: Number(r.lat),
        lng: Number(r.lng),
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error('transport list pickup points:', err);
    res.status(500).json({ error: 'Failed to list pickup points' });
  }
});

/** GET /api/transport/pickup-points/nearest?schoolId=...&q=address */
router.get('/pickup-points/nearest', requireTransportAdmin, async (req, res) => {
  try {
    const schoolId = req.user?.schoolId || req.user?.school_id || null;
    const effectiveSchoolId = schoolId || (req.query.schoolId ? String(req.query.schoolId) : null);
    const q = req.query.q != null ? String(req.query.q).trim() : '';
    if (!effectiveSchoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!q) return res.json({ pickupPoints: [] });

    const key = (process.env.AWS_LOCATION_API_KEY || '').trim();
    if (!key) {
      return res.status(503).json({ error: 'AWS_LOCATION_API_KEY is not set on the server' });
    }

    const region = getPlacesRegion();
    const url = `https://places.geo.${region}.amazonaws.com/suggest?key=${encodeURIComponent(key)}`;
    const urlV2 = `https://places.geo.${region}.amazonaws.com/v2/suggest?key=${encodeURIComponent(key)}`;
    const body = {
      QueryText: q,
      MaxResults: 5,
      BiasPosition: getPlacesBias(),
      Language: 'en',
    };
    const countries = getAutocompleteCountryFilter();
    if (countries) body.Filter = { IncludeCountries: countries };
    const headers = {
      'Content-Type': 'application/json',
      ...placesForwardHeaders(req),
    };

    async function postJson(targetUrl) {
      const r = await fetch(targetUrl, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await r.json().catch(() => ({}));
      return { r, data };
    }

    let { r, data } = await postJson(url);
    if (!r.ok) {
      const msg = String((data && (data.message || data.Message || data.error)) || '');
      if (r.status === 403 && /determine service\/operation name to be authorized/i.test(msg)) {
        ({ r, data } = await postJson(urlV2));
      }
    }
    if (!r.ok) {
      console.error('transport nearest pickup suggest', r.status, data);
      return res.status(r.status >= 400 ? r.status : 502).json({
        error: data.message || data.Message || data.error || 'Geocode suggest failed',
      });
    }

    const first = (data.ResultItems || []).find((it) => it && it.Place && it.Place.PlaceId);
    const placeId = first && first.Place && first.Place.PlaceId ? String(first.Place.PlaceId) : '';
    if (!placeId) return res.json({ pickupPoints: [] });

    const pathSeg = encodeURIComponent(placeId);
    const qs = new URLSearchParams({
      key,
      language: 'en',
      'intended-use': 'SingleUse',
    });
    const detailsUrl = `https://places.geo.${region}.amazonaws.com/v2/place/${pathSeg}?${qs.toString()}`;
    const dr = await fetch(detailsUrl, { method: 'GET', headers: { ...placesForwardHeaders(req) } });
    const dd = await dr.json().catch(() => ({}));
    if (!dr.ok) {
      console.error('transport nearest pickup details', dr.status, dd);
      return res.status(dr.status >= 400 ? dr.status : 502).json({
        error: dd.message || dd.error || 'Geocode details failed',
      });
    }
    const pos = dd.Position;
    if (!Array.isArray(pos) || pos.length < 2) return res.json({ pickupPoints: [] });
    const lng = Number(pos[0]);
    const lat = Number(pos[1]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return res.json({ pickupPoints: [] });

    const [rows] = await db.query(
      `
      SELECT id, name, lat, lng,
        ( (lat - ?) * (lat - ?) + (lng - ?) * (lng - ?) ) AS d2
      FROM transport_pickup_points
      WHERE school_id = ?
      ORDER BY d2 ASC
      LIMIT 8
      `,
      [lat, lat, lng, lng, String(effectiveSchoolId)],
    );

    res.json({
      pickupPoints: (rows || []).map((r2) => ({
        id: String(r2.id),
        name: r2.name,
        lat: Number(r2.lat),
        lng: Number(r2.lng),
      })),
    });
  } catch (err) {
    console.error('transport nearest pickup points:', err);
    res.status(500).json({ error: 'Failed to fetch nearest pickup points' });
  }
});

/** Public: GET /api/transport/registration/:code/rfid/available */
router.get('/registration/:code/rfid/available', async (req, res) => {
  try {
    const code = String(req.params.code || '').trim();
    if (!code) return res.status(400).json({ error: 'code is required' });
    const [links] = await db.query(
      'SELECT school_id FROM registration_links WHERE link_code = ? AND is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())',
      [code],
    );
    if (!links.length) return res.status(404).json({ error: 'Invalid or expired registration link' });
    const schoolId = String(links[0].school_id);
    const [rows] = await db.query(
      `SELECT id, tag_uid FROM transport_rfid_tags WHERE school_id = ? AND assigned_student_id IS NULL ORDER BY created_at DESC`,
      [schoolId],
    );
    res.json({ schoolId, tags: (rows || []).map((r) => ({ id: String(r.id), tagUid: r.tag_uid })) });
  } catch (err) {
    console.error('transport available rfid:', err);
    res.status(500).json({ error: 'Failed to fetch available RFID tags' });
  }
});

/** Public: GET /api/transport/registration/:code/pickup-points */
router.get('/registration/:code/pickup-points', async (req, res) => {
  try {
    const code = String(req.params.code || '').trim();
    const q = req.query.q != null ? String(req.query.q).trim() : '';
    if (!code) return res.status(400).json({ error: 'code is required' });
    if (!q) return res.json({ pickupPoints: [] });

    const [links] = await db.query(
      'SELECT school_id FROM registration_links WHERE link_code = ? AND is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())',
      [code],
    );
    if (!links.length) return res.status(404).json({ error: 'Invalid or expired registration link' });
    const schoolId = String(links[0].school_id);

    // Geocode child address (q) via AWS Places Suggest + Details using server API key.
    const key = (process.env.AWS_LOCATION_API_KEY || '').trim();
    if (!key) {
      return res.status(503).json({ error: 'AWS_LOCATION_API_KEY is not set on the server' });
    }
    const region = getPlacesRegion();
    const url = `https://places.geo.${region}.amazonaws.com/suggest?key=${encodeURIComponent(key)}`;
    const urlV2 = `https://places.geo.${region}.amazonaws.com/v2/suggest?key=${encodeURIComponent(key)}`;
    const body = {
      QueryText: q,
      MaxResults: 5,
      BiasPosition: getPlacesBias(),
      Language: 'en',
    };
    const countries = getAutocompleteCountryFilter();
    if (countries) body.Filter = { IncludeCountries: countries };
    const headers = {
      'Content-Type': 'application/json',
      ...placesForwardHeaders(req),
    };

    async function postJson(targetUrl) {
      const r = await fetch(targetUrl, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await r.json().catch(() => ({}));
      return { r, data };
    }

    let { r, data } = await postJson(url);
    if (!r.ok) {
      const msg = String((data && (data.message || data.Message || data.error)) || '');
      if (r.status === 403 && /determine service\/operation name to be authorized/i.test(msg)) {
        ({ r, data } = await postJson(urlV2));
      }
    }
    if (!r.ok) {
      console.error('transport registration geocode suggest', r.status, data);
      return res.status(r.status >= 400 ? r.status : 502).json({
        error: data.message || data.Message || data.error || 'Geocode suggest failed',
      });
    }
    const first = (data.ResultItems || []).find((it) => it && it.Place && it.Place.PlaceId);
    const placeId = first && first.Place && first.Place.PlaceId ? String(first.Place.PlaceId) : '';
    if (!placeId) return res.json({ pickupPoints: [] });

    const pathSeg = encodeURIComponent(placeId);
    const qs = new URLSearchParams({
      key,
      language: 'en',
      'intended-use': 'SingleUse',
    });
    const detailsUrl = `https://places.geo.${region}.amazonaws.com/v2/place/${pathSeg}?${qs.toString()}`;
    const dr = await fetch(detailsUrl, { method: 'GET', headers: { ...placesForwardHeaders(req) } });
    const dd = await dr.json().catch(() => ({}));
    if (!dr.ok) {
      console.error('transport registration geocode details', dr.status, dd);
      return res.status(dr.status >= 400 ? dr.status : 502).json({
        error: dd.message || dd.error || 'Geocode details failed',
      });
    }
    const pos = dd.Position;
    if (!Array.isArray(pos) || pos.length < 2) return res.json({ pickupPoints: [] });
    const lng = Number(pos[0]);
    const lat = Number(pos[1]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return res.json({ pickupPoints: [] });

    // Haversine-ish ordering without PostGIS (ok for short ranges)
    const [rows] = await db.query(
      `
      SELECT id, name, lat, lng,
        ( (lat - ?) * (lat - ?) + (lng - ?) * (lng - ?) ) AS d2
      FROM transport_pickup_points
      WHERE school_id = ?
      ORDER BY d2 ASC
      LIMIT 8
      `,
      [lat, lat, lng, lng, schoolId],
    );
    res.json({
      pickupPoints: (rows || []).map((r) => ({
        id: String(r.id),
        name: r.name,
        lat: Number(r.lat),
        lng: Number(r.lng),
      })),
    });
  } catch (err) {
    console.error('transport registration pickup points:', err);
    res.status(500).json({ error: 'Failed to fetch pickup points' });
  }
});

/** PATCH /api/transport/routes/:id — update route name and replace stops */
router.patch('/routes/:id', requireTransportAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, stops } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!Array.isArray(stops) || stops.length === 0) {
      return res.status(400).json({ error: 'stops must be a non-empty array' });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [upd] = await conn.query(`UPDATE transport_routes SET name = ? WHERE id = ? RETURNING id`, [
        String(name).trim(),
        String(id),
      ]);
      if (!upd || !upd.length) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ error: 'Route not found' });
      }

      await conn.query(`DELETE FROM transport_route_stops WHERE route_id = ?`, [String(id)]);

      let seq = 0;
      for (const s of stops) {
        seq += 1;
        const lat = s.lat != null ? Number(s.lat) : NaN;
        const lng = s.lng != null ? Number(s.lng) : NaN;
        if (!s.name || Number.isNaN(lat) || Number.isNaN(lng)) {
          await conn.rollback();
          conn.release();
          return res.status(400).json({ error: 'Each stop needs name, lat, lng' });
        }
        await conn.query(
          `INSERT INTO transport_route_stops (route_id, sequence_order, name, lat, lng) VALUES (?, ?, ?, ?, ?)`,
          [String(id), seq, String(s.name).trim(), lat, lng],
        );
      }

      await conn.commit();
      conn.release();
      res.json({ ok: true, message: 'Route updated' });
    } catch (e) {
      try {
        await conn.rollback();
      } catch (_) {
        /* ignore */
      }
      conn.release(e);
      throw e;
    }
  } catch (err) {
    console.error('transport patch route:', err);
    res.status(500).json({ error: 'Failed to update route' });
  }
});

/** DELETE /api/transport/routes/:id — delete route (only if unassigned) */
router.delete('/routes/:id', requireTransportAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id is required' });
    const [inUse] = await db.query(
      `SELECT id FROM transport_drivers WHERE morning_route_id = ? OR evening_route_id = ? LIMIT 1`,
      [String(id), String(id)],
    );
    if (inUse && inUse.length) {
      return res.status(409).json({ error: 'Route is assigned to a driver. Unassign it first.' });
    }
    const [del] = await db.query(`DELETE FROM transport_routes WHERE id = ? RETURNING id`, [String(id)]);
    if (!del || !del.length) return res.status(404).json({ error: 'Route not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('transport delete route:', err);
    res.status(500).json({ error: 'Failed to delete route' });
  }
});

module.exports = router;
