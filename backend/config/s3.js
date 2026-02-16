const { S3Client } = require('@aws-sdk/client-s3');

let s3Client = null;
let lastConfigCheck = null;
const CONFIG_CHECK_INTERVAL = 60000; // Check every 60 seconds

// Runtime function to check if credentials are valid
function hasValidCredentials() {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    String(process.env.AWS_ACCESS_KEY_ID).trim() !== '' &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    String(process.env.AWS_SECRET_ACCESS_KEY).trim() !== ''
  );
}

// Runtime function to get bucket name
function getBucketName() {
  return process.env.AWS_S3_BUCKET_NAME ? process.env.AWS_S3_BUCKET_NAME.trim() : null;
}

// Get or create S3 client (lazy initialization)
function getS3Client() {
  const now = Date.now();
  
  // Re-check configuration periodically or if client doesn't exist
  if (!s3Client || !lastConfigCheck || (now - lastConfigCheck) > CONFIG_CHECK_INTERVAL) {
    if (hasValidCredentials()) {
      try {
        s3Client = new S3Client({
          region: process.env.AWS_REGION || 'ap-south-1',
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
          },
        });
        lastConfigCheck = now;
        console.log('✅ S3 Client initialized/reinitialized');
      } catch (error) {
        console.error('❌ Failed to create S3 client:', error);
        s3Client = null;
      }
    } else {
      s3Client = null;
      lastConfigCheck = now;
    }
  }
  
  return s3Client;
}

// Runtime function to check if S3 is configured
function isS3Configured() {
  const bucketName = getBucketName();
  const client = getS3Client();
  return !!(bucketName && hasValidCredentials() && client);
}

// Export functions and getters for backward compatibility
module.exports = { 
  get s3Client() { return getS3Client(); },
  get BUCKET_NAME() { return getBucketName(); },
  isS3Configured,
  hasValidCredentials,
  getBucketName
};
