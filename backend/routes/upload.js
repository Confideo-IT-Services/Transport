const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, BUCKET_NAME } = require('../config/s3');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
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

// Upload student photo to S3
router.post('/photo', upload.single('photo'), async (req, res) => {
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

module.exports = router;

