// Test presigned URL generation
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

async function testPresignedUrl() {
  const videoUrl = 'https://clipflow-videos.s3.us-central-1.wasabisys.com/438811cc-145c-4275-8079-7e36fae958dc/1757773256000-0vfqp4.mp4';
  
  try {
    // Extract the key from the video URL
    const url = new URL(videoUrl);
    const pathParts = url.pathname.split('/').filter(part => part.length > 0);
    
    // Remove the bucket name from the path
    if (pathParts[0] === WASABI_CONFIG.bucket) {
      pathParts.shift();
    }
    
    const key = pathParts.join('/');
    console.log('Extracted key:', key);
    
    const command = new GetObjectCommand({
      Bucket: WASABI_CONFIG.bucket,
      Key: key,
    });
    
    // Generate presigned URL valid for 7 days
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 7 * 24 * 60 * 60 });
    
    console.log('Generated presigned URL:', presignedUrl);
    
    // Test the presigned URL
    const response = await fetch(presignedUrl, { method: 'HEAD' });
    console.log('Presigned URL test status:', response.status);
    
    if (response.ok) {
      console.log('✅ Presigned URL works!');
    } else {
      console.log('❌ Presigned URL failed:', response.status, response.statusText);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testPresignedUrl();
