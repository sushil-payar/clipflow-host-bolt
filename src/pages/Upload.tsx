import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import EnhancedUploadProgressComponent from "@/components/EnhancedUploadProgress";
import { uploadVideoWithMultiResolution, EnhancedUploadProgress } from "@/utils/enhanced-upload";
import { formatFileSize } from "@/utils/video-compression";
import { 
  Upload as UploadIcon, 
  FileVideo, 
  X, 
  Zap,
  Monitor,
  Globe
} from "lucide-react";

const Upload = () => {
  const { toast } = useToast();
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<EnhancedUploadProgress | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploadResults, setUploadResults] = useState<any[]>([]);

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

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const commaIndex = result.indexOf(',');
        const base64 = commaIndex >= 0 ? result.substring(commaIndex + 1) : result;
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
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
      setUploadProgress(null);
      setUploadResults([]);

      // Upload each file with optimized compression
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        const result = await uploadVideoWithMultiResolution(
          file,
          i === 0 ? title : `${title} (${i + 1})`,
          description,
          (progress) => {
            setUploadProgress(progress);
          }
        );

        if (!result.success) {
          throw new Error(result.error || 'Upload failed');
        }

        setUploadResults(prev => [...prev, result]);
        
        toast({
          title: "Upload complete!",
          description: `"${i === 0 ? title : `${title} (${i + 1})`}" transcoded to multiple resolutions`,
          duration: 3000,
        });
      }

      toast({
        title: "Success!",
        description: `${files.length} video(s) uploaded with multi-resolution support!`,
      });
      
      // Reset form
      setFiles([]);
      setTitle("");
      setDescription("");
      setUploadResults([]);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload video",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(null);
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
              Upload your videos with optimized compression for faster uploads
            </p>
          </div>

          <div className="grid gap-8">
            {/* Upload Area */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UploadIcon className="w-5 h-5" />
                  Upload & Transcode Videos
                </CardTitle>
                <CardDescription>
                  Upload videos with automatic transcoding to multiple resolutions (240p, 360p, 480p, 720p, 1080p) for instant playback anywhere.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive 
                      ? 'border-primary bg-primary/5' 
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileVideo className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-medium mb-2">
                        Drop your videos here or{" "}
                        <label className="text-primary cursor-pointer hover:underline">
                          browse files
                          <input
                            type="file"
                            multiple
                            accept="video/*"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                        </label>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Supports MP4, MOV, AVI, and other video formats. Auto-transcoded to 5 resolutions.
                      </p>
                    </div>
                    
                    {/* Feature highlights */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Zap className="w-6 h-6 text-blue-500" />
                        <span className="text-sm font-medium">Lightning Fast</span>
                        <span className="text-xs text-muted-foreground">Real-time upload speed monitoring</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <Monitor className="w-6 h-6 text-green-500" />
                        <span className="text-sm font-medium">Multi-Resolution</span>
                        <span className="text-xs text-muted-foreground">240p to 1080p automatic transcoding</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <Globe className="w-6 h-6 text-purple-500" />
                        <span className="text-sm font-medium">Instant Playback</span>
                        <span className="text-xs text-muted-foreground">HLS streaming for global access</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Selected Files */}
                {files.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h3 className="font-medium">Selected Files ({files.length})</h3>
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileVideo className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="text-muted-foreground hover:text-destructive"
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
            <Card>
              <CardHeader>
                <CardTitle>Video Details</CardTitle>
                <CardDescription>
                  Provide information about your video
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter video title..."
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter video description..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Upload Progress */}
            {uploading && uploadProgress && (
              <EnhancedUploadProgressComponent progress={uploadProgress} />
            )}

            {/* Upload Results */}
            {uploadResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-green-500" />
                    Multi-Resolution Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {uploadResults.map((result, index) => (
                    <div key={index} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-sm text-muted-foreground">Resolutions Created</p>
                          <p className="text-lg font-semibold text-blue-500">
                            {result.resolutions ? Object.keys(result.resolutions).length : 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Compression Ratio</p>
                          <p className="text-lg font-semibold text-green-600">
                            {result.compressionRatio ? `${result.compressionRatio.toFixed(1)}%` : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Streaming Format</p>
                          <p className="text-lg font-semibold text-purple-500">
                            HLS Adaptive
                          </p>
                        </div>
                      </div>
                      
                      {result.resolutions && (
                        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <p className="text-sm text-green-700 dark:text-green-300 mb-2">
                            ✓ Video transcoded to multiple resolutions for instant playback:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {Object.keys(result.resolutions).map(resolution => (
                              <span key={resolution} className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded text-xs font-medium">
                                {resolution}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  )}
                </CardContent>
              </Card>
            )}

            {/* Upload Button */}
            <div className="flex justify-center">
              <Button
                onClick={handleUpload}
                disabled={files.length === 0 || uploading || !title.trim()}
                size="lg"
                className="min-w-48"
              >
                {uploading ? (
                  <>
                    <Zap className="w-4 h-4 mr-2 animate-pulse" />
                    {uploadProgress?.stage === 'transcoding' ? 'Transcoding...' : 
                     uploadProgress?.stage === 'uploading' ? 'Uploading...' : 
                     'Processing...'}
                  </>
                ) : (
                  <>
                    <UploadIcon className="w-4 h-4 mr-2" />
                    Upload & Transcode
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;