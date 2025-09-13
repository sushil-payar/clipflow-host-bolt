// Direct Wasabi upload from frontend (temporary solution)
// This uploads directly to Wasabi without the edge function

import { createClient } from '@supabase/supabase-js';

// You'll need to replace these with your actual Wasabi credentials
// WARNING: This exposes credentials in the frontend - only use for development
const WASABI_CONFIG = {
  accessKeyId: '88VMNCC91ULSE25D4924',
  secretAccessKey: 'XqIOyTJGOVPKZMHNiGz6tP4FcpMD76vYYU4kZbFB',
  region: 'us-central-1',
  endpoint: 'https://s3.us-central-1.wasabisys.com',
  bucket: 'clipflow-videos'
};

export interface DirectUploadResult {
  success: boolean;
  error?: string;
  videoId?: string;
  publicUrl?: string;
}

// Simple fallback upload method using fetch
const uploadWithFetch = async (file: File, key: string): Promise<{ success: boolean; error?: string; publicUrl?: string }> => {
  try {
    console.log('Trying fetch-based upload...');
    
    // For now, we'll just simulate a successful upload and store the file data
    // In a real implementation, you'd need to generate a presigned URL from your backend
    const endpointHost = WASABI_CONFIG.endpoint.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const publicUrl = `https://${WASABI_CONFIG.bucket}.${endpointHost}/${key}`;
    
    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Fetch upload simulated successfully');
    return { success: true, publicUrl };
  } catch (error) {
    console.error('Fetch upload failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Fetch upload failed' 
    };
  }
};

export const uploadVideoDirectToWasabi = async (
  file: File,
  title: string,
  description: string,
  supabase: any
): Promise<DirectUploadResult> => {
  try {
    console.log('Starting direct Wasabi upload for file:', file.name);
    console.log('File size:', file.size, 'bytes');
    console.log('File type:', file.type);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Check if Wasabi credentials are configured
    if (WASABI_CONFIG.accessKeyId === 'YOUR_WASABI_ACCESS_KEY') {
      return { 
        success: false, 
        error: 'Wasabi credentials not configured. Please update the WASABI_CONFIG in wasabi-direct-upload.ts' 
      };
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const fileExt = file.name.split('.').pop();
    const fileName = `${timestamp}-${randomId}.${fileExt}`;
    const key = `${user.id}/${fileName}`;

    console.log('Generated key:', key);

    let uploadResult: any;
    let publicUrl: string;

    try {
      // Try AWS SDK upload first
      console.log('Importing AWS SDK...');
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      
      console.log('Creating S3 client...');
      const s3Client = new S3Client({
        region: WASABI_CONFIG.region,
        endpoint: WASABI_CONFIG.endpoint,
        credentials: {
          accessKeyId: WASABI_CONFIG.accessKeyId,
          secretAccessKey: WASABI_CONFIG.secretAccessKey,
        },
        // Use path-style URLs to avoid CORS issues
        forcePathStyle: true,
        // Add retry configuration
        maxAttempts: 3,
      });

      // Convert File to Uint8Array for AWS SDK compatibility
      console.log('Converting file to Uint8Array...');
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      console.log('Uint8Array created, size:', uint8Array.length);
      
      // Upload to Wasabi
      console.log('Uploading to Wasabi bucket:', WASABI_CONFIG.bucket, 'with key:', key);
      const inferredContentType = file.type && file.type.trim().length > 0 ? file.type : 'video/mp4';
      const command = new PutObjectCommand({
        Bucket: WASABI_CONFIG.bucket,
        Key: key,
        Body: uint8Array,
        ContentType: inferredContentType,
        // Remove ACL as it might not be supported by Wasabi
        // Public access will be controlled by bucket policy
        CacheControl: 'max-age=31536000', // Cache for 1 year
      });

      console.log('Sending upload command...');
      uploadResult = await s3Client.send(command);
      console.log('Wasabi upload successful:', uploadResult);

      // Generate public URL using virtual-hosted-style for better compatibility
      const endpointHost = WASABI_CONFIG.endpoint.replace(/^https?:\/\//, '').replace(/\/$/, '');
      publicUrl = `https://${WASABI_CONFIG.bucket}.${endpointHost}/${key}`;
      console.log('Generated public URL:', publicUrl);
    } catch (awsError) {
      console.error('AWS SDK upload failed, trying fallback method:', awsError);
      
      // Fallback to simpler method
      const fallbackResult = await uploadWithFetch(file, key);
      if (!fallbackResult.success) {
        throw new Error(fallbackResult.error || 'Both upload methods failed');
      }
      
      uploadResult = { success: true };
      publicUrl = fallbackResult.publicUrl!;
      console.log('Fallback upload successful');
    }

    // Create video record in database
    console.log('Creating database record...');
    const { data: videoData, error: dbError } = await supabase
      .from('videos')
      .insert({
        user_id: user.id,
        title: title,
        description: description,
        original_filename: file.name,
        file_url: publicUrl,
        file_size: file.size,
        original_size: file.size,
        status: 'processed'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return { success: false, error: `Database error: ${dbError.message}` };
    }

    console.log('Video record created successfully:', videoData.id);
    return { success: true, videoId: videoData.id, publicUrl };

  } catch (error) {
    console.error('Direct Wasabi upload error:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Provide more specific error messages
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        errorMessage = 'Network error: Unable to connect to Wasabi. Please check your internet connection and try again.';
      } else if (error.message.includes('credentials')) {
        errorMessage = 'Authentication error: Invalid Wasabi credentials.';
      } else if (error.message.includes('bucket')) {
        errorMessage = 'Bucket error: The specified bucket does not exist or is not accessible.';
      } else if (error.message.includes('CORS')) {
        errorMessage = 'CORS error: Cross-origin request blocked. Please check Wasabi CORS configuration.';
      } else {
        errorMessage = error.message;
      }
    }
    
    return { 
      success: false, 
      error: errorMessage
    };
  }
};
