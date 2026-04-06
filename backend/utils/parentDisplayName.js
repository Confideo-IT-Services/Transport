/**
 * Resolve parent/guardian display names from students.submitted_data vs parent_name column.
 */

function parseSubmittedData(raw) {
  if (raw == null || raw === '') return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return p && typeof p === 'object' ? p : {};
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * School-facing label: father first, then mother, then parent_name (e.g. visitor management).
 * @param {{ submitted_data?: unknown, parent_name?: string | null }} row
 * @returns {string | null}
 */
function parentDisplayNameFatherFirst(row) {
  if (!row) return null;
  const sd = parseSubmittedData(row.submitted_data);
  const father = sd.fatherName || sd.father_name;
  const mother = sd.motherName || sd.mother_name;
  const fromReg = [father, mother]
    .map((x) => (x != null ? String(x).trim() : ''))
    .find((s) => s.length > 0);
  if (fromReg) return fromReg;
  if (row.parent_name && String(row.parent_name).trim()) return String(row.parent_name).trim();
  return null;
}

module.exports = {
  parseSubmittedData,
  parentDisplayNameFatherFirst,
};
