// Test script to check if a video URL is accessible
// Usage: node test-video-access.js <video-url>

const videoUrl = process.argv[2];

if (!videoUrl) {
  console.log('Usage: node test-video-access.js <video-url>');
  console.log('Example: node test-video-access.js "https://clipflow-videos.s3.us-central-1.wasabisys.com/438811cc-145c-4275-8079-7e36fae958dc/1757773256000-0vfqp4.mp4"');
  process.exit(1);
}

async function testVideoAccess() {
  try {
    console.log('Testing video URL:', videoUrl);
    
    const response = await fetch(videoUrl, { method: 'HEAD' });
    
    console.log('Response status:', response.status);
    console.log('Response headers:');
    for (const [key, value] of response.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }
    
    if (response.ok) {
      console.log('✅ Video is accessible!');
    } else {
      console.log('❌ Video is not accessible:', response.status, response.statusText);
    }
    
  } catch (error) {
    console.error('❌ Error testing video access:', error.message);
  }
}

testVideoAccess();
