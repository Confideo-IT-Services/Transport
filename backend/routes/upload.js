const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, BUCKET_NAME } = require('../config/s3');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Configure multer for memory storage
const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

const uploadJson = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB limit for JSON
  fileFilter: (req, file, cb) => {
    const isJsonFile =
      file.mimetype === 'application/json' ||
      file.mimetype === 'text/json' ||
      file.originalname.toLowerCase().endsWith('.json');
    if (isJsonFile) {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'), false);
    }
  },
});

// Upload student photo to S3
router.post('/photo', uploadImages.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!BUCKET_NAME) {
      return res.status(500).json({ error: 'S3 bucket not configured' });
    }

    console.log('📤 Processing photo upload:', {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Convert image to PNG format and resize/optimize
    const processedImage = await sharp(req.file.buffer)
      .resize(800, 800, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .png({ quality: 90 })
      .toBuffer();

    // Generate unique filename - store in media/photos/ folder
    const fileName = `media/photos/${uuidv4()}.png`;
    const contentType = 'image/png';
    const region = process.env.AWS_REGION || 'us-east-1';

    // Upload to S3 - try with ACL first, fallback without if ACL is disabled
    let command;
    try {
      command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: processedImage,
        ContentType: contentType,
        ACL: 'public-read', // Make publicly accessible
      });
      await s3Client.send(command);
    } catch (aclError) {
      // If ACL fails (bucket might have ACL disabled), try without ACL
      if (aclError.name === 'AccessControlListNotSupported' || aclError.code === 'NotImplemented') {
        console.log('⚠️  ACL not supported, uploading without ACL');
        command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileName,
          Body: processedImage,
          ContentType: contentType,
        });
        await s3Client.send(command);
      } else {
        throw aclError;
      }
    }

    // Construct S3 URL (handle different region formats)
    let photoUrl;
    if (region === 'us-east-1') {
      // us-east-1 uses different URL format
      photoUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${fileName}`;
    } else {
      photoUrl = `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${fileName}`;
    }

    console.log('✅ Photo uploaded to S3:', photoUrl);

    res.json({
      success: true,
      photoUrl: photoUrl,
      fileName: fileName,
    });
  } catch (error) {
    console.error('❌ Photo upload error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      name: error.name
    });
    res.status(500).json({ 
      error: 'Failed to upload photo',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Upload ID template background to S3
router.post('/id-template', uploadImages.single('template'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!BUCKET_NAME) {
      return res.status(500).json({ error: 'S3 bucket not configured' });
    }

    console.log('📤 Processing ID template upload:', {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Process image - keep original format but optimize
    let processedImage;
    let contentType;
    let fileExtension;

    // Determine format based on original file
    if (req.file.mimetype === 'image/png') {
      processedImage = await sharp(req.file.buffer)
        .png({ quality: 95 })
        .toBuffer();
      contentType = 'image/png';
      fileExtension = 'png';
    } else if (req.file.mimetype === 'image/jpeg' || req.file.mimetype === 'image/jpg') {
      processedImage = await sharp(req.file.buffer)
        .jpeg({ quality: 95 })
        .toBuffer();
      contentType = 'image/jpeg';
      fileExtension = 'jpg';
    } else {
      // Convert to PNG for other formats
      processedImage = await sharp(req.file.buffer)
        .png({ quality: 95 })
        .toBuffer();
      contentType = 'image/png';
      fileExtension = 'png';
    }

    // Generate unique filename - store in media/idtemplates/ folder
    const fileName = `media/idtemplates/${uuidv4()}.${fileExtension}`;
    const region = process.env.AWS_REGION || 'us-east-1';

    // Upload to S3 - try with ACL first, fallback without if ACL is disabled
    let command;
    try {
      command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: processedImage,
        ContentType: contentType,
        ACL: 'public-read', // Make publicly accessible
      });
      await s3Client.send(command);
    } catch (aclError) {
      // If ACL fails (bucket might have ACL disabled), try without ACL
      if (aclError.name === 'AccessControlListNotSupported' || aclError.code === 'NotImplemented') {
        console.log('⚠️  ACL not supported, uploading without ACL');
        command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileName,
          Body: processedImage,
          ContentType: contentType,
        });
        await s3Client.send(command);
      } else {
        throw aclError;
      }
    }

    // Construct S3 URL (handle different region formats)
    let templateUrl;
    if (region === 'us-east-1') {
      templateUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${fileName}`;
    } else {
      templateUrl = `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${fileName}`;
    }

    console.log('✅ ID template uploaded to S3:', templateUrl);

    res.json({
      success: true,
      templateUrl: templateUrl,
      fileName: fileName,
    });
  } catch (error) {
    console.error('❌ ID template upload error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      name: error.name
    });
    res.status(500).json({ 
      error: 'Failed to upload ID template',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Upload ID template layout JSON to S3
router.post('/id-layout', uploadJson.single('layout'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!BUCKET_NAME) {
      return res.status(500).json({ error: 'S3 bucket not configured' });
    }

    // Parse and validate JSON
    let layoutData;
    try {
      layoutData = JSON.parse(req.file.buffer.toString('utf-8'));
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON file: ' + e.message });
    }

    // Generate unique filename - store in media/idtemplates/layouts/ folder
    const fileName = `media/idtemplates/layouts/${uuidv4()}.json`;
    const region = process.env.AWS_REGION || 'us-east-1';

    // Upload to S3 - try with ACL first, fallback without if ACL is disabled
    let command;
    try {
      command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: 'application/json',
        ACL: 'public-read',
      });
      await s3Client.send(command);
    } catch (aclError) {
      // If ACL fails (bucket might have ACL disabled), try without ACL
      if (aclError.name === 'AccessControlListNotSupported' || aclError.code === 'NotImplemented') {
        console.log('⚠️  ACL not supported, uploading without ACL');
        command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileName,
          Body: req.file.buffer,
          ContentType: 'application/json',
        });
        await s3Client.send(command);
      } else {
        throw aclError;
      }
    }

    // Construct S3 URL (handle different region formats)
    let layoutUrl;
    if (region === 'us-east-1') {
      layoutUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${fileName}`;
    } else {
      layoutUrl = `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${fileName}`;
    }

    console.log('✅ ID layout uploaded to S3:', layoutUrl);

    res.json({
      success: true,
      layoutUrl: layoutUrl,
      fileName: fileName,
    });
  } catch (error) {
    console.error('❌ Layout upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload layout',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

