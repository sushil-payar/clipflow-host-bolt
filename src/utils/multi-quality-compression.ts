// Multi-quality video compression for different quality levels
import { compressVideo, getVideoMetadata } from './video-compression';

interface QualityPreset {
  label: string;
  height: number;
  quality: number;
  maxWidth: number;
  maxHeight: number;
  bitrate: number;
}

const QUALITY_PRESETS: QualityPreset[] = [
  { label: '4K', height: 2160, quality: 0.8, maxWidth: 3840, maxHeight: 2160, bitrate: 15000 },
  { label: '1080p', height: 1080, quality: 0.6, maxWidth: 1920, maxHeight: 1080, bitrate: 8000 },
  { label: '720p', height: 720, quality: 0.4, maxWidth: 1280, maxHeight: 720, bitrate: 4000 },
  { label: '480p', height: 480, quality: 0.3, maxWidth: 854, maxHeight: 480, bitrate: 2000 },
  { label: '360p', height: 360, quality: 0.2, maxWidth: 640, maxHeight: 360, bitrate: 1000 }
];

export const compressVideoMultiQuality = async (
  file: File,
  targetQualities: string[] = ['720p', '480p', '360p'] // Default to lower qualities for speed
): Promise<{
  qualities: { [key: string]: { file: File; size: number; url: string } };
  originalSize: number;
  totalCompressedSize: number;
  metadata: any;
}> => {
  const metadata = await getVideoMetadata(file);
  const originalSize = file.size;
  
  const qualities: { [key: string]: { file: File; size: number; url: string } } = {};
  let totalCompressedSize = 0;

  // Determine which qualities to generate based on original video resolution
  const applicablePresets = QUALITY_PRESETS.filter(preset => 
    targetQualities.includes(preset.label) && preset.height <= metadata.height
  );

  // If no applicable presets, use the lowest quality that's still reasonable
  if (applicablePresets.length === 0) {
    applicablePresets.push(QUALITY_PRESETS.find(p => p.label === '360p')!);
  }

  // Compress in parallel for speed
  const compressionPromises = applicablePresets.map(async (preset) => {
    try {
      const result = await compressVideo(file, {
        quality: preset.quality,
        maxWidth: preset.maxWidth,
        maxHeight: preset.maxHeight,
        format: 'mp4'
      });

      const url = URL.createObjectURL(result.compressedFile);
      
      return {
        label: preset.label,
        file: result.compressedFile,
        size: result.compressedSize,
        url
      };
    } catch (error) {
      console.error(`Failed to compress to ${preset.label}:`, error);
      return null;
    }
  });

  const results = await Promise.all(compressionPromises);
  
  results.forEach(result => {
    if (result) {
      qualities[result.label] = {
        file: result.file,
        size: result.size,
        url: result.url
      };
      totalCompressedSize += result.size;
    }
  });

  return {
    qualities,
    originalSize,
    totalCompressedSize,
    metadata
  };
};

export const getOptimalQualityForUpload = (fileSize: number): string[] => {
  // For very large files, prioritize speed with lower qualities
  if (fileSize > 500 * 1024 * 1024) { // > 500MB
    return ['480p', '360p'];
  } else if (fileSize > 100 * 1024 * 1024) { // > 100MB
    return ['720p', '480p'];
  } else {
    return ['1080p', '720p', '480p'];
  }
};