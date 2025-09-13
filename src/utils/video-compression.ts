// Video compression utility for client-side compression before upload

interface CompressionOptions {
  quality?: number; // 0.0 to 1.0, where 0.8 = 80% compression
  maxWidth?: number;
  maxHeight?: number;
  format?: 'mp4' | 'webm';
}

export const compressVideo = async (
  file: File, 
  options: CompressionOptions = {}
): Promise<{ compressedFile: File; originalSize: number; compressedSize: number; compressionRatio: number }> => {
  const {
    quality = 0.2, // 80% compression (0.2 quality means 80% size reduction)
    maxWidth = 1920,
    maxHeight = 1080,
    format = 'mp4'
  } = options;

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    video.onloadedmetadata = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let { videoWidth, videoHeight } = video;
      const aspectRatio = videoWidth / videoHeight;
      
      if (videoWidth > maxWidth) {
        videoWidth = maxWidth;
        videoHeight = maxWidth / aspectRatio;
      }
      
      if (videoHeight > maxHeight) {
        videoHeight = maxHeight;
        videoWidth = maxHeight * aspectRatio;
      }
      
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      
      // Set up MediaRecorder for compression
      const stream = canvas.captureStream(30); // 30 FPS
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: format === 'webm' ? 'video/webm;codecs=vp9' : 'video/mp4;codecs=avc1',
        videoBitsPerSecond: Math.floor(videoWidth * videoHeight * quality * 0.1) // Dynamic bitrate
      });
      
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const compressedBlob = new Blob(chunks, { type: `video/${format}` });
        const compressedFile = new File([compressedBlob], file.name, {
          type: `video/${format}`,
          lastModified: Date.now()
        });
        
        const originalSize = file.size;
        const compressedSize = compressedFile.size;
        const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;
        
        resolve({
          compressedFile,
          originalSize,
          compressedSize,
          compressionRatio
        });
      };
      
      mediaRecorder.onerror = (event) => {
        reject(new Error(`MediaRecorder error: ${event}`));
      };
      
      // Start recording
      mediaRecorder.start();
      
      // Draw video frames to canvas
      const drawFrame = () => {
        if (video.ended || video.paused) {
          mediaRecorder.stop();
          return;
        }
        
        ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
        requestAnimationFrame(drawFrame);
      };
      
      // Start playing video to capture frames
      video.currentTime = 0;
      video.play().then(() => {
        drawFrame();
      }).catch(reject);
    };
    
    video.onerror = () => {
      reject(new Error('Error loading video for compression'));
    };
    
    // Load the video file
    video.src = URL.createObjectURL(file);
    video.load();
  });
};

export const getVideoMetadata = (file: File): Promise<{
  duration: number;
  width: number;
  height: number;
  size: number;
}> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    
    video.onloadedmetadata = () => {
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        size: file.size
      });
    };
    
    video.onerror = () => {
      reject(new Error('Error loading video metadata'));
    };
    
    video.src = URL.createObjectURL(file);
    video.load();
  });
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatCompressionRatio = (ratio: number): string => {
  return `${ratio.toFixed(1)}%`;
};