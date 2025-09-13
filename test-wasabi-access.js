// Test Wasabi access and credentials
import { S3Client, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';

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

async function testWasabiAccess() {
  try {
    console.log('Testing Wasabi credentials and bucket access...');
    
    // Test 1: List objects in bucket
    console.log('\n1. Testing bucket listing...');
    const listCommand = new ListObjectsV2Command({
      Bucket: WASABI_CONFIG.bucket,
      MaxKeys: 5
    });
    
    const listResult = await s3Client.send(listCommand);
    console.log('✅ Bucket listing successful');
    console.log('Objects found:', listResult.Contents?.length || 0);
    
    if (listResult.Contents && listResult.Contents.length > 0) {
      const firstObject = listResult.Contents[0];
      console.log('First object:', firstObject.Key);
      
      // Test 2: Head object
      console.log('\n2. Testing object access...');
      const headCommand = new HeadObjectCommand({
        Bucket: WASABI_CONFIG.bucket,
        Key: firstObject.Key
      });
      
      const headResult = await s3Client.send(headCommand);
      console.log('✅ Object head successful');
      console.log('Content-Type:', headResult.ContentType);
      console.log('Content-Length:', headResult.ContentLength);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.name, error.message);
    
    if (error.name === 'NoSuchBucket') {
      console.log('💡 The bucket does not exist. Please create it in Wasabi console.');
    } else if (error.name === 'InvalidAccessKeyId') {
      console.log('💡 Invalid access key. Please check your Wasabi credentials.');
    } else if (error.name === 'SignatureDoesNotMatch') {
      console.log('💡 Invalid secret key. Please check your Wasabi credentials.');
    }
  }
}

testWasabiAccess();
