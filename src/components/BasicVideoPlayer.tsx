import { useEffect, useRef, useState } from 'react';
import { generatePresignedVideoUrl } from '@/utils/presigned-url';

interface BasicVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
}

const BasicVideoPlayer = ({ src, poster, className }: BasicVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addLog = (message: string) => {
    console.log(message);
    setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    setError(null);
    setIsLoading(true);
    setDebugLog([]);
    setVideoSrc('');

    const loadVideo = async () => {
      try {
        addLog(`Starting video load for: ${src}`);
        
        if (src.includes('wasabisys.com')) {
          addLog('Detected Wasabi video, generating presigned URL...');
          try {
            const presignedUrl = await generatePresignedVideoUrl(src);
            addLog(`Presigned URL generated: ${presignedUrl}`);
            setVideoSrc(presignedUrl);
          } catch (presignedError) {
            addLog(`Presigned URL generation failed: ${presignedError}`);
            setError('Failed to generate secure video access');
            setIsLoading(false);
            return;
          }
        } else {
          addLog('Using original URL (not Wasabi)');
          setVideoSrc(src);
        }

        // Set timeout
        setTimeout(() => {
          if (isLoading) {
            addLog('Video loading timeout');
            setError('Video loading timeout');
            setIsLoading(false);
          }
        }, 15000);

      } catch (error) {
        addLog(`Error in loadVideo: ${error}`);
        setError('Failed to load video');
        setIsLoading(false);
      }
    };

    loadVideo();
  }, [src]);

  useEffect(() => {
    if (!videoSrc) return;

    const video = videoRef.current;
    if (!video) return;

    addLog(`Setting video source: ${videoSrc}`);
    video.src = videoSrc;
    video.poster = poster || '';

    const handleLoadStart = () => addLog('Video loadstart event');
    const handleLoadedMetadata = () => addLog('Video loadedmetadata event');
    const handleLoadedData = () => addLog('Video loadeddata event');
    const handleCanPlay = () => {
      addLog('Video canplay event');
      setIsLoading(false);
    };
    const handleError = (e: any) => {
      addLog(`Video error event: ${e}`);
      if (video.error) {
        addLog(`Video error code: ${video.error.code}, message: ${video.error.message}`);
        setError(`Video error: ${video.error.message || 'Unknown error'}`);
      } else {
        setError('Video failed to load');
      }
      setIsLoading(false);
    };

    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, [videoSrc, poster]);

  return (
    <div className={`video-player-wrapper rounded-lg overflow-hidden ${className}`} style={{ aspectRatio: '16/9' }}>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-10">
          <div className="text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-500/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Loading Video</h3>
            <p className="text-gray-400 text-sm">Generating secure access...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-10">
          <div className="text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Video Error</h3>
            <p className="text-gray-400 text-sm mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        style={{ width: '100%', height: '100%', backgroundColor: 'black' }}
      />

      {/* Debug Log */}
      <div className="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
        <h4 className="text-sm font-medium text-white mb-2">Debug Log</h4>
        <div className="text-xs text-gray-400 space-y-1 max-h-32 overflow-y-auto">
          {debugLog.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
        </div>
        <div className="mt-2 text-xs text-gray-500">
          <p><strong>Original URL:</strong> {src}</p>
          <p><strong>Current URL:</strong> {videoSrc || 'Not set'}</p>
          <p><strong>Status:</strong> {isLoading ? 'Loading' : error ? 'Error' : 'Ready'}</p>
        </div>
      </div>
    </div>
  );
};

export default BasicVideoPlayer;
