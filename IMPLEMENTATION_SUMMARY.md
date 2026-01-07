# ID Card System - Implementation Summary

## Overview
Complete refactor of the ID card template builder and generation system to ensure **preview ⇄ saved JSON ⇄ generated PDF** are perfectly consistent.

## Problems Solved

### 1. ❌ Preview Shows Only Background (FIXED ✅)
**Root Cause**: Text elements rendered at `fontSize * 0.25` making them invisible
**Solution**: Removed incorrect scaling, now uses proper mm→px conversion

### 2. ❌ PDF Doesn't Match Preview (FIXED ✅)
**Root Cause**: Different rendering logic for preview vs PDF
**Solution**: Single `IDCardRenderer` component used for both, captured via `html2canvas`

### 3. ❌ Field Mappings Not Applied (FIXED ✅)
**Root Cause**: Inconsistent mapping resolution between frontend and backend
**Solution**: Backend resolves mappings and returns `resolved_fields`, frontend uses shared resolver

### 4. ❌ Layout JSON Handling Inconsistent (FIXED ✅)
**Root Cause**: Multiple sources of truth, transformations during save/load
**Solution**: Single `IDCardLayout` schema, stored as-is in DB, normalized on load

### 5. ❌ Template State Scattered (FIXED ✅)
**Root Cause**: Separate states for elements, mappings, layout URL
**Solution**: Single template state object, mappings edited per-element

## Architecture

### Schema (Single Source of Truth)
```typescript
interface IDCardLayout {
  id?: string;
  name: string;
  width_mm: number;
  height_mm: number;
  orientation: 'portrait' | 'landscape';
  backgroundImageUrl?: string;
  elements: IDCardElement[];
  fieldMappings: Record<string, string>;
}

interface IDCardElement {
  id: string;
  type: 'text' | 'photo' | 'logo';
  label: string;
  templateField?: string;  // Key for mapping
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  align?: 'left' | 'center' | 'right';
}
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Template Builder (Super Admin)                          │
│    - Upload background image → S3                           │
│    - Add elements (text/photo/logo)                         │
│    - Set element.templateField (e.g., "name")              │
│    - Map to student field (e.g., "name" → "Student Name")  │
│    - Save → DB stores complete layout JSON                  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Backend Storage                                          │
│    - template_data (JSON): Complete layout                  │
│    - layout_json_url (VARCHAR): Optional S3 URL            │
│    - Backward compatible with existing templates            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. ID Card Generation Request                               │
│    GET /api/id-cards/students/:schoolId?templateId=X        │
│    Backend:                                                  │
│    - Fetches template layout                                │
│    - Fetches approved students                              │
│    - Flattens student data (core + extra_fields)           │
│    - Resolves mappings:                                     │
│      element.templateField → layout.fieldMappings[key]     │
│                           → student[path]                   │
│    - Returns: { template_layout, students, resolved_fields }│
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Frontend Rendering                                       │
│    <IDCardRenderer                                          │
│      layout={normalizedLayout}                              │
│      student={studentData}                                  │
│      renderHeightPx={400} />                                │
│                                                              │
│    - Preview: Renders at 400px height                       │
│    - PDF: Renders at actual mm→px, captures via html2canvas│
│    - Same component = identical output                      │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

### Backend
```
backend/
├── sql/
│   └── schema.sql                    # Updated with all columns
├── routes/
│   ├── upload.js                     # Separate JSON/image uploaders
│   ├── idCardTemplates.js            # CRUD with layout_json_url support
│   ├── idCardGeneration.js           # Resolves mappings, returns normalized data
│   └── students.js                   # Handles extra_fields updates
└── config/
    └── s3.js                         # S3 client configuration
```

### Frontend
```
src/
├── lib/
│   ├── idCardLayout.ts               # Schema + normalization + resolution
│   └── api.ts                        # API client with updated types
├── components/
│   └── idcards/
│       └── IDCardRenderer.tsx        # Single renderer for preview + PDF
└── pages/
    └── superadmin/
        ├── IDCardTemplate.tsx        # Builder with per-element mapping
        └── IDCardGeneration.tsx      # Generation with PDF export
```

## Key Features

### 1. Per-Element Field Mapping
- Each text element has:
  - **Template Field Key**: Internal identifier (e.g., `blood_group`)
  - **Map To Student Field**: Path to data (e.g., `extra_fields.blood_group`)
- Mappings stored in `layout.fieldMappings`
- Single source of truth (no separate mapping UI)

### 2. Extra Fields Support
- `students.extra_fields` JSON column
- Editable by School Admins only
- Supports dot notation: `extra_fields.house`, `extra_fields.id_valid_upto`
- Backend flattens for easy access

### 3. Consistent Rendering
- Preview uses `IDCardRenderer` at 400px height
- PDF renders same component at actual size, captures with `html2canvas`
- Fonts scale correctly based on mm→px conversion
- Background, elements, colors all identical

### 4. Backward Compatibility
- Normalizes old template formats on load
- Handles missing DB columns gracefully
- Supports both camelCase and snake_case field names
- Falls back to direct field access if mappings missing

## Database Schema Updates

### Students Table
```sql
ALTER TABLE students 
ADD COLUMN extra_fields JSON DEFAULT '{}',
ADD COLUMN admission_number VARCHAR(50),
ADD COLUMN registration_code VARCHAR(50),
ADD COLUMN submitted_data JSON,
ADD INDEX idx_admission_number (admission_number);
```

### ID Card Templates Table
```sql
ALTER TABLE id_card_templates 
ADD COLUMN layout_json_url VARCHAR(500);
```

## Testing Checklist

- [x] Template builder preview shows all elements
- [x] Font sizes render correctly (not tiny)
- [x] Background image displays
- [x] Elements can be clicked and edited
- [x] Field mappings save and load
- [x] PDF matches preview exactly
- [x] Extra fields save (admin only)
- [x] Extra fields appear in ID cards
- [x] Multiple students can be selected
- [x] Layout calculations correct for A4/13×19
- [x] Role-based access control works
- [x] Backward compatible with existing templates

## Performance Considerations

- PDF generation uses `html2canvas` (client-side)
- Large batches (100+ students) may take time
- Consider server-side PDF generation for production scale
- S3 URLs cached in DB to avoid repeated fetches
- Field resolution happens once per student on backend

## Security

- ✅ Role-based access: Super Admin (templates), School Admin (extra fields)
- ✅ Teachers cannot edit extra_fields (403 error)
- ✅ S3 uploads require authentication
- ✅ SQL injection prevented (parameterized queries)
- ✅ XSS prevented (React escapes by default)

## Future Enhancements

1. **Drag-and-drop positioning** in template builder
2. **Real-time preview** with sample student data
3. **Template marketplace** for sharing designs
4. **Bulk import** of extra fields via CSV
5. **Server-side PDF generation** for large batches
6. **QR code support** for digital ID verification
7. **Multi-language support** for international schools

## Support

For issues or questions:
1. Check `TEST_ID_CARD_SYSTEM.md` for testing guide
2. Check `MIGRATION_GUIDE.md` for DB setup
3. Review browser console for frontend errors
4. Check backend logs for API errors
5. Verify all DB columns exist with `DESCRIBE students;`

