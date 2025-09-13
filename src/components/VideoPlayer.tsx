import { useEffect, useRef, useState } from 'react';
import { generatePresignedVideoUrl, refreshPresignedUrlIfNeeded } from '@/utils/presigned-url';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
}

const VideoPlayer = ({ src, poster, className }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canPlay, setCanPlay] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string>(src);
  const [isLoading, setIsLoading] = useState(false);

  const isValidVideoUrl = (url: string) => {
    if (!url || url.startsWith('placeholder://')) return false;
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';
    } catch {
      return false;
    }
  };

  useEffect(() => {
    setError(null);
    setCanPlay(false);
    setIsLoading(true);
    
    // Generate presigned URL for Wasabi videos
    if (isValidVideoUrl(src) && src.includes('wasabisys.com')) {
      generatePresignedVideoUrl(src).then(presignedUrl => {
        setVideoSrc(presignedUrl);
        setIsLoading(false);
        testVideoUrl(presignedUrl);
      }).catch(error => {
        console.error('Failed to generate presigned URL:', error);
        setVideoSrc(src);
        setIsLoading(false);
        testVideoUrl(src);
      });
    } else if (isValidVideoUrl(src)) {
      setVideoSrc(src);
      setIsLoading(false);
      testVideoUrl(src);
    }
  }, [src]);

  const testVideoUrl = async (url: string) => {
    try {
      console.log('Testing video URL accessibility:', url);
      const response = await fetch(url, { method: 'HEAD' });
      console.log('URL test response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        if (response.status === 403 && url.includes('wasabisys.com')) {
          // Try to refresh the presigned URL
          console.log('403 error detected, attempting to refresh presigned URL...');
          try {
            const refreshedUrl = await refreshPresignedUrlIfNeeded(src);
            if (refreshedUrl !== url) {
              setVideoSrc(refreshedUrl);
              return;
            }
          } catch (refreshError) {
            console.error('Failed to refresh presigned URL:', refreshError);
          }
        }
        setError(`Video not accessible: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('URL test failed:', error);
      setError('Video URL is not accessible - possible CORS or network issue');
    }
  };

  const handleVideoError = async () => {
    if (videoSrc.includes('wasabisys.com')) {
      console.log('Video error detected, attempting to refresh presigned URL...');
      setIsLoading(true);
      try {
        const refreshedUrl = await refreshPresignedUrlIfNeeded(src);
        if (refreshedUrl !== videoSrc) {
          setVideoSrc(refreshedUrl);
          setError(null);
        } else {
          setError('Video playback failed. Please try refreshing the page.');
        }
      } catch (error) {
        console.error('Failed to refresh presigned URL:', error);
        setError('Video playback failed. Please try refreshing the page.');
      } finally {
        setIsLoading(false);
      }
    } else {
      setError('Video playback failed. Please try refreshing the page.');
    }
  };

  if (!isValidVideoUrl(src)) {
    return (
      <div 
        className={`video-player-wrapper rounded-lg overflow-hidden bg-gray-900 border border-gray-700 flex items-center justify-center ${className}`}
        style={{ aspectRatio: '16/9' }}
      >
        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Video Not Available</h3>
          <p className="text-gray-400 text-sm">This video is still being processed or the file is not accessible.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div 
        className={`video-player-wrapper rounded-lg overflow-hidden bg-gray-900 border border-gray-700 flex items-center justify-center ${className}`}
        style={{ aspectRatio: '16/9' }}
      >
        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-500/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Loading Video</h3>
          <p className="text-gray-400 text-sm">Generating secure access link...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className={`video-player-wrapper rounded-lg overflow-hidden bg-gray-900 border border-gray-700 flex items-center justify-center ${className}`}
        style={{ aspectRatio: '16/9' }}
      >
        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Playback Error</h3>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <button 
              onClick={handleVideoError}
              className="px-4 py-2 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30"
            >
              Retry
            </button>
            <a href={videoSrc} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white border border-white/20">
              Open in new tab
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`video-player-wrapper rounded-lg overflow-hidden ${className}`} style={{ aspectRatio: '16/9' }}>
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        poster={poster}
        style={{ width: '100%', height: '100%', backgroundColor: 'black' }}
        onCanPlay={() => setCanPlay(true)}
        onError={(e) => {
          const target = e.target as HTMLVideoElement;
          const code = (target?.error && target.error.code) || 0;
          let msg = 'Unknown error';
          
          switch (code) {
            case 1:
              msg = 'Video loading was aborted';
              break;
            case 2:
              msg = 'Network error occurred while loading the video';
              break;
            case 3:
              msg = 'Error occurred while decoding the video';
              break;
            case 4:
              msg = 'Video format not supported or CORS issue';
              break;
            default:
              msg = 'Network or CORS issue retrieving the media';
          }
          
          console.error('Video error:', { code, message: msg, src: videoSrc });
          
          // Try to handle the error automatically for Wasabi videos
          if (videoSrc.includes('wasabisys.com')) {
            handleVideoError();
          } else {
            setError(msg);
          }
        }}
      >
        <source src={videoSrc} />
      </video>
    </div>
  );
};

export default VideoPlayer;