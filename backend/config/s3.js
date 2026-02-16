const { S3Client } = require('@aws-sdk/client-s3');

const hasValidCredentials =
  process.env.AWS_ACCESS_KEY_ID &&
  String(process.env.AWS_ACCESS_KEY_ID).trim() !== '' &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  String(process.env.AWS_SECRET_ACCESS_KEY).trim() !== '';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(hasValidCredentials && {
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
    },
  }),
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME ? process.env.AWS_S3_BUCKET_NAME.trim() : null;

function isS3Configured() {
  return !!(BUCKET_NAME && hasValidCredentials);
}

module.exports = { s3Client, BUCKET_NAME, isS3Configured };