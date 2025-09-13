// Debug Wasabi access issues
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
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

async function debugWasabiAccess() {
  const key = '438811cc-145c-4275-8079-7e36fae958dc/1757773256000-0vfqp4.mp4';
  
  try {
    console.log('Testing direct object access...');
    
    // Test 1: Head object (should work)
    const headCommand = new HeadObjectCommand({
      Bucket: WASABI_CONFIG.bucket,
      Key: key
    });
    
    const headResult = await s3Client.send(headCommand);
    console.log('✅ Head object successful');
    console.log('Content-Type:', headResult.ContentType);
    console.log('Content-Length:', headResult.ContentLength);
    
    // Test 2: Get object (should work)
    console.log('\nTesting direct get object...');
    const getCommand = new GetObjectCommand({
      Bucket: WASABI_CONFIG.bucket,
      Key: key
    });
    
    const getResult = await s3Client.send(getCommand);
    console.log('✅ Get object successful');
    console.log('Content-Type:', getResult.ContentType);
    console.log('Content-Length:', getResult.ContentLength);
    
    // Test 3: Generate presigned URL with different expiration times
    console.log('\nTesting presigned URLs with different expiration times...');
    
    const expirationTimes = [3600, 7200, 28800]; // 1 hour, 2 hours, 8 hours
    
    for (const expiresIn of expirationTimes) {
      try {
        console.log(`\nTesting ${expiresIn / 3600} hour expiration...`);
        const presignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn });
        console.log('Generated presigned URL:', presignedUrl.substring(0, 100) + '...');
        
        // Test the presigned URL
        const response = await fetch(presignedUrl, { method: 'HEAD' });
        console.log(`Status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          console.log('✅ Presigned URL works!');
          break;
        } else {
          const errorText = await response.text();
          console.log('❌ Error response:', errorText.substring(0, 200));
        }
      } catch (error) {
        console.log('❌ Error generating presigned URL:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.name, error.message);
  }
}

debugWasabiAccess();
