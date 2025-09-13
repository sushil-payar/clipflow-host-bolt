// Test presigned URL with an existing video
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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

async function testExistingVideo() {
  // Use the first existing video
  const key = '438811cc-145c-4275-8079-7e36fae958dc/1757554564037-ztitds.mp4';
  
  try {
    console.log('Testing presigned URL with existing video...');
    console.log('Key:', key);
    
    const command = new GetObjectCommand({
      Bucket: WASABI_CONFIG.bucket,
      Key: key,
    });
    
    // Generate presigned URL valid for 8 hours
    const expiresIn = 8 * 60 * 60; // 8 hours in seconds
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    
    console.log('Generated presigned URL:', presignedUrl);
    
    // Test the presigned URL
    console.log('\nTesting presigned URL...');
    const response = await fetch(presignedUrl, { method: 'HEAD' });
    console.log('Status:', response.status, response.statusText);
    
    if (response.ok) {
      console.log('✅ Presigned URL works!');
      console.log('Content-Type:', response.headers.get('content-type'));
      console.log('Content-Length:', response.headers.get('content-length'));
    } else {
      const errorText = await response.text();
      console.log('❌ Error response:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testExistingVideo();
