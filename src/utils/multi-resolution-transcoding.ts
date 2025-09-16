// Multi-resolution video transcoding utility
export interface ResolutionPreset {
  label: string;
  height: number;
  width: number;
  bitrate: number; // kbps
  quality: number; // 0.0 to 1.0
  audioBitrate: number; // kbps
}

export const RESOLUTION_PRESETS: ResolutionPreset[] = [
  { label: '1080p', height: 1080, width: 1920, bitrate: 5000, quality: 0.8, audioBitrate: 192 },
  { label: '720p', height: 720, width: 1280, bitrate: 2500, quality: 0.7, audioBitrate: 128 },
  { label: '480p', height: 480, width: 854, bitrate: 1000, quality: 0.6, audioBitrate: 96 },
  { label: '360p', height: 360, width: 640, bitrate: 600, quality: 0.5, audioBitrate: 64 },
  { label: '240p', height: 240, width: 426, bitrate: 300, quality: 0.4, audioBitrate: 48 }
];

export interface TranscodingProgress {
  resolution: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  fileSize?: number;
  url?: string;
}

export interface TranscodingResult {
  resolutions: { [key: string]: { url: string; size: number; bitrate: number } };
  masterPlaylist: string;
  totalSize: number;
  compressionRatio: number;
  segmentCount: number;
}

export const transcodeToMultipleResolutions = async (
  file: File,
  onProgress?: (progress: { [resolution: string]: TranscodingProgress }) => void
): Promise<TranscodingResult> => {
  const originalSize = file.size;
  const resolutions: { [key: string]: { url: string; size: number; bitrate: number } } = {};
  let totalSize = 0;
  let segmentCount = 0;

  // Determine which resolutions to generate based on original video
  const metadata = await getVideoMetadata(file);
  const applicablePresets = RESOLUTION_PRESETS.filter(preset => 
    preset.height <= metadata.height
  );

  // Always include at least 360p for compatibility
  if (applicablePresets.length === 0) {
    applicablePresets.push(RESOLUTION_PRESETS.find(p => p.label === '360p')!);
  }

  const progressState: { [resolution: string]: TranscodingProgress } = {};
  
  // Initialize progress state
  applicablePresets.forEach(preset => {
    progressState[preset.label] = {
      resolution: preset.label,
      progress: 0,
      status: 'pending'
    };
  });

  onProgress?.(progressState);

  // Process each resolution
  for (const preset of applicablePresets) {
    try {
      progressState[preset.label].status = 'processing';
      onProgress?.(progressState);

      const result = await compressVideoToResolution(file, preset, (progress) => {
        progressState[preset.label].progress = progress;
        onProgress?.(progressState);
      });

      resolutions[preset.label] = {
        url: result.url,
        size: result.size,
        bitrate: preset.bitrate
      };

      totalSize += result.size;
      segmentCount += result.segments || 1;

      progressState[preset.label] = {
        resolution: preset.label,
        progress: 100,
        status: 'completed',
        fileSize: result.size,
        url: result.url
      };

      onProgress?.(progressState);

    } catch (error) {
      console.error(`Failed to transcode ${preset.label}:`, error);
      progressState[preset.label].status = 'error';
      onProgress?.(progressState);
    }
  }

  // Generate HLS master playlist
  const masterPlaylist = generateHLSMasterPlaylist(resolutions);
  const compressionRatio = ((originalSize - totalSize) / originalSize) * 100;

  return {
    resolutions,
    masterPlaylist,
    totalSize,
    compressionRatio,
    segmentCount
  };
};

const compressVideoToResolution = async (
  file: File,
  preset: ResolutionPreset,
  onProgress?: (progress: number) => void
): Promise<{ url: string; size: number; segments?: number }> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    video.onloadedmetadata = () => {
      // Calculate dimensions maintaining aspect ratio
      const aspectRatio = video.videoWidth / video.videoHeight;
      let targetWidth = preset.width;
      let targetHeight = preset.height;

      if (video.videoWidth < preset.width) {
        targetWidth = video.videoWidth;
        targetHeight = video.videoHeight;
      } else {
        if (aspectRatio > (preset.width / preset.height)) {
          targetHeight = Math.round(preset.width / aspectRatio);
        } else {
          targetWidth = Math.round(preset.height * aspectRatio);
        }
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // Set up MediaRecorder with optimized settings
      const stream = canvas.captureStream(30);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        videoBitsPerSecond: preset.bitrate * 1000,
        audioBitsPerSecond: preset.audioBitrate * 1000
      });

      const chunks: Blob[] = [];
      let processedFrames = 0;
      const totalFrames = Math.ceil(video.duration * 30); // 30 FPS

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const compressedBlob = new Blob(chunks, { type: 'video/mp4' });
        const url = URL.createObjectURL(compressedBlob);
        
        resolve({
          url,
          size: compressedBlob.size,
          segments: Math.ceil(video.duration / 6) // 6-second segments
        });
      };

      mediaRecorder.onerror = reject;
      mediaRecorder.start();

      const drawFrame = () => {
        if (video.ended || video.paused) {
          mediaRecorder.stop();
          return;
        }

        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        processedFrames++;
        
        const progress = Math.min((processedFrames / totalFrames) * 100, 100);
        onProgress?.(progress);

        requestAnimationFrame(drawFrame);
      };

      video.currentTime = 0;
      video.play().then(drawFrame).catch(reject);
    };

    video.onerror = () => reject(new Error('Error loading video'));
    video.src = URL.createObjectURL(file);
    video.load();
  });
};

const generateHLSMasterPlaylist = (resolutions: { [key: string]: { url: string; size: number; bitrate: number } }): string => {
  let playlist = '#EXTM3U\n#EXT-X-VERSION:3\n\n';
  
  Object.entries(resolutions).forEach(([label, data]) => {
    const height = parseInt(label.replace('p', ''));
    playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${data.bitrate * 1000},RESOLUTION=${getWidthForHeight(height)}x${height}\n`;
    playlist += `${label}.m3u8\n\n`;
  });

  return playlist;
};

const getWidthForHeight = (height: number): number => {
  const preset = RESOLUTION_PRESETS.find(p => p.height === height);
  return preset?.width || Math.round(height * (16/9));
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