import { useEffect, useRef, useState, useCallback } from 'react';
import { generatePresignedVideoUrl } from '@/utils/presigned-url';
import Hls from 'hls.js';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Settings, 
  SkipBack, 
  SkipForward,
  Loader2,
  Minimize
} from 'lucide-react';

interface AdaptiveVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  title?: string;
}

const AdaptiveVideoPlayer = ({ src, poster, className, title }: AdaptiveVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [hlsLevels, setHlsLevels] = useState<any[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [buffered, setBuffered] = useState(0);

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

  const initializeHLS = useCallback((sourceUrl: string) => {
    const video = videoRef.current;
    if (!video) return;

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.1,
        startLevel: -1, // Auto quality
        abrEwmaDefaultEstimate: 1000000, // Start with 1Mbps estimate
        abrBandWidthFactor: 0.95,
        abrBandWidthUpFactor: 0.7,
      });

      hlsRef.current = hls;

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        console.log('HLS: Media attached');
        hls.loadSource(sourceUrl);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        console.log('HLS: Manifest parsed', data);
        setHlsLevels(data.levels);
        setIsLoading(false);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        setCurrentLevel(data.level);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS Error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Network error, trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Media error, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              setError('Fatal error in adaptive stream');
              break;
          }
        }
      });

      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = sourceUrl;
      setIsLoading(false);
    } else {
      setError('Adaptive streaming not supported in this browser');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isValidVideoUrl(src)) {
      setError('Invalid video URL');
      setIsLoading(false);
      return;
    }

    const initializeVideo = async () => {
      try {
        let finalSrc = src;
        
        if (src.includes('wasabisys.com')) {
          console.log('Generating presigned URL for Wasabi video...');
          finalSrc = await generatePresignedVideoUrl(src);
          console.log('Presigned URL generated:', finalSrc);
        }
        
        setVideoSrc(finalSrc);
        
        if (isHLSStream(finalSrc)) {
          initializeHLS(finalSrc);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error setting up video:', error);
        setError('Failed to load video');
        setIsLoading(false);
      }
    };

    initializeVideo();
  }, [src, initializeHLS]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    setCurrentTime(video.currentTime);
    
    // Update buffered progress
    if (video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      setBuffered((bufferedEnd / video.duration) * 100);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    setIsLoading(false);
  }, []);

  const handlePlay = useCallback(() => setIsPlaying(true), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);

  const handleVolumeChange = useCallback((newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      video.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      video.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const progress = progressRef.current;
    if (!video || !progress) return;

    const rect = progress.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const time = pos * duration;
    
    video.currentTime = time;
    setCurrentTime(time);
  }, [duration]);

  const skip = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
  }, [duration]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, [isFullscreen]);

  const changePlaybackRate = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettings(false);
  }, []);

  const changeQuality = useCallback((level: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = level;
      setCurrentLevel(level);
    }
    setShowSettings(false);
  }, []);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const resetControlsTimer = () => {
      clearTimeout(timeout);
      setShowControls(true);
      timeout = setTimeout(() => {
        if (isPlaying && !showSettings) setShowControls(false);
      }, 3000);
    };

    if (isPlaying) {
      resetControlsTimer();
    } else {
      setShowControls(true);
    }

    return () => clearTimeout(timeout);
  }, [isPlaying, showSettings]);

  if (!isValidVideoUrl(src)) {
    return (
      <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`} style={{ aspectRatio: '16/9' }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
              <Play className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Video Not Available</h3>
            <p className="text-gray-400 text-sm">This video is not accessible or still being processed.</p>
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
              className="px-4 py-2 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`relative bg-black rounded-lg overflow-hidden shadow-2xl group ${className}`} 
      style={{ aspectRatio: '16/9' }}
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && !showSettings && setShowControls(false)}
    >
      {title && (
        <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/70 to-transparent p-4">
          <h2 className="text-white font-medium truncate">{title}</h2>
        </div>
      )}
      
      {videoSrc && (
        <video
          ref={videoRef}
          src={!isHLSStream(videoSrc) ? videoSrc : undefined}
          poster={poster}
          className="w-full h-full object-cover"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onPause={handlePause}
          onError={() => setError('Video playback error')}
          preload="metadata"
          crossOrigin="anonymous"
          playsInline
        />
      )}

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
            <p className="text-white text-sm">
              {isHLSStream(videoSrc) ? 'Loading adaptive stream...' : 'Loading video...'}
            </p>
          </div>
        </div>
      )}

      {/* Play/Pause Overlay */}
      <div 
        className="absolute inset-0 flex items-center justify-center cursor-pointer"
        onClick={togglePlay}
      >
        {!isPlaying && !isLoading && (
          <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-all duration-200">
            <Play className="w-10 h-10 text-white ml-1" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ paddingTop: '60px' }}
      >
        {/* Progress Bar */}
        <div className="px-4 pb-4">
          <div 
            ref={progressRef}
            className="w-full h-1 bg-white/30 rounded-full cursor-pointer group/progress hover:h-2 transition-all duration-200"
            onClick={handleSeek}
          >
            {/* Buffered Progress */}
            <div 
              className="absolute h-full bg-white/50 rounded-full"
              style={{ width: `${buffered}%` }}
            />
            {/* Current Progress */}
            <div 
              className="h-full bg-red-500 rounded-full relative group-hover/progress:bg-red-400 transition-colors"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            >
              <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full opacity-0 group-hover/progress:opacity-100 transition-all duration-200" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 pb-4">
          <div className="flex items-center space-x-4">
            <button onClick={togglePlay} className="text-white hover:text-red-400 transition-colors">
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>
            
            <button onClick={() => skip(-10)} className="text-white hover:text-red-400 transition-colors">
              <SkipBack className="w-5 h-5" />
            </button>
            
            <button onClick={() => skip(10)} className="text-white hover:text-red-400 transition-colors">
              <SkipForward className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2">
              <button onClick={toggleMute} className="text-white hover:text-red-400 transition-colors">
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-20 h-1 bg-white/30 rounded-full appearance-none cursor-pointer hover:bg-white/40 transition-colors"
              />
            </div>

            <span className="text-white text-sm font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            
            {isHLSStream(videoSrc) && currentLevel >= 0 && hlsLevels[currentLevel] && (
              <span className="text-red-400 text-xs font-medium">
                AUTO {hlsLevels[currentLevel].height}p
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-white hover:text-red-400 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>

              {showSettings && (
                <div className="absolute bottom-8 right-0 bg-black/95 backdrop-blur-md rounded-lg p-3 min-w-48 max-h-80 overflow-y-auto border border-white/20">
                  {/* Quality Settings */}
                  {isHLSStream(videoSrc) && hlsLevels.length > 0 && (
                    <div className="mb-4">
                      <div className="text-white text-sm font-medium mb-2">Quality</div>
                      <div
                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-white/10 rounded transition-colors ${
                          currentLevel === -1 ? 'bg-red-500/20 text-red-400' : 'text-white'
                        }`}
                        onClick={() => changeQuality(-1)}
                      >
                        🎯 Auto (Recommended)
                      </div>
                      {hlsLevels.map((level, index) => (
                        <div
                          key={index}
                          className={`px-3 py-2 text-sm cursor-pointer hover:bg-white/10 rounded transition-colors ${
                            currentLevel === index ? 'bg-red-500/20 text-red-400' : 'text-white'
                          }`}
                          onClick={() => changeQuality(index)}
                        >
                          {level.height}p ({Math.round(level.bitrate / 1000)}k)
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Speed Settings */}
                  <div>
                    <div className="text-white text-sm font-medium mb-2">Speed</div>
                    {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                      <div
                        key={rate}
                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-white/10 rounded transition-colors ${
                          playbackRate === rate ? 'bg-red-500/20 text-red-400' : 'text-white'
                        }`}
                        onClick={() => changePlaybackRate(rate)}
                      >
                        {rate === 1 ? 'Normal' : `${rate}x`}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button onClick={toggleFullscreen} className="text-white hover:text-red-400 transition-colors">
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdaptiveVideoPlayer;