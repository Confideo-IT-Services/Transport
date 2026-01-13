# ID Card System Testing Guide

## Prerequisites
1. Database updated with latest schema
2. Backend server running
3. Frontend dev server running
4. Logged in as Super Admin

## Test Flow

### 1. Template Builder (Super Admin)
**URL**: `/superadmin/id-templates`

#### Test Steps:
1. **Select School** → Choose a school from dropdown
2. **Click "Create Template"**
3. **Configure Template**:
   - Name: "Test ID Card"
   - Card Width: 54mm
   - Card Height: 86mm
   - Orientation: Portrait
   - Sheet Size: A4
4. **Upload Background**:
   - Click "Upload" under Background Image
   - Select an image file (PNG/JPG)
   - Verify image appears in preview
5. **Add Elements**:
   - Click "Add Text" → Should appear in preview
   - Click "Add Photo" → Should appear in preview
   - Click "Add Logo" → Should appear in preview
6. **Configure Text Element**:
   - Click on a text element in preview
   - Set "Template Field Key": `name`
   - Set "Map To Student Field": `Student Name`
   - Adjust font size, color, alignment
7. **Configure Photo Element**:
   - Click on photo element
   - Set "Template Field Key": `photo`
   - Set "Map To Student Field": `Student Photo URL`
8. **Add Extra Field**:
   - Add another text element
   - Set "Template Field Key": `blood_group`
   - Set "Map To Student Field": `Extra: Blood Group`
9. **Save Template** → Should see success message

**Expected Results**:
- ✅ Preview shows background image
- ✅ All elements visible in preview
- ✅ Elements can be clicked and edited
- ✅ Font sizes render correctly (not tiny)
- ✅ Template saves successfully

### 2. ID Card Generation (Super Admin)
**URL**: `/superadmin/id-cards`

#### Test Steps:
1. **Select School** → Choose same school
2. **Select Template** → Choose "Test ID Card"
3. **Click "Load Submissions"**
4. **Verify Student List**:
   - Students appear with photos
   - Admission numbers shown
   - Class information visible
5. **Preview Single Card**:
   - Click Actions → "Preview ID" for a student
   - Verify card shows:
     - Background image
     - Student name (from mapping)
     - Student photo (from mapping)
     - Blood group (from extra_fields if set)
6. **Generate PDF**:
   - Select multiple students (checkboxes)
   - Click "Generate ID Cards (X)"
   - Wait for PDF generation
   - PDF downloads automatically
7. **Verify PDF**:
   - Open downloaded PDF
   - Check cards match preview
   - Verify layout (9 cards on A4 portrait)
   - Verify all student data appears correctly

**Expected Results**:
- ✅ Students load with template data
- ✅ Preview shows complete card with all mapped fields
- ✅ PDF generates without errors
- ✅ PDF matches preview exactly
- ✅ All student data appears in correct positions
- ✅ Fonts are readable (not scaled incorrectly)

### 3. Student Management (School Admin)
**URL**: `/dashboard/students`

#### Test Steps:
1. **View Approved Students**
2. **Click Edit (gear icon)** on a student
3. **Scroll to "ID Card Information" section**
4. **Edit Extra Fields**:
   - Blood Group (ID Card): `A+`
   - House: `Red House`
   - ID Valid Until: `2025-12-31`
5. **Save Changes** → Success message
6. **Return to Super Admin → ID Card Generation**
7. **Preview the edited student's card**
8. **Verify** blood group and house appear if mapped

**Expected Results**:
- ✅ Extra fields section visible (admin only)
- ✅ Fields save successfully
- ✅ Values appear in ID card preview
- ✅ Teachers cannot edit extra fields (403 error if attempted)

## Common Issues & Solutions

### Issue: Preview shows only background, no text/photos
**Solution**: This was the original bug - now fixed. If you still see this:
- Check browser console for errors
- Verify `IDCardRenderer` is imported
- Check `templateField` mappings are set

### Issue: Text is too small to read
**Solution**: Font scaling fixed - fonts now render at correct size based on mm→px conversion

### Issue: PDF doesn't match preview
**Solution**: Both now use `IDCardRenderer` + `html2canvas` - should be identical

### Issue: Field mappings not working
**Solution**: 
- Ensure "Template Field Key" is set on element
- Ensure "Map To Student Field" is selected
- Check backend returns `resolved_fields` in response

### Issue: Extra fields not saving
**Solution**:
- Verify logged in as School Admin (not Teacher)
- Check `extra_fields` column exists in DB
- Check backend logs for errors

## API Endpoints to Test

```bash
# Get templates for a school
GET /api/id-templates/school/{schoolId}

# Get students with template data
GET /api/id-cards/students/{schoolId}?templateId={templateId}

# Upload layout JSON
POST /api/upload/id-layout
Content-Type: multipart/form-data
Body: { layout: <file.json> }

# Update student extra fields
PUT /api/students/{studentId}
Body: { extra_fields: { blood_group: "A+", house: "Red" } }
```

## Success Criteria
- [ ] Template builder preview shows all elements correctly
- [ ] PDF output matches preview exactly
- [ ] Field mappings resolve student data correctly
- [ ] Extra fields save and display in ID cards
- [ ] Multiple students can be selected and generated
- [ ] Layout calculations work for A4 and 13×19 sheets
- [ ] Role-based access control works (admin vs teacher)




