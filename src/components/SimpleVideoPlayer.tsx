import { useEffect, useRef, useState } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

interface SimpleVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
}

const SimpleVideoPlayer = ({ src, poster, className }: SimpleVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const plyrRef = useRef<Plyr | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    setIsLoading(true);

    if (!isValidVideoUrl(src)) {
      setError('Invalid video URL');
      setIsLoading(false);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    // Clean up previous instance
    if (plyrRef.current) {
      plyrRef.current.destroy();
      plyrRef.current = null;
    }

    // Set video source directly
    video.src = src;
    video.poster = poster || '';

    // Initialize Plyr
    try {
      plyrRef.current = new Plyr(video, {
        controls: [
          'play-large',
          'restart',
          'rewind',
          'play',
          'fast-forward',
          'progress',
          'current-time',
          'duration',
          'mute',
          'volume',
          'settings',
          'pip',
          'airplay',
          'fullscreen'
        ],
        settings: ['quality', 'speed'],
        speed: {
          selected: 1,
          options: [0.5, 0.75, 1, 1.25, 1.5, 2]
        },
        keyboard: {
          focused: true,
          global: false
        },
        tooltips: {
          controls: true,
          seek: true
        },
        fullscreen: {
          enabled: true,
          fallback: true,
          iosNative: false
        },
        ratio: '16:9'
      });

      // Handle Plyr events
      plyrRef.current.on('ready', () => {
        console.log('Plyr player ready');
        setIsLoading(false);
      });

      plyrRef.current.on('error', (event) => {
        console.error('Plyr error:', event);
        setError('Video playback error');
        setIsLoading(false);
      });

      plyrRef.current.on('loadstart', () => {
        console.log('Video loading started');
      });

      plyrRef.current.on('canplay', () => {
        console.log('Video can start playing');
        setIsLoading(false);
      });

      // Handle video events directly
      video.addEventListener('loadstart', () => {
        console.log('Video loadstart event');
      });

      video.addEventListener('canplay', () => {
        console.log('Video canplay event');
        setIsLoading(false);
      });

      video.addEventListener('error', (e) => {
        console.error('Video error event:', e);
        setError('Video failed to load');
        setIsLoading(false);
      });

      video.addEventListener('loadeddata', () => {
        console.log('Video loadeddata event');
        setIsLoading(false);
      });

    } catch (plyrError) {
      console.error('Error initializing Plyr:', plyrError);
      setError('Failed to initialize video player');
      setIsLoading(false);
    }

    return () => {
      if (plyrRef.current) {
        plyrRef.current.destroy();
        plyrRef.current = null;
      }
    };
  }, [src, poster]);

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
          <p className="text-gray-400 text-sm">Loading video player...</p>
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
          <div className="space-y-2">
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30"
            >
              Retry
            </button>
            <div className="text-xs text-gray-500">
              <p>URL: {src}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`video-player-wrapper rounded-lg overflow-hidden ${className}`} style={{ aspectRatio: '16/9' }}>
      <video
        ref={videoRef}
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        style={{ width: '100%', height: '100%', backgroundColor: 'black' }}
      />
    </div>
  );
};

export default SimpleVideoPlayer;
