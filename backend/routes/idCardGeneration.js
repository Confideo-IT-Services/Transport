const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');

function getByPath(obj, path) {
  if (!path) return undefined;
  const parts = String(path).split('.');
  return parts.reduce((acc, key) => {
    if (acc && typeof acc === 'object') return acc[key];
    return undefined;
  }, obj);
}

function normalizeLayout(rawLayout, templateRow) {
  // Supports both legacy { elements, field_mappings } and new { width_mm, elements[], fieldMappings }
  if (!rawLayout || typeof rawLayout !== 'object') rawLayout = {};

  // New schema already
  if (rawLayout.elements && rawLayout.fieldMappings) {
    return rawLayout;
  }

  const legacyElements = rawLayout.elements || [];
  const legacyMappings = rawLayout.field_mappings || rawLayout.fieldMappings || {};

  return {
    id: templateRow?.id,
    name: templateRow?.name,
    width_mm: templateRow?.card_width || 54,
    height_mm: templateRow?.card_height || 86,
    orientation: templateRow?.orientation || 'portrait',
    backgroundImageUrl: templateRow?.background_image_url || rawLayout.backgroundImageUrl,
    elements: legacyElements.map((el) => ({
      id: el.id,
      type: (el.type === 'textbox' ? 'text' : el.type),
      label: el.label,
      templateField: el.templateField || el.template_field || el.field, // best-effort
      x_percent: el.x_percent ?? el.x,
      y_percent: el.y_percent ?? el.y,
      width_percent: el.width_percent ?? el.width,
      height_percent: el.height_percent ?? el.height,
      fontSize: el.fontSize,
      fontFamily: el.fontFamily,
      fontWeight: el.fontWeight,
      color: el.color,
      align: el.align || el.textAlign,
    })),
    fieldMappings: legacyMappings,
  };
}

// Get students for a school with template for ID card generation
router.get('/students/:schoolId', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { templateId } = req.query;

    if (!templateId) {
      return res.status(400).json({ error: 'templateId query parameter is required' });
    }

    // Fetch template
    const [templates] = await db.query(
      `SELECT * FROM id_card_templates WHERE id = ? AND school_id = ?`,
      [templateId, schoolId]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found for this school' });
    }

    const template = templates[0];
    let templateData = {};
    try {
      templateData = typeof template.template_data === 'string' 
        ? JSON.parse(template.template_data) 
        : template.template_data;
    } catch (e) {
      console.error('Error parsing template_data:', e);
      templateData = {};
    }

    // Preferred: fetch layout from S3 URL stored in DB column. Fallback: use template_data.
    let templateLayout = null;
    if (template.layout_json_url) {
      try {
        const layoutResponse = await fetch(template.layout_json_url);
        if (layoutResponse.ok) {
          templateLayout = await layoutResponse.json();
        } else {
          console.warn('Failed to fetch layout from S3:', layoutResponse.statusText);
        }
      } catch (error) {
        console.error('Error fetching layout from S3:', error);
      }
    }

    const layout = normalizeLayout(templateLayout || templateData, template);
    const fieldMappings = layout.fieldMappings || {};

    // Fetch all approved students
    const [students] = await db.query(
      `SELECT 
        s.*,
        c.name as class_name, c.section as class_section,
        sch.name as school_name
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN schools sch ON s.school_id = sch.id
      WHERE s.school_id = ? AND s.status = 'approved'
      ORDER BY c.name, c.section, s.roll_no`,
      [schoolId]
    );

    // Flatten student data and resolve mappings
    const flattenedStudents = [];
    const missingFields = [];

    students.forEach(student => {
      // Parse extra_fields
      let extraFields = {};
      if (student.extra_fields) {
        try {
          extraFields = typeof student.extra_fields === 'string' 
            ? JSON.parse(student.extra_fields) 
            : student.extra_fields;
        } catch (e) {
          console.error('Error parsing extra_fields:', e);
          extraFields = {};
        }
      }

      // Parse submitted_data
      let submittedData = {};
      if (student.submitted_data) {
        try {
          submittedData = typeof student.submitted_data === 'string' 
            ? JSON.parse(student.submitted_data) 
            : student.submitted_data;
        } catch (e) {
          submittedData = {};
        }
      }

      // Flatten student data - include all fields at root level
      const flatData = {
        id: student.id,
        name: student.name,
        roll_no: student.roll_no,
        admission_number: student.admission_number || student.roll_no,
        rollNo: student.roll_no,
        admissionNumber: student.admission_number || student.roll_no,
        date_of_birth: student.date_of_birth,
        dateOfBirth: student.date_of_birth,
        gender: student.gender,
        blood_group: student.blood_group,
        bloodGroup: student.blood_group,
        photo_url: student.photo_url,
        photoUrl: student.photo_url,
        class_name: student.class_name,
        section: student.class_section,
        class: student.class_name ? `${student.class_name}${student.class_section ? '-' + student.class_section : ''}`.trim() : '',
        school_name: student.school_name,
        schoolName: student.school_name,
        parent_name: student.parent_name,
        parent_phone: student.parent_phone,
        parent_email: student.parent_email,
        address: student.address,
        // Add extra_fields with dot notation support
        ...Object.keys(extraFields).reduce((acc, key) => {
          acc[`extra_fields.${key}`] = extraFields[key];
          return acc;
        }, {}),
        // Also include direct access
        extra_fields: extraFields,
        // Add submitted_data fields
        ...submittedData
      };

      // Resolve field mappings
      const resolvedData = {};
      const studentMissingFields = [];

      // For each element, resolve its templateField via fieldMappings -> student path
      (layout.elements || []).forEach((el) => {
        const templateField = el.templateField;
        if (!templateField) return;

        const mappingPath = fieldMappings[templateField] || templateField; // fallback: allow direct student field
        const value = mappingPath.includes('.') ? getByPath(flatData, mappingPath) : flatData[mappingPath];

        // Always set a key (PDF must render empty string if missing)
        resolvedData[templateField] = (value === undefined || value === null) ? '' : value;
        if (resolvedData[templateField] === '') studentMissingFields.push(templateField);
      });

      if (studentMissingFields.length > 0) {
        missingFields.push({
          student_id: student.id,
          student_name: student.name,
          fields: studentMissingFields
        });
      }

      flattenedStudents.push({
        ...flatData,
        resolved_fields: resolvedData
      });
    });

    res.json({
      template_layout: layout,
      template_metadata: {
        id: template.id,
        name: template.name,
        card_width: template.card_width,
        card_height: template.card_height,
        orientation: template.orientation,
        sheet_size: template.sheet_size,
        background_image_url: template.background_image_url,
        layout_json_url: template.layout_json_url || null
      },
      students: flattenedStudents,
      missing_fields: missingFields
    });
  } catch (error) {
    console.error('Get students for ID cards error:', error);
    res.status(500).json({ error: 'Failed to fetch students for ID card generation' });
  }
});

