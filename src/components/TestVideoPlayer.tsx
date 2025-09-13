import { useEffect, useRef, useState } from 'react';

interface TestVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
}

const TestVideoPlayer = ({ src, poster, className }: TestVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebugInfo = (info: string) => {
    console.log(info);
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${info}`]);
  };

  useEffect(() => {
    setError(null);
    setIsLoading(true);
    setDebugInfo([]);

    const video = videoRef.current;
    if (!video) return;

    addDebugInfo(`Starting video load for: ${src}`);

    // Test if URL is accessible
    const testUrl = async () => {
      try {
        addDebugInfo('Testing URL accessibility...');
        const response = await fetch(src, { method: 'HEAD' });
        addDebugInfo(`URL test response: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
          addDebugInfo(`URL not accessible: ${response.status}`);
          setError(`Video not accessible: ${response.status} ${response.statusText}`);
          setIsLoading(false);
          return false;
        }
        return true;
      } catch (err) {
        addDebugInfo(`URL test failed: ${err}`);
        addDebugInfo('Continuing with video load anyway...');
        return true; // Continue anyway
      }
    };

    const loadVideo = async () => {
      const urlAccessible = await testUrl();
      
      addDebugInfo('Setting video source...');
      video.src = src;
      video.poster = poster || '';
      
      // Add comprehensive event listeners
      const events = [
        'loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 
        'canplaythrough', 'error', 'stalled', 'suspend', 'abort'
      ];
      
      events.forEach(event => {
        video.addEventListener(event, () => {
          addDebugInfo(`Video event: ${event}`);
          if (event === 'canplay' || event === 'canplaythrough') {
            setIsLoading(false);
          }
          if (event === 'error') {
            const error = video.error;
            if (error) {
              addDebugInfo(`Video error code: ${error.code}, message: ${error.message}`);
              setError(`Video error: ${error.message || 'Unknown error'}`);
            }
            setIsLoading(false);
          }
        });
      });

      // Set a timeout
      setTimeout(() => {
        if (isLoading) {
          addDebugInfo('Video loading timeout after 15 seconds');
          setError('Video loading timeout');
          setIsLoading(false);
        }
      }, 15000);
    };

    loadVideo();

    return () => {
      // Cleanup
    };
  }, [src, poster]);

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
            <p className="text-gray-400 text-sm">Testing video accessibility...</p>
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

      {/* Debug Info */}
      <div className="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
        <h4 className="text-sm font-medium text-white mb-2">Debug Log</h4>
        <div className="text-xs text-gray-400 space-y-1 max-h-32 overflow-y-auto">
          {debugInfo.map((info, index) => (
            <div key={index}>{info}</div>
          ))}
        </div>
        <div className="mt-2 text-xs text-gray-500">
          <p><strong>URL:</strong> {src}</p>
          <p><strong>Status:</strong> {isLoading ? 'Loading' : error ? 'Error' : 'Ready'}</p>
        </div>
      </div>
    </div>
  );
};

export default TestVideoPlayer;
