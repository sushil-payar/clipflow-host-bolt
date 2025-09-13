import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import VideoPlayer from "@/components/VideoPlayer";
import HLSVideoPlayer from "@/components/HLSVideoPlayer";
import { supabase } from "@/integrations/supabase/client";
import { 
  Eye, 
  Calendar, 
  FileVideo, 
  Download,
  Share2,
  ArrowLeft
} from "lucide-react";
import { Link } from "react-router-dom";

const Watch = () => {
  const { videoId } = useParams();
  const [video, setVideo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (videoId) {
      fetchVideo(videoId);
    }
  }, [videoId]);

  const fetchVideo = async (id: string) => {
    try {
      const { data: videoData, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!videoData) {
        throw new Error('Video not found');
      }

      setVideo(videoData);

      // Increment view count
      await supabase
        .from('videos')
        .update({ views: (videoData.views || 0) + 1 })
        .eq('id', id);
        
    } catch (error) {
      console.error('Error fetching video:', error);
      toast({
        title: "Error",
        description: "Video not found or unavailable",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number | null | undefined): string => {
    if (!bytes || bytes === 0 || isNaN(bytes)) return 'Unknown';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isHLSStream = (url: string): boolean => {
    return url.includes('.m3u8') || url.includes('hls') || url.includes('master.m3u8');
  };

  const handleShare = async () => {
    const shareableLink = window.location.href;
    try {
      await navigator.clipboard.writeText(shareableLink);
      toast({
        title: "Link Copied!",
        description: "Video link copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Share Link",
        description: shareableLink,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="pt-24 pb-16 px-6">
          <div className="container mx-auto max-w-4xl">
            <div className="aspect-video bg-video-surface border border-video-border rounded-lg animate-pulse mb-6" />
            <div className="h-8 bg-video-surface rounded mb-4 animate-pulse" />
            <div className="h-4 bg-video-surface rounded w-3/4 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="pt-24 pb-16 px-6">
          <div className="container mx-auto max-w-4xl text-center">
            <FileVideo className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Video Not Found</h1>
            <p className="text-muted-foreground mb-6">
              The video you're looking for doesn't exist or has been removed.
            </p>
            <Link to="/">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="pt-24 pb-16 px-6">
        <div className="container mx-auto max-w-4xl">
          {/* Video Player */}
          <div className="mb-6">
            {isHLSStream(video.file_url) ? (
              <HLSVideoPlayer 
                src={video.file_url}
                poster={video.thumbnail_url}
              />
            ) : (
              <VideoPlayer 
                src={video.file_url}
                poster={video.thumbnail_url}
              />
            )}
            
            {/* Debug Info - Remove in production */}
            <div className="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
              <h4 className="text-sm font-medium text-white mb-2">Debug Info</h4>
              <div className="text-xs text-gray-400 space-y-1">
                <div><strong>Stream Type:</strong> {isHLSStream(video.file_url) ? 'HLS (Adaptive Streaming)' : 'Direct Video'}</div>
                <div><strong>Original URL:</strong> <a href={video.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">{video.file_url}</a></div>
                <div><strong>Status:</strong> {video.status}</div>
                <div><strong>File Size:</strong> {formatFileSize(video.file_size)}</div>
                <div><strong>Created:</strong> {new Date(video.created_at).toLocaleString()}</div>
                <div className="mt-2 p-2 bg-gray-800 rounded text-xs">
                  <strong>Note:</strong> {isHLSStream(video.file_url) 
                    ? 'HLS streaming provides adaptive bitrate for optimal playback on any device.' 
                    : 'The video player will automatically generate a presigned URL for Wasabi videos to ensure access.'
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Video Info */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="bg-video-surface border-video-border">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-2xl mb-2">{video.title}</CardTitle>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {(video.views || 0).toLocaleString()} views
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(video.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleShare}>
                        <Share2 className="w-4 h-4 mr-2" />
                        Share
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => window.open(video.file_url)}>
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {video.description && (
                  <CardContent>
                    <CardDescription className="text-base">
                      {video.description}
                    </CardDescription>
                  </CardContent>
                )}
              </Card>
            </div>

            {/* Video Details Sidebar */}
            <div>
              <Card className="bg-video-surface border-video-border">
                <CardHeader>
                  <CardTitle className="text-lg">Video Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                      {video.status.charAt(0).toUpperCase() + video.status.slice(1)}
                    </Badge>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground">File Size</p>
                    <p className="font-medium">{formatFileSize(video.file_size)}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground">Original Size</p>
                    <p className="font-medium">{formatFileSize(video.original_size)}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground">Compression</p>
                    <p className="font-medium text-green-500">
                      {video.compression_ratio ? `${video.compression_ratio}% saved` : 'Not available'}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground">Original Filename</p>
                    <p className="font-medium text-xs break-all">{video.original_filename}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Watch;