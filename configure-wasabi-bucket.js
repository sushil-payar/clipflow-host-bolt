// Script to configure Wasabi bucket for public access
// Run this with: node configure-wasabi-bucket.js

import { S3Client, PutBucketPolicyCommand, GetBucketPolicyCommand } from '@aws-sdk/client-s3';

const WASABI_CONFIG = {
  accessKeyId: '88VMNCC91ULSE25D4924',
  secretAccessKey: 'XqIOyTJGOVPKZMHNiGz6tP4FcpMD76vYYU4kZbFB',
  region: 'us-central-1',
  endpoint: 'https://s3.us-central-1.wasabisys.com',
  bucket: 'clipflow-videos'
};

const s3Client = new S3Client({
  region: WASABI_CONFIG.region,
  endpoint: WASABI_CONFIG.endpoint,
  credentials: {
    accessKeyId: WASABI_CONFIG.accessKeyId,
    secretAccessKey: WASABI_CONFIG.secretAccessKey,
  },
  forcePathStyle: true,
});

// Bucket policy to allow public read access
const bucketPolicy = {
  Version: '2012-10-17',
  Statement: [
    {
      Sid: 'PublicReadGetObject',
      Effect: 'Allow',
      Principal: '*',
      Action: 's3:GetObject',
      Resource: `arn:aws:s3:::${WASABI_CONFIG.bucket}/*`
    },
    {
      Sid: 'PublicReadGetObjectHead',
      Effect: 'Allow',
      Principal: '*',
      Action: 's3:GetObject',
      Resource: `arn:aws:s3:::${WASABI_CONFIG.bucket}/*`
    }
  ]
};

async function configureBucket() {
  try {
    console.log('Configuring Wasabi bucket for public access...');
    
    // Apply the bucket policy
    const putPolicyCommand = new PutBucketPolicyCommand({
      Bucket: WASABI_CONFIG.bucket,
      Policy: JSON.stringify(bucketPolicy)
    });
    
    await s3Client.send(putPolicyCommand);
    console.log('✅ Bucket policy applied successfully!');
    console.log('✅ Videos should now be publicly accessible');
    
  } catch (error) {
    console.error('❌ Error configuring bucket:', error);
    
    if (error.name === 'NoSuchBucket') {
      console.log('💡 The bucket does not exist. Creating it first...');
      // You'll need to create the bucket manually in Wasabi console
      console.log('Please create the bucket "clipflow-videos" in your Wasabi console first.');
    }
  }
}

configureBucket();
