// List all objects in the Wasabi bucket
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

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

async function listBucketObjects() {
  try {
    console.log('Listing all objects in bucket...');
    
    const listCommand = new ListObjectsV2Command({
      Bucket: WASABI_CONFIG.bucket,
      MaxKeys: 100
    });
    
    const result = await s3Client.send(listCommand);
    
    console.log(`Found ${result.Contents?.length || 0} objects:`);
    
    if (result.Contents) {
      result.Contents.forEach((obj, index) => {
        console.log(`${index + 1}. Key: ${obj.Key}`);
        console.log(`   Size: ${obj.Size} bytes`);
        console.log(`   Last Modified: ${obj.LastModified}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.name, error.message);
  }
}

listBucketObjects();
