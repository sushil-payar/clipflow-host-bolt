import { supabase } from '@/integrations/supabase/client';
import { UploadSpeedMonitor, UploadSpeedInfo } from './upload-speed-monitor';
import { transcodeToMultipleResolutions, TranscodingProgress } from './multi-resolution-transcoding';

export interface EnhancedUploadProgress {
  stage: 'preparing' | 'transcoding' | 'uploading' | 'finalizing' | 'completed';
  overallProgress: number;
  uploadSpeed?: UploadSpeedInfo;
  transcodingProgress?: { [resolution: string]: TranscodingProgress };
  currentResolution?: string;
  message: string;
}

export interface EnhancedUploadResult {
  success: boolean;
  videoId?: string;
  resolutions?: { [key: string]: { url: string; size: number; bitrate: number } };
  masterPlaylistUrl?: string;
  compressionRatio?: number;
  error?: string;
}

export const uploadVideoWithMultiResolution = async (
  file: File,
  title: string,
  description: string,
  onProgress: (progress: EnhancedUploadProgress) => void
): Promise<EnhancedUploadResult> => {
  const speedMonitor = new UploadSpeedMonitor();
  
  try {
    // Stage 1: Preparing
    onProgress({
      stage: 'preparing',
      overallProgress: 5,
      message: 'Preparing video for transcoding...'
    });

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Authentication required');
    }

    // Stage 2: Transcoding
    onProgress({
      stage: 'transcoding',
      overallProgress: 10,
      message: 'Transcoding to multiple resolutions...'
    });

    const transcodingResult = await transcodeToMultipleResolutions(file, (transcodingProgress) => {
      onProgress({
        stage: 'transcoding',
        overallProgress: 10 + (Object.values(transcodingProgress).reduce((sum, p) => sum + p.progress, 0) / Object.keys(transcodingProgress).length) * 0.4,
        transcodingProgress,
        message: 'Creating multiple video qualities...'
      });
    });

    // Stage 3: Uploading
    onProgress({
      stage: 'uploading',
      overallProgress: 50,
      message: 'Uploading video files...'
    });

    // Create form data with all resolutions
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('originalFile', file);
    formData.append('masterPlaylist', transcodingResult.masterPlaylist);
    formData.append('resolutionData', JSON.stringify(transcodingResult.resolutions));

    // Add each resolution file
    let totalUploadSize = 0;
    Object.entries(transcodingResult.resolutions).forEach(([resolution, data]) => {
      // Convert blob URL back to file for upload
      fetch(data.url).then(response => response.blob()).then(blob => {
        const resolutionFile = new File([blob], `${resolution}.mp4`, { type: 'video/mp4' });
        formData.append(`resolution_${resolution}`, resolutionFile);
        totalUploadSize += resolutionFile.size;
      });
    });

    // Upload with progress tracking
    const uploadPromise = new Promise<any>(async (resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const speedInfo = speedMonitor.update(event.loaded, event.total);
          onProgress({
            stage: 'uploading',
            overallProgress: 50 + (speedInfo.percentage * 0.4),
            uploadSpeed: speedInfo,
            message: `Uploading at ${speedMonitor.formatSpeed(speedInfo.speed)} - ${speedMonitor.formatTime(speedInfo.timeRemaining)} remaining`
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve({ success: true });
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));

      // Use the enhanced edge function
      const { data: { session } } = await supabase.auth.getSession();
      xhr.open('POST', `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-multi-resolution`);
      xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token}`);
      xhr.send(formData);
    });

    const uploadResult = await uploadPromise;

    // Stage 4: Finalizing
    onProgress({
      stage: 'finalizing',
      overallProgress: 95,
      message: 'Finalizing upload...'
    });

    // Stage 5: Completed
    onProgress({
      stage: 'completed',
      overallProgress: 100,
      message: 'Upload completed successfully!'
    });

    return {
      success: true,
      videoId: uploadResult.videoId,
      resolutions: transcodingResult.resolutions,
      masterPlaylistUrl: uploadResult.masterPlaylistUrl,
      compressionRatio: transcodingResult.compressionRatio
    };

  } catch (error) {
    console.error('Enhanced upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
};

const getVideoMetadata = (file: File): Promise<{ width: number; height: number; duration: number }> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    
    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration
      });
    };
    
    video.onerror = () => reject(new Error('Error loading video metadata'));
    video.src = URL.createObjectURL(file);
    video.load();
  });
};