# Manual Steps Required - ID Card System

## ✅ Code Changes Applied Automatically

I've updated the following files:
1. `src/pages/superadmin/IDCardTemplate.tsx` - Fixed template data preservation
2. `src/pages/superadmin/IDCardGeneration.tsx` - Added CORS handling for images
3. Added console logging for debugging

## ⚠️ Manual Steps You MUST Do

### 1. Configure S3 Bucket CORS (CRITICAL for PDF images)

Your S3 bucket needs CORS configuration to allow html2canvas to capture images.

**Steps:**
1. Go to AWS Console → S3
2. Select your bucket (the one storing student photos and templates)
3. Go to **Permissions** tab
4. Scroll to **Cross-origin resource sharing (CORS)**
5. Click **Edit**
6. Paste this configuration:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "HEAD"
        ],
        "AllowedOrigins": [
            "*"
        ],
        "ExposeHeaders": [
            "ETag",
            "Content-Length",
            "Content-Type"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

7. Click **Save changes**

**Why this is needed:** 
- html2canvas cannot capture images from different origins without CORS headers
- Without this, background images and student photos won't appear in PDF
- This is a security feature of browsers

### 2. Test the Template Builder

After deploying the code changes:

1. **Open Template Builder** (`/superadmin/id-templates`)
2. **Open Browser Console** (F12 → Console tab)
3. **Create a new template:**
   - Select school
   - Click "Create Template"
   - Upload background image
   - Add elements (text, photo, logo)
4. **Check console logs** - you should see:
   ```
   Saving template with data: { backgroundImageUrl: "...", elements: X, ... }
   ```
5. **Verify preview shows:**
   - Background image ✓
   - All elements you added ✓
   - Elements are clickable ✓

### 3. Test ID Card Generation

1. **Open ID Card Generation** (`/superadmin/id-cards`)
2. **Open Browser Console** (F12 → Console tab)
3. **Select school and template**
4. **Click "Load Submissions"**
5. **Check console logs** - you should see:
   ```
   Loaded template layout: { backgroundImageUrl: "...", elements: X, ... }
   ```
6. **Preview a student's card:**
   - Click Actions → Preview ID
   - Should show background + student photo + text fields
7. **Generate PDF:**
   - Select students
   - Click "Generate ID Cards"
   - Wait for download
   - Open PDF and verify images appear

### 4. If Images Still Don't Show in PDF

**Check these in order:**

#### A. Verify S3 CORS is Applied
```bash
# Test with curl (replace with your S3 URL)
curl -I -H "Origin: http://localhost:8080" \
  -H "Access-Control-Request-Method: GET" \
  https://your-bucket.s3.amazonaws.com/media/photos/test.png
```

Look for these headers in response:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, HEAD`

#### B. Check Image URLs in Console
In browser console, when viewing preview:
```javascript
// Check what URLs are being used
console.log(document.querySelectorAll('img'));
```

All image `src` attributes should be full S3 URLs like:
- `https://your-bucket.s3.amazonaws.com/media/photos/...`
- `https://your-bucket.s3.amazonaws.com/media/idtemplates/...`

#### C. Check Network Tab
1. Open DevTools → Network tab
2. Filter by "Img"
3. Generate PDF
4. Look for failed image requests (red)
5. Click on failed requests to see error details

### 5. Common Issues & Solutions

#### Issue: "Failed to load image" in console
**Solution:** S3 CORS not configured correctly. Re-check step 1.

#### Issue: Images load in preview but not in PDF
**Solution:** 
- Add `crossOrigin="anonymous"` to image tags
- Or update html2canvas options (already done in code)

#### Issue: Background image shows but student photos don't
**Solution:** 
- Check student has `photo_url` field populated
- Check photo mapping: Template Field Key → `photo_url`
- Verify photo exists in S3

#### Issue: Elements don't appear in preview
**Solution:**
- Check browser console for errors
- Verify elements array has data: `editingTemplate.templateData.elements`
- Check element positions are valid (x, y, width, height > 0)

### 6. Verify Database

Check that templates are saving correctly:

```sql
-- Check template data
SELECT 
    id, 
    name, 
    background_image_url,
    JSON_LENGTH(template_data, '$.elements') as element_count,
    template_data
FROM id_card_templates 
WHERE school_id = 'YOUR_SCHOOL_ID'
ORDER BY created_at DESC 
LIMIT 1;
```

Expected output:
- `background_image_url`: Should have S3 URL
- `element_count`: Should match number of elements you added
- `template_data`: Should contain `elements` array and `fieldMappings` object

### 7. Debug Checklist

Before reporting issues, check:

- [ ] S3 CORS configured correctly
- [ ] Browser console shows no errors
- [ ] Network tab shows images loading (200 status)
- [ ] Template has `backgroundImageUrl` in database
- [ ] Template has elements in `template_data.elements`
- [ ] Student has `photo_url` populated
- [ ] Field mappings are set correctly
- [ ] Using latest code (refresh browser cache: Ctrl+Shift+R)

### 8. Contact Support

If issues persist after following all steps:

1. **Collect this information:**
   - Browser console errors (screenshot)
   - Network tab showing failed requests (screenshot)
   - Database query results from step 6
   - S3 CORS configuration (screenshot)

2. **Provide this context:**
   - Which step fails (preview or PDF)?
   - Does background show? Do elements show?
   - Do student photos show in preview?
   - Any error messages?

## Summary

**Automatic fixes applied:**
- ✅ Template data preservation in state updates
- ✅ Console logging for debugging
- ✅ html2canvas CORS options

**You must do manually:**
- ⚠️ Configure S3 CORS (critical!)
- ⚠️ Test and verify
- ⚠️ Debug using console logs

**Expected result after all steps:**
- Preview shows background + elements
- PDF shows background + student photos + text
- Everything matches perfectly

