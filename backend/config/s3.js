const { S3Client } = require('@aws-sdk/client-s3');

// Check if S3 is properly configured
const hasValidCredentials =
  process.env.AWS_ACCESS_KEY_ID &&
  String(process.env.AWS_ACCESS_KEY_ID).trim() !== '' &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  String(process.env.AWS_SECRET_ACCESS_KEY).trim() !== '';

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME ? process.env.AWS_S3_BUCKET_NAME.trim() : null;

// Only create S3Client if credentials are valid
const s3Client = hasValidCredentials
  ? new S3Client({
      region: process.env.AWS_REGION || 'ap-south-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
      },
    })
  : null;

function isS3Configured() {
  return !!(BUCKET_NAME && hasValidCredentials && s3Client);
}

module.exports = { s3Client, BUCKET_NAME, isS3Configured };