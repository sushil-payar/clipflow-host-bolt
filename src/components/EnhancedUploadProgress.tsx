import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { EnhancedUploadProgress, UploadSpeedInfo } from "@/utils/enhanced-upload";
import { TranscodingProgress } from "@/utils/multi-resolution-transcoding";
import { 
  Clock, 
  Zap, 
  Upload, 
  Settings, 
  CheckCircle,
  AlertCircle,
  Loader2
} from "lucide-react";

interface EnhancedUploadProgressProps {
  progress: EnhancedUploadProgress;
}

const EnhancedUploadProgressComponent = ({ progress }: EnhancedUploadProgressProps) => {
  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'preparing': return <Settings className="w-5 h-5" />;
      case 'transcoding': return <Zap className="w-5 h-5" />;
      case 'uploading': return <Upload className="w-5 h-5" />;
      case 'finalizing': return <Clock className="w-5 h-5" />;
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-500" />;
      default: return <Loader2 className="w-5 h-5 animate-spin" />;
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'completed': return 'text-green-500';
      case 'transcoding': return 'text-blue-500';
      case 'uploading': return 'text-purple-500';
      default: return 'text-muted-foreground';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className="bg-video-surface border-video-border">
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 ${getStageColor(progress.stage)}`}>
          {getStageIcon(progress.stage)}
          {progress.stage.charAt(0).toUpperCase() + progress.stage.slice(1)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span>{progress.overallProgress.toFixed(1)}%</span>
          </div>
          <Progress value={progress.overallProgress} className="h-2" />
          <p className="text-sm text-muted-foreground">{progress.message}</p>
        </div>

        {/* Upload Speed Info */}
        {progress.uploadSpeed && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-background rounded-lg border border-video-border">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Upload Speed</p>
              <p className="font-semibold text-blue-500">
                {progress.uploadSpeed.speed > 0 ? 
                  new UploadSpeedMonitor().formatSpeed(progress.uploadSpeed.speed) : 
                  'Calculating...'
                }
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Uploaded</p>
              <p className="font-semibold">
                {formatFileSize(progress.uploadSpeed.bytesUploaded)} / {formatFileSize(progress.uploadSpeed.totalBytes)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Time Elapsed</p>
              <p className="font-semibold">
                {new UploadSpeedMonitor().formatTime(progress.uploadSpeed.timeElapsed)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Time Remaining</p>
              <p className="font-semibold text-green-500">
                {progress.uploadSpeed.timeRemaining > 0 ? 
                  new UploadSpeedMonitor().formatTime(progress.uploadSpeed.timeRemaining) : 
                  'Calculating...'
                }
              </p>
            </div>
          </div>
        )}

        {/* Transcoding Progress */}
        {progress.transcodingProgress && (
          <div className="space-y-3">
            <h4 className="font-medium">Resolution Transcoding</h4>
            <div className="grid gap-3">
              {Object.entries(progress.transcodingProgress).map(([resolution, resProgress]) => (
                <div key={resolution} className="flex items-center gap-3 p-3 bg-background rounded-lg border border-video-border">
                  <div className="flex items-center gap-2 min-w-20">
                    {resProgress.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                    {resProgress.status === 'processing' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                    {resProgress.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                    {resProgress.status === 'pending' && <Clock className="w-4 h-4 text-muted-foreground" />}
                    <span className="text-sm font-medium">{resolution}</span>
                  </div>
                  
                  <div className="flex-1">
                    <Progress value={resProgress.progress} className="h-1.5" />
                  </div>
                  
                  <div className="text-right min-w-16">
                    <Badge variant={
                      resProgress.status === 'completed' ? 'default' :
                      resProgress.status === 'processing' ? 'secondary' :
                      resProgress.status === 'error' ? 'destructive' : 'outline'
                    }>
                      {resProgress.progress.toFixed(0)}%
                    </Badge>
                  </div>
                  
                  {resProgress.fileSize && (
                    <div className="text-xs text-muted-foreground min-w-16 text-right">
                      {formatFileSize(resProgress.fileSize)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stage Indicators */}
        <div className="flex justify-between items-center">
          {['preparing', 'transcoding', 'uploading', 'finalizing', 'completed'].map((stage, index) => (
            <div key={stage} className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                progress.stage === stage 
                  ? 'border-primary bg-primary text-primary-foreground' 
                  : index < ['preparing', 'transcoding', 'uploading', 'finalizing', 'completed'].indexOf(progress.stage)
                    ? 'border-green-500 bg-green-500 text-white'
                    : 'border-muted bg-background text-muted-foreground'
              }`}>
                {index < ['preparing', 'transcoding', 'uploading', 'finalizing', 'completed'].indexOf(progress.stage) ? (
                  <CheckCircle className="w-4 h-4" />
                ) : progress.stage === stage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span className="text-xs font-bold">{index + 1}</span>
                )}
              </div>
              <span className="text-xs text-center capitalize">{stage}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedUploadProgressComponent;