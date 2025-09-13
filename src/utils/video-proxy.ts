// Video proxy utility to serve Wasabi videos through the app
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

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

export const getVideoStream = async (videoUrl: string): Promise<{ stream: ReadableStream; contentType: string; contentLength: number }> => {
  try {
    // Extract the key from the video URL
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
    
    console.log('Getting video stream for key:', key);
    
    const command = new GetObjectCommand({
      Bucket: WASABI_CONFIG.bucket,
      Key: key,
    });
    
    const response = await s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('No video data received');
    }
    
    return {
      stream: response.Body as ReadableStream,
      contentType: response.ContentType || 'video/mp4',
      contentLength: response.ContentLength || 0
    };
    
  } catch (error) {
    console.error('Error getting video stream:', error);
    throw error;
  }
};

// Generate a proxy URL for the video
export const getVideoProxyUrl = (videoUrl: string): string => {
  const encodedUrl = encodeURIComponent(videoUrl);
  return `/api/video-proxy?url=${encodedUrl}`;
};
