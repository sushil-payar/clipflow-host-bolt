import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.645.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Enhanced HLS conversion with multiple resolutions
async function convertToMultiResolutionHLS(file: File): Promise<{
  masterPlaylist: string;
  resolutions: { [key: string]: { segments: { name: string; data: Uint8Array }[]; playlist: string; size: number } };
  totalSize: number;
  segmentCount: number;
}> {
  console.log('Starting multi-resolution HLS conversion...')
  
  const arrayBuffer = await file.arrayBuffer()
  const inputData = new Uint8Array(arrayBuffer)
  
  const timestamp = Date.now()
  const tempInputPath = `/tmp/input_${timestamp}.${file.name.split('.').pop()}`
  const hlsOutputDir = `/tmp/hls_${timestamp}`
  
  try {
    await Deno.mkdir(hlsOutputDir, { recursive: true })
    await Deno.writeFile(tempInputPath, inputData)
    
    // Enhanced FFmpeg command for multiple resolutions with instant playback optimization
    const command = new Deno.Command('ffmpeg', {
      args: [
        '-i', tempInputPath,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'veryfast', // Faster encoding
        '-tune', 'zerolatency', // Optimize for instant playback
        '-profile:v', 'baseline', // Better compatibility
        '-level', '3.0',
        '-pix_fmt', 'yuv420p',
        '-hls_time', '4', // 4-second segments for instant seeking
        '-hls_list_size', '0',
        '-hls_segment_filename', `${hlsOutputDir}/segment_%v_%03d.ts`,
        '-hls_playlist_type', 'vod',
        '-hls_flags', 'independent_segments+split_by_time',
        '-f', 'hls',
        '-master_pl_name', 'master.m3u8',
        
        // Multiple resolution streams
        '-map', '0:v:0', '-map', '0:a:0', // 1080p
        '-map', '0:v:0', '-map', '0:a:0', // 720p
        '-map', '0:v:0', '-map', '0:a:0', // 480p
        '-map', '0:v:0', '-map', '0:a:0', // 360p
        '-map', '0:v:0', '-map', '0:a:0', // 240p
        
        // 1080p settings
        '-b:v:0', '5000k', '-s:v:0', '1920x1080', '-maxrate:v:0', '5500k', '-bufsize:v:0', '10000k',
        '-b:a:0', '192k',
        
        // 720p settings
        '-b:v:1', '2500k', '-s:v:1', '1280x720', '-maxrate:v:1', '2750k', '-bufsize:v:1', '5000k',
        '-b:a:1', '128k',
        
        // 480p settings
        '-b:v:2', '1000k', '-s:v:2', '854x480', '-maxrate:v:2', '1100k', '-bufsize:v:2', '2000k',
        '-b:a:2', '96k',
        
        // 360p settings
        '-b:v:3', '600k', '-s:v:3', '640x360', '-maxrate:v:3', '660k', '-bufsize:v:3', '1200k',
        '-b:a:3', '64k',
        
        // 240p settings
        '-b:v:4', '300k', '-s:v:4', '426x240', '-maxrate:v:4', '330k', '-bufsize:v:4', '600k',
        '-b:a:4', '48k',
        
        '-var_stream_map', 'v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p v:3,a:3,name:360p v:4,a:4,name:240p',
        '-y',
        `${hlsOutputDir}/master.m3u8`
      ],
      stdout: 'piped',
      stderr: 'piped'
    })
    
    const { code, stderr } = await command.output()
    
    if (code !== 0) {
      const errorText = new TextDecoder().decode(stderr)
      console.error('FFmpeg error:', errorText)
      throw new Error(`FFmpeg conversion failed: ${errorText}`)
    }
    
    // Read master playlist
    const masterPlaylist = await Deno.readTextFile(`${hlsOutputDir}/master.m3u8`)
    
    // Organize files by resolution
    const resolutions: { [key: string]: { segments: { name: string; data: Uint8Array }[]; playlist: string; size: number } } = {}
    const resolutionLabels = ['1080p', '720p', '480p', '360p', '240p']
    let totalSize = 0
    let totalSegmentCount = 0
    
    for (const resolution of resolutionLabels) {
      const playlistPath = `${hlsOutputDir}/${resolution}.m3u8`
      
      try {
        const playlist = await Deno.readTextFile(playlistPath)
        const segments: { name: string; data: Uint8Array }[] = []
        let resolutionSize = 0
        
        // Find all segment files for this resolution
        for await (const dirEntry of Deno.readDir(hlsOutputDir)) {
          if (dirEntry.name.includes(resolution) && dirEntry.name.endsWith('.ts')) {
            const segmentPath = `${hlsOutputDir}/${dirEntry.name}`
            const data = await Deno.readFile(segmentPath)
            segments.push({ name: dirEntry.name, data })
            resolutionSize += data.length
            totalSegmentCount++
          }
        }
        
        // Add playlist file
        const playlistData = new TextEncoder().encode(playlist)
        segments.push({ name: `${resolution}.m3u8`, data: playlistData })
        resolutionSize += playlistData.length
        
        resolutions[resolution] = {
          segments,
          playlist,
          size: resolutionSize
        }
        
        totalSize += resolutionSize
        console.log(`${resolution}: ${segments.length - 1} segments, ${resolutionSize} bytes`)
      } catch (error) {
        console.warn(`Failed to process ${resolution}:`, error)
      }
    }
    
    console.log(`Multi-resolution HLS conversion complete. Total: ${totalSize} bytes, ${totalSegmentCount} segments`)
    
    return {
      masterPlaylist,
      resolutions,
      totalSize,
      segmentCount: totalSegmentCount
    }
  } finally {
    // Clean up
    try {
      await Deno.remove(tempInputPath)
      await Deno.remove(hlsOutputDir, { recursive: true })
    } catch (e) {
      console.warn('Failed to clean up temp files:', e)
    }
  }
}

