// Test different bucket policy formats
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

async function testBucketPolicy() {
  try {
    console.log('Testing bucket policy configuration...\n');
    
    // Test 1: Check current bucket policy
    console.log('1. Checking current bucket policy...');
    try {
      const getPolicyCommand = new GetBucketPolicyCommand({
        Bucket: WASABI_CONFIG.bucket
      });
      
      const currentPolicy = await s3Client.send(getPolicyCommand);
      console.log('Current policy:', currentPolicy.Policy);
    } catch (error) {
      console.log('No bucket policy found or error reading policy:', error.message);
    }
    
    // Test 2: Apply correct bucket policy
    console.log('\n2. Applying correct bucket policy...');
    
    // Correct policy format for public access
    const correctPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AllowPublicRead',
          Effect: 'Allow',
          Principal: '*', // This should be "*" not {"AWS": "*"}
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${WASABI_CONFIG.bucket}/*` // Note the /* at the end
        }
      ]
    };
    
    const putPolicyCommand = new PutBucketPolicyCommand({
      Bucket: WASABI_CONFIG.bucket,
      Policy: JSON.stringify(correctPolicy)
    });
    
    await s3Client.send(putPolicyCommand);
    console.log('✅ Correct bucket policy applied');
    console.log('Policy:', JSON.stringify(correctPolicy, null, 2));
    
    // Test 3: Test direct access after policy update
    console.log('\n3. Testing direct access after policy update...');
    const testUrl = `${WASABI_CONFIG.endpoint}/${WASABI_CONFIG.bucket}/test-account-restrictions.txt`;
    console.log('Testing URL:', testUrl);
    
    const response = await fetch(testUrl, { method: 'HEAD' });
    console.log('Status:', response.status, response.statusText);
    
    if (response.ok) {
      console.log('✅ Direct access now works!');
      console.log('Content-Type:', response.headers.get('content-type'));
    } else {
      const errorText = await response.text();
      console.log('❌ Direct access still failed');
      console.log('Error:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.name, error.message);
  }
}

testBucketPolicy();
