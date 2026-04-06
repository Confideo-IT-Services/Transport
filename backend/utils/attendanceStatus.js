/**
 * API / UI uses lowercase status strings; PostgreSQL status_enum uses Title Case labels.
 */

const API_TO_PG = Object.freeze({
  present: 'present',
  absent: 'absent',
  late: 'late',
  leave: 'leave',
  'not-marked': 'not-marked',
});

function toPgAttendanceStatus(apiStatus) {
  if (apiStatus == null || apiStatus === '') return null;
  const key = String(apiStatus).trim().toLowerCase();
  return API_TO_PG[key] ?? null;
}

function attendanceStatusForApi(dbValue) {
  if (dbValue == null || dbValue === '') return null;
  let s = String(dbValue).trim().toLowerCase();
  if (s === 'not_marked') s = 'not-marked';
  return s;
}

module.exports = {
  toPgAttendanceStatus,
  attendanceStatusForApi,
};
