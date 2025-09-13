import { useEffect, useRef, useState } from 'react';
import * as Plyr from 'plyr';
import Hls from 'hls.js';
import 'plyr/dist/plyr.css';
import { generatePresignedVideoUrl } from '@/utils/presigned-url';
import { Play, Pause, Volume2, VolumeX, Maximize, Settings, SkipBack, SkipForward } from 'lucide-react';

interface YouTubeLikePlayerProps {
  src: string;
  poster?: string;
  className?: string;
  title?: string;
}

const YouTubeLikePlayer = ({ src, poster, className, title }: YouTubeLikePlayerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const plyrRef = useRef<Plyr | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

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

  const initializePlayer = async (videoUrl: string) => {
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

    try {
      // Handle Wasabi videos with presigned URLs
      let finalUrl = videoUrl;
      if (videoUrl.includes('wasabisys.com')) {
        console.log('Generating presigned URL for Wasabi video...');
        finalUrl = await generatePresignedVideoUrl(videoUrl);
      }

      // Initialize Plyr with YouTube-like settings
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
          options: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
        },
        keyboard: {
          focused: true,
          global: false
        },
        tooltips: {
          controls: true,
          seek: true
        },
        seekTime: 10,
        ratio: '16:9',
        fullscreen: {
          enabled: true,
          fallback: true,
          iosNative: false
        }
      });

      // Handle HLS streams
      if (isHLSStream(finalUrl)) {
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
          });

          hlsRef.current = hls;

          hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            hls.loadSource(finalUrl);
          });

          hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
            console.log('HLS manifest parsed', data);
            if (data.levels && data.levels.length > 0) {
              console.log('Available quality levels:', data.levels.map(level => `${level.height}p`));
            }
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS error:', data);
            if (data.fatal) {
              setError('Error loading video stream');
              setIsLoading(false);
            }
          });

          hls.attachMedia(video);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = finalUrl;
        } else {
          setError('HLS streaming not supported in this browser');
          setIsLoading(false);
          return;
        }
      } else {
        video.src = finalUrl;
      }

      // Plyr event listeners
      plyrRef.current.on('ready', () => {
        console.log('Player ready');
        setIsLoading(false);
      });

      plyrRef.current.on('play', () => setIsPlaying(true));
      plyrRef.current.on('pause', () => setIsPlaying(false));
      
      plyrRef.current.on('timeupdate', () => {
        if (plyrRef.current) {
          setCurrentTime(plyrRef.current.currentTime);
        }
      });

      plyrRef.current.on('loadedmetadata', () => {
        if (plyrRef.current) {
          setDuration(plyrRef.current.duration);
        }
      });

      plyrRef.current.on('volumechange', () => {
        if (plyrRef.current) {
          setVolume(plyrRef.current.volume);
          setIsMuted(plyrRef.current.muted);
        }
      });

      plyrRef.current.on('error', (event) => {
        console.error('Plyr error:', event);
        setError('Video playback error');
        setIsLoading(false);
      });

    } catch (error) {
      console.error('Error initializing player:', error);
      setError('Failed to initialize video player');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isValidVideoUrl(src)) {
      setError('Invalid video URL');
      setIsLoading(false);
      return;
    }

    initializePlayer(src);

    return () => {
      if (plyrRef.current) {
        plyrRef.current.destroy();
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [src]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isValidVideoUrl(src)) {
    return (
      <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`} style={{ aspectRatio: '16/9' }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
              <Play className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Video Not Available</h3>
            <p className="text-gray-400 text-sm">This video is still being processed or unavailable.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`} style={{ aspectRatio: '16/9' }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
              <Play className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Playback Error</h3>
            <p className="text-gray-400 text-sm mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`} style={{ aspectRatio: '16/9' }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-500/20 rounded-full flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Loading Video</h3>
            <p className="text-gray-400 text-sm">Preparing your video...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-black rounded-lg overflow-hidden shadow-2xl ${className}`} style={{ aspectRatio: '16/9' }}>
      {title && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4">
          <h2 className="text-white font-medium truncate">{title}</h2>
        </div>
      )}
      
      <video
        ref={videoRef}
        playsInline
        preload="metadata"
        poster={poster}
        className="w-full h-full"
        style={{ backgroundColor: 'black' }}
        crossOrigin="anonymous"
      />
      
      {/* Custom overlay for additional YouTube-like features can be added here */}
    </div>
  );
};

export default YouTubeLikePlayer;