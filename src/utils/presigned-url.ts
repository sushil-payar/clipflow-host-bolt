// Utility to generate presigned URLs for video access
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

// Cache for presigned URLs to avoid regenerating them unnecessarily
const presignedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export const generatePresignedVideoUrl = async (videoUrl: string): Promise<string> => {
  try {
    // Extract the key from the video URL
    // URL format: https://clipflow-videos.s3.us-central-1.wasabisys.com/user-id/filename.mp4
    const url = new URL(videoUrl);
    const pathParts = url.pathname.split('/').filter(part => part.length > 0);
    
    // Remove the bucket name from the path
    if (pathParts[0] === WASABI_CONFIG.bucket) {
      pathParts.shift();
    }
    
    const key = pathParts.join('/');
    
    if (!key) {
      throw new Error('Could not extract key from video URL');
    }
    
    // Check if we have a cached presigned URL that's still valid
    const cached = presignedUrlCache.get(key);
    const now = Date.now();
    
    if (cached && cached.expiresAt > now + (30 * 60 * 1000)) { // 30 minutes buffer
      console.log('Using cached presigned URL for key:', key);
      return cached.url;
    }
    
    console.log('Generating new presigned URL for key:', key);
    
    const command = new GetObjectCommand({
      Bucket: WASABI_CONFIG.bucket,
      Key: key,
    });
    
    // Generate presigned URL valid for 8 hours (as per Wasabi's limit)
    const expiresIn = 8 * 60 * 60; // 8 hours in seconds
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    
    // Cache the URL with expiration time
    presignedUrlCache.set(key, {
      url: presignedUrl,
      expiresAt: now + (expiresIn * 1000)
    });
    
    console.log('Generated presigned URL (expires in 8 hours):', presignedUrl);
    return presignedUrl;
    
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    // Return original URL as fallback
    return videoUrl;
  }
};

// Function to check if a presigned URL is expired
export const isPresignedUrlExpired = (videoUrl: string): boolean => {
  try {
    const url = new URL(videoUrl);
    const pathParts = url.pathname.split('/').filter(part => part.length > 0);
    
    if (pathParts[0] === WASABI_CONFIG.bucket) {
      pathParts.shift();
    }
    
    const key = pathParts.join('/');
    const cached = presignedUrlCache.get(key);
    
    if (!cached) return true;
    
    return Date.now() >= cached.expiresAt;
  } catch {
    return true;
  }
};

// Function to refresh presigned URL if needed
export const refreshPresignedUrlIfNeeded = async (videoUrl: string): Promise<string> => {
  if (isPresignedUrlExpired(videoUrl)) {
    console.log('Presigned URL expired, generating new one...');
    return await generatePresignedVideoUrl(videoUrl);
  }
  return videoUrl;
};
