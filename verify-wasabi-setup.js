// Verify Wasabi setup and credentials
import { S3Client, ListBucketsCommand, GetBucketLocationCommand } from '@aws-sdk/client-s3';

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

async function verifyWasabiSetup() {
  try {
    console.log('Verifying Wasabi setup...\n');
    
    // Test 1: List buckets to verify credentials
    console.log('1. Testing credentials by listing buckets...');
    const listBucketsCommand = new ListBucketsCommand({});
    const bucketsResult = await s3Client.send(listBucketsCommand);
    
    console.log('✅ Credentials are valid');
    console.log('Available buckets:');
    bucketsResult.Buckets?.forEach(bucket => {
      console.log(`  - ${bucket.Name} (created: ${bucket.CreationDate})`);
    });
    
    // Test 2: Check bucket location
    console.log('\n2. Checking bucket location...');
    const locationCommand = new GetBucketLocationCommand({
      Bucket: WASABI_CONFIG.bucket
    });
    
    const locationResult = await s3Client.send(locationCommand);
    console.log(`Bucket location: ${locationResult.LocationConstraint || 'us-east-1'}`);
    
    // Test 3: Check if bucket exists in the correct region
    if (locationResult.LocationConstraint !== WASABI_CONFIG.region) {
      console.log(`⚠️  WARNING: Bucket is in region '${locationResult.LocationConstraint}' but we're using '${WASABI_CONFIG.region}'`);
    }
    
    // Test 4: Test with different endpoint formats
    console.log('\n3. Testing different endpoint formats...');
    
    const endpoints = [
      'https://s3.us-central-1.wasabisys.com',
      'https://s3.wasabisys.com',
      'https://s3.us-central-1.wasabisys.com/',
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Testing endpoint: ${endpoint}`);
        const testClient = new S3Client({
          region: WASABI_CONFIG.region,
          endpoint: endpoint,
          credentials: {
            accessKeyId: WASABI_CONFIG.accessKeyId,
            secretAccessKey: WASABI_CONFIG.secretAccessKey,
          },
          forcePathStyle: true,
        });
        
        const testCommand = new ListBucketsCommand({});
        await testClient.send(testCommand);
        console.log(`✅ Endpoint ${endpoint} works`);
      } catch (error) {
        console.log(`❌ Endpoint ${endpoint} failed: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.name, error.message);
  }
}

verifyWasabiSetup();