serve(async (req) => {
  console.log('=== Multi-Resolution Upload Function Started ===')
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const WASABI_ACCESS_KEY = Deno.env.get('WASABI_ACCESS_KEY')
    const WASABI_SECRET_KEY = Deno.env.get('WASABI_SECRET_KEY')
    const WASABI_REGION = Deno.env.get('WASABI_REGION') || 'us-central-1'
    const WASABI_ENDPOINT = Deno.env.get('WASABI_ENDPOINT') || 'https://s3.us-central-1.wasabisys.com'
    const WASABI_BUCKET = Deno.env.get('WASABI_BUCKET') || 'clipflow-videos'
    
    if (!WASABI_ACCESS_KEY || !WASABI_SECRET_KEY) {
      return new Response(JSON.stringify({ 
        error: 'Wasabi credentials not configured' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ 
        error: 'Supabase credentials not configured' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Authenticate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        error: 'Authorization required' 
      }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(JSON.stringify({ 
        error: 'Invalid authentication' 
      }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse form data
    const formData = await req.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    
    if (!file || !title) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: file and title' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    console.log(`Processing video: ${file.name} (${file.size} bytes)`)
    
    // Convert to multi-resolution HLS
    const hlsResult = await convertToMultiResolutionHLS(file)
    
    // Initialize S3 client
    const s3Client = new S3Client({
      region: WASABI_REGION,
      endpoint: WASABI_ENDPOINT,
      credentials: {
        accessKeyId: WASABI_ACCESS_KEY,
        secretAccessKey: WASABI_SECRET_KEY,
      },
      forcePathStyle: true,
    })
    
    // Generate unique directory
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)
    const hlsDir = `${user.id}/${timestamp}-${randomId}-hls`
    
    // Upload master playlist
    const masterPlaylistKey = `${hlsDir}/master.m3u8`
    await s3Client.send(new PutObjectCommand({
      Bucket: WASABI_BUCKET,
      Key: masterPlaylistKey,
      Body: hlsResult.masterPlaylist,
      ContentType: 'application/vnd.apple.mpegurl',
      ContentDisposition: 'inline',
    }))
    
    // Upload all resolution files
    const resolutionUrls: { [key: string]: { url: string; size: number; bitrate: number } } = {}
    
    for (const [resolution, data] of Object.entries(hlsResult.resolutions)) {
      // Upload playlist
      const playlistKey = `${hlsDir}/${resolution}.m3u8`
      await s3Client.send(new PutObjectCommand({
        Bucket: WASABI_BUCKET,
        Key: playlistKey,
        Body: data.playlist,
        ContentType: 'application/vnd.apple.mpegurl',
        ContentDisposition: 'inline',
      }))
      
      // Upload segments
      for (const segment of data.segments) {
        if (segment.name.endsWith('.ts')) {
          const segmentKey = `${hlsDir}/${segment.name}`
          await s3Client.send(new PutObjectCommand({
            Bucket: WASABI_BUCKET,
            Key: segmentKey,
            Body: segment.data,
            ContentType: 'video/mp2t',
            ContentDisposition: 'inline',
          }))
        }
      }
      
      const resolutionUrl = `${WASABI_ENDPOINT.replace(/\/$/, '')}/${WASABI_BUCKET}/${playlistKey}`
      const bitrate = getBitrateForResolution(resolution)
      
      resolutionUrls[resolution] = {
        url: resolutionUrl,
        size: data.size,
        bitrate
      }
    }
    
    const masterPlaylistUrl = `${WASABI_ENDPOINT.replace(/\/$/, '')}/${WASABI_BUCKET}/${masterPlaylistKey}`
    const compressionRatio = ((file.size - hlsResult.totalSize) / file.size) * 100
    
    // Save to database with resolution metadata
    const { data: videoData, error: dbError } = await supabase
      .from('videos')
      .insert({
        user_id: user.id,
        title: title,
        description: description || null,
        original_filename: file.name,
        file_url: masterPlaylistUrl,
        original_size: file.size,
        file_size: hlsResult.totalSize,
        compression_ratio: compressionRatio,
        status: 'processed'
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(JSON.stringify({ 
        error: `Database error: ${dbError.message}` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    console.log('Multi-resolution video uploaded successfully:', videoData?.id)
    
    return new Response(JSON.stringify({ 
      success: true, 
      videoId: videoData.id,
      video: videoData,
      masterPlaylistUrl,
      resolutions: resolutionUrls,
      compressionRatio,
      originalSize: file.size,
      compressedSize: hlsResult.totalSize,
      segmentCount: hlsResult.segmentCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in multi-resolution upload:', error)
    return new Response(JSON.stringify({ 
      error: `Multi-resolution upload failed: ${error.message}` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}

function getBitrateForResolution(resolution: string): number {
  const bitrateMap: { [key: string]: number } = {
    '1080p': 5000,
    '720p': 2500,
    '480p': 1000,
    '360p': 600,
    '240p': 300
  }
  return bitrateMap[resolution] || 1000
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    
    if (!file || !title) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    return await convertToMultiResolutionHLS(file)
  } catch (error) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})