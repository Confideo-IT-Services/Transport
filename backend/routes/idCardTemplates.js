const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');

// Get all templates for a school
router.get('/school/:schoolId', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { schoolId } = req.params;

    const [templates] = await db.query(
      `SELECT * FROM id_card_templates WHERE school_id = ? ORDER BY created_at DESC`,
      [schoolId]
    );

    // Parse template_data JSON
    const parsedTemplates = templates.map(t => ({
      id: t.id,
      schoolId: t.school_id,
      name: t.name,
      templateData: typeof t.template_data === 'string' 
        ? JSON.parse(t.template_data) 
        : t.template_data,
      layoutJsonUrl: t.layout_json_url,
      backgroundImageUrl: t.background_image_url,
      cardWidth: t.card_width || 54,
      cardHeight: t.card_height || 86,
      orientation: t.orientation || 'portrait',
      sheetSize: t.sheet_size || 'A4',
      isDefault: t.is_default,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    res.json(parsedTemplates);
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get single template
router.get('/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [templates] = await db.query(
      `SELECT * FROM id_card_templates WHERE id = ?`,
      [id]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const t = templates[0];
    const template = {
      id: t.id,
      schoolId: t.school_id,
      name: t.name,
      templateData: typeof t.template_data === 'string' 
        ? JSON.parse(t.template_data) 
        : t.template_data,
      layoutJsonUrl: t.layout_json_url,
      backgroundImageUrl: t.background_image_url,
      cardWidth: t.card_width || 54,
      cardHeight: t.card_height || 86,
      orientation: t.orientation || 'portrait',
      sheetSize: t.sheet_size || 'A4',
      isDefault: t.is_default,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    };

    res.json(template);
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Create new template
router.post('/', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const {
      schoolId,
      name,
      templateData,
      layoutJsonUrl, // Optional: S3 URL for layout JSON (preferred source for generation)
      backgroundImageUrl,
      cardWidth,
      cardHeight,
      orientation,
      sheetSize,
      isDefault
    } = req.body;

    if (!schoolId || !name) {
      return res.status(400).json({ error: 'Missing required fields: schoolId and name' });
    }

    const id = uuidv4();

    // Store template JSON exactly as received (no transformation)
    const finalTemplateData =
      templateData !== undefined
        ? (typeof templateData === 'string' ? JSON.parse(templateData) : templateData)
        : {};
    const templateDataJson = JSON.stringify(finalTemplateData);

    // Try inserting with layout_json_url (new schema), fallback if column doesn't exist
    try {
      await db.query(
        `INSERT INTO id_card_templates (
          id, school_id, name, template_data, layout_json_url, background_image_url,
          card_width, card_height, orientation, sheet_size, is_default
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          schoolId,
          name,
          templateDataJson,
          layoutJsonUrl || null,
          backgroundImageUrl || null,
          cardWidth || 54,
          cardHeight || 86,
          orientation || 'portrait',
          sheetSize || 'A4',
          isDefault || false
        ]
      );
    } catch (err) {
      if (err?.message && err.message.includes("Unknown column 'layout_json_url'")) {
        await db.query(
          `INSERT INTO id_card_templates (
            id, school_id, name, template_data, background_image_url,
            card_width, card_height, orientation, sheet_size, is_default
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            schoolId,
            name,
            templateDataJson,
            backgroundImageUrl || null,
            cardWidth || 54,
            cardHeight || 86,
            orientation || 'portrait',
            sheetSize || 'A4',
            isDefault || false
          ]
        );
      } else {
        throw err;
      }
    }

    res.status(201).json({
      id,
      message: 'Template created successfully'
    });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Update template
router.put('/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      templateData,
      layoutJsonUrl, // Optional: S3 URL for layout JSON (preferred source for generation)
      backgroundImageUrl,
      cardWidth,
      cardHeight,
      orientation,
      sheetSize,
      isDefault
    } = req.body;

    // Check if template exists and get current data
    const [existing] = await db.query(
      `SELECT * FROM id_card_templates WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const existingTemplate = existing[0];
    
    // Store template JSON exactly as received (no transformation)
    const finalTemplateData =
      templateData !== undefined
        ? (typeof templateData === 'string' ? JSON.parse(templateData) : templateData)
        : undefined;

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    
    if (templateData !== undefined) {
      updates.push('template_data = ?');
      values.push(JSON.stringify(finalTemplateData));
    }

    if (layoutJsonUrl !== undefined) {
      updates.push('layout_json_url = ?');
      values.push(layoutJsonUrl || null);
    }
    
    if (backgroundImageUrl !== undefined) {
      updates.push('background_image_url = ?');
      values.push(backgroundImageUrl);
    }
    if (cardWidth !== undefined) {
      updates.push('card_width = ?');
      values.push(cardWidth);
    }
    if (cardHeight !== undefined) {
      updates.push('card_height = ?');
      values.push(cardHeight);
    }
    if (orientation !== undefined) {
      updates.push('orientation = ?');
      values.push(orientation);
    }
    if (sheetSize !== undefined) {
      updates.push('sheet_size = ?');
      values.push(sheetSize);
    }
    if (isDefault !== undefined) {
      updates.push('is_default = ?');
      values.push(isDefault);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    try {
      await db.query(
        `UPDATE id_card_templates SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    } catch (err) {
      // Backward-compatible fallback if DB schema doesn't have layout_json_url yet
      if (err?.message && err.message.includes("Unknown column 'layout_json_url'")) {
        const filtered = [];
        const filteredValues = [];
        // rebuild updates/values without layout_json_url in the same order
        for (let i = 0, v = 0; i < updates.length; i++) {
          const u = updates[i];
          if (u.startsWith('layout_json_url')) {
            v += 1;
            continue;
          }
          filtered.push(u);
          // for each update that uses a placeholder, push its corresponding value
          if (u.includes('?')) {
            filteredValues.push(values[v]);
            v += 1;
          }
        }
        // last value is id
        filteredValues.push(values[values.length - 1]);
        await db.query(
          `UPDATE id_card_templates SET ${filtered.join(', ')} WHERE id = ?`,
          filteredValues
        );
      } else {
        throw err;
      }
    }

    res.json({ message: 'Template updated successfully' });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Delete template
router.delete('/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      `DELETE FROM id_card_templates WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

module.exports = router;

