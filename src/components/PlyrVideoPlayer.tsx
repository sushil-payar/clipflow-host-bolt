import { useEffect, useRef, useState } from 'react';
import * as Plyr from 'plyr';
import Hls from 'hls.js';
import 'plyr/dist/plyr.css';
import { generatePresignedVideoUrl, refreshPresignedUrlIfNeeded } from '@/utils/presigned-url';

interface PlyrVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
}

const PlyrVideoPlayer = ({ src, poster, className }: PlyrVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const plyrRef = useRef<Plyr | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videoSrc, setVideoSrc] = useState<string>(src);

  const isValidVideoUrl = (url: string) => {
    if (!url || url.startsWith('placeholder://')) return false;
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';
    } catch {
      return false;
    }
  };

  const isHLSStream = (url: string): boolean => {
    return url.includes('.m3u8') || url.includes('hls') || url.includes('master.m3u8');
  };

  const handlePresignedUrl = async (url: string) => {
    try {
      console.log('Generating presigned URL for:', url);
      const presignedUrl = await generatePresignedVideoUrl(url);
      console.log('Presigned URL generated:', presignedUrl);
      setVideoSrc(presignedUrl);
      return presignedUrl;
    } catch (error) {
      console.error('Failed to generate presigned URL:', error);
      console.log('Falling back to original URL:', url);
      setVideoSrc(url);
      return url;
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

    // Handle presigned URL generation for Wasabi videos
    const initializeVideo = async () => {
      try {
        let finalSrc = src;
        
        if (src.includes('wasabisys.com')) {
          console.log('Detected Wasabi video, generating presigned URL...');
          try {
            finalSrc = await handlePresignedUrl(src);
            console.log('Presigned URL generated successfully');
          } catch (presignedError) {
            console.error('Failed to generate presigned URL:', presignedError);
            setError('Failed to generate secure video access. Please try refreshing the page.');
            setIsLoading(false);
            return;
          }
        } else {
          console.log('Using original URL:', src);
          setVideoSrc(src);
        }

        console.log('Initializing player with URL:', finalSrc);
        await initializePlayer(finalSrc);
      } catch (error) {
        console.error('Error initializing video:', error);
        setError('Failed to load video');
        setIsLoading(false);
      }
    };

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        console.error('Video loading timeout');
        setError('Video loading timeout - please try refreshing');
        setIsLoading(false);
      }
    }, 30000); // 30 second timeout

    initializeVideo();

    return () => {
      clearTimeout(timeoutId);
      if (plyrRef.current) {
        plyrRef.current.destroy();
        plyrRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src]);

  const initializePlayer = async (sourceUrl: string) => {
    const video = videoRef.current;
    if (!video) return;

    // Clean up previous instances
    if (plyrRef.current) {
      plyrRef.current.destroy();
      plyrRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

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
        quality: {
          default: 720,
          options: [1080, 720, 480, 360]
        },
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
        captions: {
          active: false,
          language: 'auto',
          update: false
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

    } catch (plyrError) {
      console.error('Error initializing Plyr:', plyrError);
      setError('Failed to initialize video player');
      setIsLoading(false);
      return;
    }

    if (isHLSStream(sourceUrl)) {
      // Handle HLS streams
      if (Hls.isSupported()) {
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
          hls.loadSource(sourceUrl);
        });

        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          console.log('HLS: Manifest parsed', data);
          
          // Set up quality options for Plyr
          if (data.levels && data.levels.length > 0) {
            console.log('Available quality levels:', data.levels.map(level => `${level.height}p`));
          }
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
        video.src = sourceUrl;
        video.addEventListener('loadedmetadata', () => {
          // Player already initialized above
        });
        video.addEventListener('error', () => {
          setError('Error loading HLS stream');
          setIsLoading(false);
        });
      } else {
        setError('HLS is not supported in this browser');
        setIsLoading(false);
      }
    } else {
      // Handle regular video files
      video.src = sourceUrl;
      video.addEventListener('loadedmetadata', () => {
        // Player already initialized above
      });
      video.addEventListener('error', () => {
        setError('Error loading video');
        setIsLoading(false);
      });
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
          <p className="text-gray-400 text-sm">
            {isHLSStream(src) ? 'Connecting to adaptive video stream...' : 'Loading video player...'}
          </p>
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
        playsInline
        preload="metadata"
        poster={poster}
        style={{ width: '100%', height: '100%', backgroundColor: 'black' }}
        crossOrigin="anonymous"
      />
    </div>
  );
};

export default PlyrVideoPlayer;