# Wasabi Bucket Setup Instructions

## The Problem
Your Wasabi bucket `clipflow-videos` is not configured for public read access, causing 403 Forbidden errors when trying to play videos.

## Solution: Configure Bucket Policy in Wasabi Console

### Step 1: Access Wasabi Console
1. Go to [Wasabi Console](https://console.wasabisys.com/)
2. Log in with your Wasabi account
3. Navigate to the `clipflow-videos` bucket

### Step 2: Configure Bucket Policy
1. Click on the `clipflow-videos` bucket
2. Go to the "Permissions" tab
3. Click "Bucket Policy"
4. Add the following policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::clipflow-videos/*"
    }
  ]
}
```

### Step 3: Configure CORS (Optional but Recommended)
1. In the same "Permissions" tab
2. Click "CORS"
3. Add the following CORS configuration:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

### Step 4: Test
After applying these settings, your videos should be publicly accessible and playable in the browser.

## Alternative: Use Presigned URLs
If you prefer not to make the bucket public, the application will automatically generate presigned URLs for video access, but this requires the bucket to allow the credentials to access the objects (which it currently does).

## Current Status
- ✅ Wasabi credentials are working
- ✅ Bucket exists and contains videos
- ✅ Objects can be accessed with credentials
- ❌ Bucket is not configured for public access
- ❌ Videos return 403 Forbidden when accessed directly

## Next Steps
1. Apply the bucket policy in Wasabi console
2. Test video playback
3. If still not working, check CORS configuration
