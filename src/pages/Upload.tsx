import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import { supabase } from "@/integrations/supabase/client";
import { 
  Upload as UploadIcon, 
  FileVideo, 
  X, 
  CheckCircle,
  AlertCircle,
  Clock
} from "lucide-react";

const Upload = () => {
  const { toast } = useToast();
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('video/')
    );
    
    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
      toast({
        title: "Files added",
        description: `${droppedFiles.length} video file(s) ready for upload`,
      });
    }
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter(
      file => file.type.startsWith('video/')
    );
    
    if (selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...selectedFiles]);
      toast({
        title: "Files selected",
        description: `${selectedFiles.length} video file(s) ready for upload`,
      });
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select video files to upload",
        variant: "destructive",
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a title for your video",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!user || !session) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to upload videos.",
          variant: "destructive",
        });
        setUploading(false);
        return;
      }

      // Upload each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progressBase = (i / files.length) * 100;
        const progressStep = 100 / files.length;
        
        setUploadProgress(progressBase + progressStep * 0.2);

        // Convert file to base64
        const fileBuffer = await file.arrayBuffer();
        const base64File = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
        
        setUploadProgress(progressBase + progressStep * 0.5);

        // Upload to Wasabi via edge function
        const { data, error } = await supabase.functions.invoke('upload-to-wasabi', {
          body: {
            file: base64File,
            fileName: file.name,
            contentType: file.type,
            title: i === 0 ? title : `${title} (${i + 1})`,
            description,
            originalSize: file.size
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        setUploadProgress(progressBase + progressStep);
      }

      toast({
        title: "Success!",
        description: `${files.length} video(s) uploaded to Wasabi successfully!`,
      });
      
      // Reset form
      setFiles([]);
      setTitle("");
      setDescription("");
      
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload video",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="pt-24 pb-16 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">Upload Videos</h1>
            <p className="text-muted-foreground text-lg">
              Upload your videos for automatic compression and cloud hosting
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Upload Area */}
            <Card className="bg-video-surface border-video-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileVideo className="w-5 h-5" />
                  Select Videos
                </CardTitle>
                <CardDescription>
                  Drag and drop your video files or click to browse
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 ${
                    dragActive 
                      ? 'border-video-primary bg-video-primary/10' 
                      : 'border-video-border hover:border-video-primary/50'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <UploadIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">
                    Drop your videos here
                  </p>
                  <p className="text-muted-foreground mb-4">
                    Supports MP4, MOV, AVI, and more
                  </p>
                  <Button variant="upload" onClick={() => document.getElementById('file-input')?.click()}>
                    Browse Files
                  </Button>
                  <input
                    id="file-input"
                    type="file"
                    multiple
                    accept="video/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>

                {/* File List */}
                {files.length > 0 && (
                  <div className="mt-6 space-y-2">
                    <h3 className="font-medium mb-3">Selected Files ({files.length})</h3>
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-background rounded-lg border border-video-border"
                      >
                        <div className="flex items-center gap-3">
                          <FileVideo className="w-5 h-5 text-video-primary" />
                          <div>
                            <p className="font-medium truncate max-w-48">{file.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Video Details */}
            <Card className="bg-video-surface border-video-border">
              <CardHeader>
                <CardTitle>Video Details</CardTitle>
                <CardDescription>
                  Add title and description for your videos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter video title"
                    className="bg-background border-video-border"
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter video description"
                    rows={4}
                    className="bg-background border-video-border"
                  />
                </div>

                {/* Upload Progress */}
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Uploading...</span>
                      <span className="text-sm text-muted-foreground">{Math.round(uploadProgress)}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}

                <Button 
                  className="w-full" 
                  variant="hero"
                  onClick={handleUpload}
                  disabled={uploading || files.length === 0}
                >
                  {uploading ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <UploadIcon className="w-4 h-4 mr-2" />
                      Upload Videos
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Info Cards */}
          <div className="grid md:grid-cols-3 gap-4 mt-8">
            <Card className="bg-video-surface border-video-border">
              <CardContent className="p-4 text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <h3 className="font-medium mb-1">Auto Compression</h3>
                <p className="text-sm text-muted-foreground">
                  Videos compressed to 70-80% automatically
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-video-surface border-video-border">
              <CardContent className="p-4 text-center">
                <AlertCircle className="w-8 h-8 text-video-primary mx-auto mb-2" />
                <h3 className="font-medium mb-1">Cloud Storage</h3>
                <p className="text-sm text-muted-foreground">
                  Secure storage on Wasabi cloud
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-video-surface border-video-border">
              <CardContent className="p-4 text-center">
                <Clock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <h3 className="font-medium mb-1">Fast Processing</h3>
                <p className="text-sm text-muted-foreground">
                  Quick compression and upload
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Backend Integration Notice */}
          <Card className="mt-8 bg-yellow-500/10 border-yellow-500/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-medium text-yellow-500 mb-2">Backend Integration Required</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    To enable video compression and Wasabi storage upload, you'll need to connect your Lovable project to Supabase. 
                    This will allow us to create the backend functions for processing and storing your videos.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Click the green Supabase button in the top-right corner to get started.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Upload;