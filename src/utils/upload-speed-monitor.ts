export interface UploadSpeedInfo {
  bytesUploaded: number;
  totalBytes: number;
  speed: number; // bytes per second
  timeElapsed: number; // seconds
  timeRemaining: number; // seconds
  percentage: number;
}

export class UploadSpeedMonitor {
  private startTime: number;
  private lastUpdateTime: number;
  private lastBytesUploaded: number;
  private speedHistory: number[] = [];
  private readonly maxHistorySize = 10;

  constructor() {
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;
    this.lastBytesUploaded = 0;
  }

  update(bytesUploaded: number, totalBytes: number): UploadSpeedInfo {
    const now = Date.now();
    const timeElapsed = (now - this.startTime) / 1000;
    const timeSinceLastUpdate = (now - this.lastUpdateTime) / 1000;
    
    // Calculate instantaneous speed
    const bytesSinceLastUpdate = bytesUploaded - this.lastBytesUploaded;
    const instantSpeed = timeSinceLastUpdate > 0 ? bytesSinceLastUpdate / timeSinceLastUpdate : 0;
    
    // Add to speed history for smoothing
    this.speedHistory.push(instantSpeed);
    if (this.speedHistory.length > this.maxHistorySize) {
      this.speedHistory.shift();
    }
    
    // Calculate average speed
    const averageSpeed = this.speedHistory.reduce((sum, speed) => sum + speed, 0) / this.speedHistory.length;
    
    // Calculate time remaining
    const remainingBytes = totalBytes - bytesUploaded;
    const timeRemaining = averageSpeed > 0 ? remainingBytes / averageSpeed : 0;
    
    // Update tracking variables
    this.lastUpdateTime = now;
    this.lastBytesUploaded = bytesUploaded;
    
    return {
      bytesUploaded,
      totalBytes,
      speed: averageSpeed,
      timeElapsed,
      timeRemaining,
      percentage: (bytesUploaded / totalBytes) * 100
    };
  }

  formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  }

  formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds.toFixed(0)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(0)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }
}