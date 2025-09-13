import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface HLSVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
}

const HLSVideoPlayer = ({ src, poster, className }: HLSVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isValidHLSUrl = (url: string) => {
    if (!url || url.startsWith('placeholder://')) return false;
    try {
      const parsedUrl = new URL(url);
      return (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') && 
             (url.includes('.m3u8') || url.includes('hls'));
    } catch {
      return false;
    }
  };

  useEffect(() => {
    setError(null);
    setIsLoading(true);

    if (!isValidHLSUrl(src)) {
      setError('Invalid HLS stream URL');
      setIsLoading(false);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      // Use HLS.js for browsers that don't support native HLS
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 5,
      });

      hlsRef.current = hls;

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        console.log('HLS: Media attached');
        hls.loadSource(src);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS: Manifest parsed, starting playback');
        setIsLoading(false);
        video.play().catch(console.error);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS Error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError('Network error loading HLS stream');
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError('Media error in HLS stream');
              break;
            default:
              setError('Fatal error in HLS stream');
              break;
          }
          setIsLoading(false);
        }
      });

      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = src;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        video.play().catch(console.error);
      });
      video.addEventListener('error', () => {
        setError('Error loading HLS stream');
        setIsLoading(false);
      });
    } else {
      setError('HLS is not supported in this browser');
      setIsLoading(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src]);

  if (!isValidHLSUrl(src)) {
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
          <h3 className="text-lg font-semibold text-white mb-2">HLS Stream Not Available</h3>
          <p className="text-gray-400 text-sm">This HLS stream is not accessible or still being processed.</p>
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
          <h3 className="text-lg font-semibold text-white mb-2">Loading HLS Stream</h3>
          <p className="text-gray-400 text-sm">Connecting to adaptive video stream...</p>
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
          <h3 className="text-lg font-semibold text-white mb-2">HLS Playback Error</h3>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30"
          >
            Retry
          </button>
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
        poster={poster}
        style={{ width: '100%', height: '100%', backgroundColor: 'black' }}
        onError={(e) => {
          const target = e.target as HTMLVideoElement;
          console.error('Video error:', target.error);
          setError('Video playback failed');
        }}
      />
    </div>
  );
};

export default HLSVideoPlayer;
