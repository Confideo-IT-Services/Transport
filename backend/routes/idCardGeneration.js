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

  // Get elements and mappings (always normalize, even if structure exists)
  const elements = rawLayout.elements || [];
  const fieldMappings = rawLayout.fieldMappings || rawLayout.field_mappings || {};

  // ALWAYS normalize elements to ensure templateField is set correctly
  const normalizedElements = elements.map((el) => {
    const elementType = (el.type === 'textbox' ? 'text' : el.type);
    // Ensure photo elements always have templateField = "photo"
    let templateField = el.templateField || el.template_field || el.field;
    if (elementType === 'photo' && !templateField) {
      templateField = 'photo';
    }
    return {
      id: el.id,
      type: elementType,
      label: el.label,
      templateField: templateField,
      x_percent: el.x_percent ?? el.x ?? 0,
      y_percent: el.y_percent ?? el.y ?? 0,
      width_percent: el.width_percent ?? el.width ?? 0,
      height_percent: el.height_percent ?? el.height ?? 0,
      fontSize: el.fontSize,
      fontFamily: el.fontFamily,
      fontWeight: el.fontWeight,
      color: el.color,
      align: el.align || el.textAlign,
    };
  });

  return {
    id: templateRow?.id || rawLayout.id,
    name: templateRow?.name || rawLayout.name || 'Template',
    width_mm: templateRow?.card_width || rawLayout.width_mm || 54,
    height_mm: templateRow?.card_height || rawLayout.height_mm || 86,
    orientation: templateRow?.orientation || rawLayout.orientation || 'portrait',
    backgroundImageUrl: templateRow?.background_image_url || rawLayout.backgroundImageUrl,
    elements: normalizedElements,
    fieldMappings: fieldMappings,
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

      // Normalize class and section
      const classValue = student.class_name || '';
      const sectionValue = student.class_section || '';
      const classSection = classValue ? `${classValue}${sectionValue ? '-' + sectionValue : ''}`.trim() : '';

      // Flatten student data - include all fields at root level with normalized names
      const flatData = {
        id: student.id,
        name: student.name || '',
        roll_no: student.roll_no || '',
        admission_number: student.admission_number || student.roll_no || '',
        rollNo: student.roll_no || '',
        admissionNumber: student.admission_number || student.roll_no || '',
        date_of_birth: student.date_of_birth || '',
        dateOfBirth: student.date_of_birth || '',
        gender: student.gender || '',
        blood_group: student.blood_group || '',
        bloodGroup: student.blood_group || '',
        photo_url: student.photo_url || '',
        photoUrl: student.photo_url || '',
        photo: student.photo_url || '', // Normalized photo field
        class_name: classValue,
        section: sectionValue,
        class: classSection,
        className: classValue,
        school_name: student.school_name || '',
        schoolName: student.school_name || '',
        parent_name: student.parent_name || '',
        parent_phone: student.parent_phone || '',
        parent_email: student.parent_email || '',
        address: student.address || '',
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

      // Resolve field mappings - ensure ALL template elements are included
      const resolvedData = {};
      const studentMissingFields = [];

      // For each element, resolve its templateField via fieldMappings -> student path
      (layout.elements || []).forEach((el) => {
        // Ensure photo elements have templateField
        const templateField = el.templateField || (el.type === 'photo' ? 'photo' : null);
        if (!templateField) return;

        const mappingPath = fieldMappings[templateField] || templateField; // fallback: allow direct student field
        const value = mappingPath.includes('.') ? getByPath(flatData, mappingPath) : flatData[mappingPath];

        // Debug logging for photo fields
        if (templateField === 'photo' || el.type === 'photo') {
          console.log(`[ID Card Generation] Photo field resolution for student ${student.id} (${student.name}):`, {
            templateField,
            mappingPath,
            value: value || '(empty/missing)',
            valueLength: value ? String(value).length : 0,
            availablePhotoFields: Object.keys(flatData).filter(k => k.toLowerCase().includes('photo')),
            fieldMappings: fieldMappings,
            elementType: el.type
          });
        }

        // Always set a key (PDF must render empty string if missing)
        resolvedData[templateField] = (value === undefined || value === null) ? '' : String(value || '');
        if (resolvedData[templateField] === '') studentMissingFields.push(templateField);
      });

      // Ensure common fields are always in resolved_fields, even if not in template
      const commonFields = {
        photo: flatData.photo,
        roll_no: flatData.roll_no,
        name: flatData.name,
        class: flatData.class,
        section: flatData.section
      };

      // Merge common fields into resolved_fields (don't overwrite if already set)
      Object.keys(commonFields).forEach(key => {
        if (!(key in resolvedData)) {
          resolvedData[key] = commonFields[key] || '';
        }
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
        s.*,
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

    // Parse template data
    let templateData = {};
    try {
      templateData = typeof t.template_data === 'string' 
        ? JSON.parse(t.template_data) 
        : t.template_data;
    } catch (e) {
      console.error('Error parsing template_data:', e);
      templateData = {};
    }

    // Fetch layout from S3 if available (same as main endpoint)
    let templateLayout = null;
    if (t.layout_json_url) {
      try {
        const layoutResponse = await fetch(t.layout_json_url);
        if (layoutResponse.ok) {
          templateLayout = await layoutResponse.json();
        }
      } catch (error) {
        console.error('Error fetching layout from S3:', error);
      }
    }

    // Normalize layout (same as main endpoint)
    const layout = normalizeLayout(templateLayout || templateData, t);
    const fieldMappings = layout.fieldMappings || {};

    // Parse student extra_fields
    let extraFields = {};
    if (s.extra_fields) {
      try {
        extraFields = typeof s.extra_fields === 'string' 
          ? JSON.parse(s.extra_fields) 
          : s.extra_fields;
      } catch (e) {
        console.error('Error parsing extra_fields:', e);
        extraFields = {};
      }
    }

    // Parse submitted_data
    let submittedData = {};
    if (s.submitted_data) {
      try {
        submittedData = typeof s.submitted_data === 'string' 
          ? JSON.parse(s.submitted_data) 
          : s.submitted_data;
      } catch (e) {
        submittedData = {};
      }
    }

    // Normalize class and section
    const classValue = s.class_name || '';
    const sectionValue = s.class_section || '';
    const classSection = classValue ? `${classValue}${sectionValue ? '-' + sectionValue : ''}`.trim() : '';

    // Flatten student data (same as main endpoint)
    const flatData = {
      id: s.id,
      name: s.name || '',
      roll_no: s.roll_no || '',
      admission_number: s.admission_number || s.roll_no || '',
      rollNo: s.roll_no || '',
      admissionNumber: s.admission_number || s.roll_no || '',
      date_of_birth: s.date_of_birth || '',
      dateOfBirth: s.date_of_birth || '',
      gender: s.gender || '',
      blood_group: s.blood_group || '',
      bloodGroup: s.blood_group || '',
      photo_url: s.photo_url || '',
      photoUrl: s.photo_url || '',
      photo: s.photo_url || '', // Normalized photo field
      class_name: classValue,
      section: sectionValue,
      class: classSection,
      className: classValue,
      school_name: s.school_name || '',
      schoolName: s.school_name || '',
      parent_name: s.parent_name || '',
      parent_phone: s.parent_phone || '',
      parent_email: s.parent_email || '',
      address: s.address || '',
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

    // Resolve field mappings (same as main endpoint)
    const resolvedData = {};
    (layout.elements || []).forEach((el) => {
      const templateField = el.templateField || (el.type === 'photo' ? 'photo' : null);
      if (!templateField) return;

      const mappingPath = fieldMappings[templateField] || templateField;
      const value = mappingPath.includes('.') ? getByPath(flatData, mappingPath) : flatData[mappingPath];
      resolvedData[templateField] = (value === undefined || value === null) ? '' : String(value || '');
    });

    // Ensure common fields are always present
    const commonFields = {
      photo: flatData.photo,
      roll_no: flatData.roll_no,
      name: flatData.name,
      class: flatData.class,
      section: flatData.section
    };
    Object.keys(commonFields).forEach(key => {
      if (!(key in resolvedData)) {
        resolvedData[key] = commonFields[key] || '';
      }
    });

    const student = {
      ...flatData,
      resolved_fields: resolvedData
    };

    const template = {
      id: t.id,
      schoolId: t.school_id,
      name: t.name,
      templateData: layout, // Return normalized layout
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

