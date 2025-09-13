// Test script to check video URL accessibility
const testVideoUrl = async (url) => {
  console.log('🔍 Testing video URL accessibility...');
  console.log('URL:', url);
  
  try {
    // Test with HEAD request first
    console.log('Testing HEAD request...');
    const headResponse = await fetch(url, { method: 'HEAD' });
    console.log('HEAD Response:', {
      status: headResponse.status,
      statusText: headResponse.statusText,
      headers: Object.fromEntries(headResponse.headers.entries())
    });
    
    if (headResponse.ok) {
      console.log('✅ URL is accessible via HEAD request');
    } else {
      console.log('❌ URL not accessible via HEAD request');
    }
    
    // Test with GET request (first few bytes)
    console.log('Testing GET request (first 1KB)...');
    const getResponse = await fetch(url, { 
      method: 'GET',
      headers: { 'Range': 'bytes=0-1023' }
    });
    console.log('GET Response:', {
      status: getResponse.status,
      statusText: getResponse.statusText,
      headers: Object.fromEntries(getResponse.headers.entries())
    });
    
    if (getResponse.ok) {
      console.log('✅ URL is accessible via GET request');
    } else {
      console.log('❌ URL not accessible via GET request');
    }
    
  } catch (error) {
    console.error('❌ Error testing URL:', error);
  }
};

// Test with a sample Wasabi URL
const sampleUrl = 'https://clipflow-videos.s3.us-central-1.wasabisys.com/438811cc-145c-4275-8079-7e36fae958dc/1757789133636-aftpzk.mp4';
testVideoUrl(sampleUrl);