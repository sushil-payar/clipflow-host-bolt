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
import { uploadVideoDirectToWasabi } from "@/utils/wasabi-direct-upload";
import { uploadAndCompressVideo } from "@/utils/compressed-upload";
import { compressVideo, formatFileSize, formatCompressionRatio } from "@/utils/video-compression";
import { compressVideoMultiQuality, getOptimalQualityForUpload } from "@/utils/multi-quality-compression";
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
  const [compressionInfo, setCompressionInfo] = useState<{
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    hlsUrl?: string;
    segmentCount?: number;
  } | null>(null);

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
      setUploadProgress(0);
      setCompressionInfo(null);

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

      // Upload each file with optimized compression
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progressBase = (i / files.length) * 100;
        const progressStep = 100 / files.length;
        
        setUploadProgress(progressBase + progressStep * 0.1);

        try {
          // Use optimized multi-quality compression for faster uploads
          console.log('Starting optimized multi-quality compression...');
          const optimalQualities = getOptimalQualityForUpload(file.size);
          
          const compressionResult = await compressVideoMultiQuality(file, optimalQualities);
          
          // Use the smallest compressed version for upload to maximize speed
          const qualityKeys = Object.keys(compressionResult.qualities);
          const fastestQuality = qualityKeys.reduce((smallest, current) => 
            compressionResult.qualities[current].size < compressionResult.qualities[smallest].size ? current : smallest
          );
          
          const compressedFile = compressionResult.qualities[fastestQuality].file;
          const compressionRatio = ((compressionResult.originalSize - compressedFile.size) / compressionResult.originalSize) * 100;
          
          console.log(`Video compressed to ${fastestQuality}: ${formatFileSize(compressionResult.originalSize)} → ${formatFileSize(compressedFile.size)} (${compressionRatio.toFixed(1)}% reduction)`);
          
          setUploadProgress(progressBase + progressStep * 0.3);
          
          const result = await uploadAndCompressVideo(
            compressedFile,
            i === 0 ? title : `${title} (${i + 1})`,
            description
          );

          if (!result.success) {
            throw new Error(result.error || 'Upload failed');
          }

          // Store compression info for the first file
          if (i === 0) {
            setCompressionInfo({
              originalSize: compressionResult.originalSize,
              compressedSize: compressedFile.size,
              compressionRatio: compressionRatio,
              hlsUrl: result.hlsUrl,
              segmentCount: result.segmentCount
            });
          }

          setUploadProgress(progressBase + progressStep);
          
          toast({
            title: "Upload complete!",
            description: `"${i === 0 ? title : `${title} (${i + 1})`}" uploaded in ${fastestQuality} quality (${compressionRatio.toFixed(1)}% smaller)`,
            duration: 3000,
          });

        } catch (compressionError) {
          console.error('Optimized compression failed, trying fallback upload:', compressionError);
          
          toast({
            title: "Using fallback method",
            description: "Optimized compression failed, trying direct upload...",
            duration: 3000,
          });
          
          // Fallback to direct upload
          setUploadProgress(progressBase + progressStep * 0.2);
          
          const directUploadResult = await uploadVideoDirectToWasabi(
            file,
            i === 0 ? title : `${title} (${i + 1})`,
            description,
            supabase
          );

          if (!directUploadResult.success) {
            console.error('Direct upload also failed:', directUploadResult.error);
            throw new Error(directUploadResult.error || 'All upload methods failed');
          }

          console.log('Direct upload successful:', directUploadResult);
          setUploadProgress(progressBase + progressStep);
          
          toast({
            title: "Video uploaded!",
            description: `"${i === 0 ? title : `${title} (${i + 1})`}" uploaded successfully`,
            duration: 3000,
          });
        }
      }

      toast({
        title: "Success!",
        description: `${files.length} video(s) uploaded successfully!`,
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
              Upload your videos with optimized compression for faster uploads
            </p>
          </div>

          <div className="grid gap-8">
            {/* Upload Area */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UploadIcon className="w-5 h-5" />
                  Select Videos
                </CardTitle>
                <CardDescription>
                  Drag and drop videos or click to select files. Large videos will be automatically compressed for faster upload.
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
                        Supports MP4, MOV, AVI, and other video formats
                      </p>
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
            {uploading && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Upload Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Progress value={uploadProgress} className="w-full" />
                    <p className="text-sm text-muted-foreground text-center">
                      {uploadProgress.toFixed(0)}% complete
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Compression Info */}
            {compressionInfo && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    Compression Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Original Size</p>
                      <p className="text-lg font-semibold">
                        {formatFileSize(compressionInfo.originalSize)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Compressed Size</p>
                      <p className="text-lg font-semibold text-green-600">
                        {formatFileSize(compressionInfo.compressedSize)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Space Saved</p>
                      <p className="text-lg font-semibold text-green-600">
                        {formatCompressionRatio(compressionInfo.compressionRatio)}
                      </p>
                    </div>
                  </div>
                  {compressionInfo.hlsUrl && (
                    <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <p className="text-sm text-green-700 dark:text-green-300">
                        ✓ Video successfully converted to HLS with {compressionInfo.segmentCount} segments
                      </p>
                    </div>
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
                className="min-w-40"
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;