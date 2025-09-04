import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import VideoPlayer from "@/components/VideoPlayer";
import { supabase } from "@/integrations/supabase/client";
import { 
  Play, 
  Search, 
  MoreHorizontal, 
  Eye, 
  Download, 
  Share2,
  Calendar,
  FileVideo,
  Users,
  TrendingUp,
  Clock
} from "lucide-react";

const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [videos, setVideos] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalVideos: 0,
    totalViews: 0,
    totalStorage: "0 MB",
    savedStorage: "0 MB"
  });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthAndFetchVideos();
  }, []);

  const checkAuthAndFetchVideos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }
      setUser(user);
      
      // Fetch videos directly here instead of relying on state
      const { data: videosData, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setVideos(videosData || []);
      
      // Calculate stats
      const totalViews = videosData?.reduce((sum, video) => sum + (video.views || 0), 0) || 0;
      const totalSize = videosData?.reduce((sum, video) => sum + (video.file_size || 0), 0) || 0;
      const originalTotalSize = videosData?.reduce((sum, video) => sum + (video.original_size || 0), 0) || 0;
      
      setStats({
        totalVideos: videosData?.length || 0,
        totalViews,
        totalStorage: formatFileSize(totalSize),
        savedStorage: formatFileSize(originalTotalSize - totalSize)
      });
      
    } catch (error) {
      console.error('Error:', error);
      navigate('/auth');
    } finally {
      setLoading(false);
    }
  };

  const fetchVideos = async () => {
    if (!user) return;
    
    try {
      const { data: videosData, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setVideos(videosData || []);
      
      // Calculate stats
      const totalViews = videosData?.reduce((sum, video) => sum + (video.views || 0), 0) || 0;
      const totalSize = videosData?.reduce((sum, video) => sum + (video.file_size || 0), 0) || 0;
      const originalTotalSize = videosData?.reduce((sum, video) => sum + (video.original_size || 0), 0) || 0;
      
      setStats({
        totalVideos: videosData?.length || 0,
        totalViews,
        totalStorage: formatFileSize(totalSize),
        savedStorage: formatFileSize(originalTotalSize - totalSize)
      });
      
    } catch (error) {
      console.error('Error fetching videos:', error);
      toast({
        title: "Error",
        description: "Failed to fetch videos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 MB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getShareableLink = (videoId: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/watch/${videoId}`;
  };

  const handleShare = async (video: any) => {
    const shareableLink = getShareableLink(video.id);
    try {
      await navigator.clipboard.writeText(shareableLink);
      toast({
        title: "Link Copied!",
        description: "Shareable link copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Share Link",
        description: shareableLink,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "processed":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Processed</Badge>;
      case "processing":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Processing</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const filteredVideos = videos.filter(video =>
    video.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="pt-24 pb-16 px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
              <p className="text-muted-foreground">
                Manage your video library and view analytics
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="bg-video-surface border-video-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Videos</p>
                    <p className="text-2xl font-bold">{stats.totalVideos}</p>
                  </div>
                  <FileVideo className="w-8 h-8 text-video-primary" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-video-surface border-video-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Views</p>
                    <p className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</p>
                  </div>
                  <Eye className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-video-surface border-video-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Storage Used</p>
                    <p className="text-2xl font-bold">{stats.totalStorage}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-video-surface border-video-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Storage Saved</p>
                    <p className="text-2xl font-bold text-green-500">{stats.savedStorage}</p>
                  </div>
                  <Users className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="videos" className="space-y-6">
            <TabsList className="bg-video-surface border border-video-border">
              <TabsTrigger value="videos">Videos</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="videos" className="space-y-6">
              {/* Search and Filters */}
              <Card className="bg-video-surface border-video-border">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search videos..."
                        className="pl-10 bg-background border-video-border"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Video Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredVideos.map((video) => (
                  <Card key={video.id} className="bg-video-surface border-video-border group hover:bg-video-surface-hover transition-all duration-300">
                    <CardContent className="p-0">
                      <div className="relative aspect-video bg-video-surface rounded-t-lg overflow-hidden">
                        <img
                          src={video.thumbnail_url || "https://picsum.photos/400/225?random=" + video.id}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                           <Button 
                             variant="ghost" 
                             size="lg" 
                             className="bg-black/20 backdrop-blur-sm hover:bg-black/40"
                             onClick={() => navigate(`/watch/${video.id}`)}
                           >
                             <Play className="w-8 h-8" />
                           </Button>
                         </div>
                        <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-xs font-medium">
                          {video.duration || "0:00"}
                        </div>
                      </div>
                      
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold truncate flex-1 mr-2">{video.title}</h3>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-3">
                          {getStatusBadge(video.status)}
                          <span className="text-xs text-muted-foreground">
                            Compressed {video.compression_ratio}%
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                          <div className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {(video.views || 0).toLocaleString()}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(video.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        
                        <div className="text-xs text-muted-foreground mb-3">
                          {formatFileSize(video.file_size)} (was {formatFileSize(video.original_size)})
                        </div>
                        
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => handleShare(video)}
                          >
                            <Share2 className="w-4 h-4 mr-1" />
                            Share
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => window.open(video.file_url)}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="bg-video-surface border-video-border">
                      <CardContent className="p-0">
                        <div className="aspect-video bg-video-surface rounded-t-lg animate-pulse" />
                        <div className="p-4">
                          <div className="h-4 bg-video-surface rounded mb-2 animate-pulse" />
                          <div className="h-3 bg-video-surface rounded w-3/4 animate-pulse" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredVideos.length === 0 ? (
                <Card className="bg-video-surface border-video-border">
                  <CardContent className="p-12 text-center">
                    <FileVideo className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No videos found</h3>
                    <p className="text-muted-foreground">
                      {searchQuery ? "Try adjusting your search query" : "Upload your first video to get started"}
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <Card className="bg-video-surface border-video-border">
                <CardHeader>
                  <CardTitle>Analytics Overview</CardTitle>
                  <CardDescription>
                    Detailed insights about your video performance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Analytics Coming Soon</h3>
                    <p className="text-muted-foreground">
                      Detailed analytics and insights will be available once backend integration is complete
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;