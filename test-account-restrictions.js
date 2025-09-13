// Test to verify Wasabi account-level restrictions
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
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

async function testAccountRestrictions() {
  console.log('Testing Wasabi account-level restrictions...\n');
  
  try {
    // Test 1: Upload a test file
    console.log('1. Testing file upload...');
    const testKey = 'test-account-restrictions.txt';
    const testContent = 'This is a test file to check account restrictions.';
    
    const putCommand = new PutObjectCommand({
      Bucket: WASABI_CONFIG.bucket,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
    });
    
    await s3Client.send(putCommand);
    console.log('✅ File upload successful');
    
    // Test 2: Generate presigned URL for the test file
    console.log('\n2. Testing presigned URL generation...');
    const getCommand = new GetObjectCommand({
      Bucket: WASABI_CONFIG.bucket,
      Key: testKey,
    });
    
    const presignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });
    console.log('✅ Presigned URL generated');
    console.log('URL:', presignedUrl.substring(0, 100) + '...');
    
    // Test 3: Test the presigned URL
    console.log('\n3. Testing presigned URL access...');
    const response = await fetch(presignedUrl, { method: 'HEAD' });
    console.log('Status:', response.status, response.statusText);
    
    if (response.ok) {
      console.log('✅ Presigned URL works!');
      console.log('Content-Type:', response.headers.get('content-type'));
    } else {
      const errorText = await response.text();
      console.log('❌ Presigned URL failed');
      console.log('Error:', errorText);
      
      if (errorText.includes('Public use of objects is not allowed')) {
        console.log('\n🔍 DIAGNOSIS: Account-level public access is disabled');
        console.log('📧 ACTION REQUIRED: Contact Wasabi support at support@wasabi.com');
        console.log('💡 REQUEST: Enable public access for video streaming use case');
      }
    }
    
    // Test 4: Test direct object access
    console.log('\n4. Testing direct object access...');
    const directUrl = `${WASABI_CONFIG.endpoint}/${WASABI_CONFIG.bucket}/${testKey}`;
    console.log('Direct URL:', directUrl);
    
    const directResponse = await fetch(directUrl, { method: 'HEAD' });
    console.log('Direct access status:', directResponse.status, directResponse.statusText);
    
    if (directResponse.ok) {
      console.log('✅ Direct access works!');
    } else {
      const directErrorText = await directResponse.text();
      console.log('❌ Direct access failed');
      console.log('Error:', directErrorText);
    }
    
    // Cleanup: Delete test file
    console.log('\n5. Cleaning up test file...');
    // Note: We don't have delete permissions in the current setup, so we'll leave it
    
  } catch (error) {
    console.error('❌ Test failed:', error.name, error.message);
  }
}

testAccountRestrictions();