// Get single student with template for preview
router.get('/preview/:studentId/:templateId', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { studentId, templateId } = req.params;

    // Get student data
    const [students] = await db.query(
      `SELECT 
        s.id, s.name, s.roll_no, s.date_of_birth, s.gender, 
        s.blood_group, s.photo_url, s.submitted_data,
        c.name as class_name, c.section as class_section,
        sch.name as school_name
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN schools sch ON s.school_id = sch.id
      WHERE s.id = ?`,
      [studentId]
    );

    if (students.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get template
    const [templates] = await db.query(
      `SELECT * FROM id_card_templates WHERE id = ?`,
      [templateId]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const s = students[0];
    const t = templates[0];

    // Parse data
    let submittedData = null;
    if (s.submitted_data) {
      try {
        submittedData = typeof s.submitted_data === 'string' 
          ? JSON.parse(s.submitted_data) 
          : s.submitted_data;
      } catch (e) {
        submittedData = null;
      }
    }

    const student = {
      id: s.id,
      name: s.name,
      rollNo: s.roll_no,
      admissionNumber: s.roll_no,
      dateOfBirth: s.date_of_birth,
      gender: s.gender,
      bloodGroup: s.blood_group,
      photoUrl: s.photo_url,
      className: s.class_name,
      section: s.class_section,
      class: s.class_name ? `${s.class_name}${s.class_section ? '-' + s.class_section : ''}`.trim() : '',
      schoolName: s.school_name,
      submittedData: submittedData,
      fatherName: submittedData?.fatherName || null,
      motherName: submittedData?.motherName || null,
      address: submittedData?.address || null,
    };

    const template = {
      id: t.id,
      schoolId: t.school_id,
      name: t.name,
      templateData: typeof t.template_data === 'string' 
        ? JSON.parse(t.template_data) 
        : t.template_data,
      backgroundImageUrl: t.background_image_url,
      cardWidth: t.card_width || 54,
      cardHeight: t.card_height || 86,
      orientation: t.orientation || 'portrait',
      sheetSize: t.sheet_size || 'A4',
    };

    res.json({ student, template });
  } catch (error) {
    console.error('Get preview data error:', error);
    res.status(500).json({ error: 'Failed to fetch preview data' });
  }
});

module.exports = router;

