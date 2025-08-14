import { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
}

const VideoPlayer = ({ src, poster, className }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!playerRef.current && videoRef.current) {
      const videoElement = document.createElement('video-js');
      videoElement.classList.add('vjs-big-play-centered');
      videoRef.current.appendChild(videoElement);

      const player = (playerRef.current = videojs(videoElement, {
        controls: true,
        responsive: true,
        fluid: true,
        sources: [
          {
            src,
            type: 'video/mp4',
          },
        ],
        poster,
        playbackRates: [0.5, 1, 1.25, 1.5, 2],
        plugins: {
          hotkeys: {
            volumeStep: 0.1,
            seekStep: 5,
            enableModifiersForNumbers: false,
          },
        },
      }));

      // Custom styling for dark theme
      player.ready(() => {
        const playerEl = player.el() as HTMLElement;
        playerEl.style.setProperty('--vjs-theme-forest', '#8b5cf6');
        playerEl.classList.add('vjs-theme-forest');
      });
    }

    return () => {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [src, poster]);

  return (
    <div 
      className={`video-player-wrapper rounded-lg overflow-hidden ${className}`}
      data-vjs-player
    >
      <div ref={videoRef} />
      <style>{`
        .video-js .vjs-big-play-button {
          background-color: rgba(139, 92, 246, 0.8);
          border-color: rgba(139, 92, 246, 0.8);
          border-radius: 50%;
          width: 80px;
          height: 80px;
          line-height: 80px;
          margin-top: -40px;
          margin-left: -40px;
        }
        
        .video-js .vjs-big-play-button:hover {
          background-color: rgba(139, 92, 246, 1);
        }
        
        .video-js .vjs-control-bar {
          background: linear-gradient(180deg, rgba(36, 36, 44, 0) 0%, rgba(36, 36, 44, 0.8) 100%);
        }
        
        .video-js .vjs-progress-control .vjs-progress-holder {
          height: 6px;
        }
        
        .video-js .vjs-progress-control .vjs-play-progress {
          background: linear-gradient(90deg, #8b5cf6, #a855f7);
        }
        
        .video-js .vjs-volume-level {
          background: linear-gradient(90deg, #8b5cf6, #a855f7);
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;