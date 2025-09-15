import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.645.0";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.645.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// HLS conversion function using FFmpeg
async function convertToHLS(file: File): Promise<{
  masterPlaylist: string;
  segments: { name: string; data: Uint8Array }[];
  compressedSize: number;
}> {
  console.log('Starting HLS conversion...')
  
  // Convert file to array buffer
  const arrayBuffer = await file.arrayBuffer()
  const inputData = new Uint8Array(arrayBuffer)
  
  // Create temporary directory for HLS output
  const timestamp = Date.now()
  const tempInputPath = `/tmp/input_${timestamp}.${file.name.split('.').pop()}`
  const hlsOutputDir = `/tmp/hls_${timestamp}`
  const masterPlaylistPath = `${hlsOutputDir}/master.m3u8`
  
  try {
    // Create HLS output directory
    await Deno.mkdir(hlsOutputDir, { recursive: true })
    
    // Write input file
    await Deno.writeFile(tempInputPath, inputData)
    
    // Run FFmpeg HLS conversion command with multiple bitrates and 80% compression
    const command = new Deno.Command('ffmpeg', {
      args: [
        '-i', tempInputPath,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-b:a', '96k', // Reduced audio bitrate for compression
        '-preset', 'medium', // Better compression than 'fast'
        '-crf', '28', // 80% compression - higher CRF = more compression
        '-hls_time', '6', // Smaller segments for instant seeking
        '-hls_list_size', '0', // Keep all segments in playlist
        '-hls_segment_filename', `${hlsOutputDir}/segment_%v_%03d.ts`,
        '-f', 'hls',
        '-master_pl_name', 'master.m3u8',
        '-var_stream_map', 'v:0,a:0 v:1,a:1 v:2,a:2', // 3 different bitrates
        '-map', '0:v:0', '-map', '0:a:0', // 1080p stream
        '-map', '0:v:0', '-map', '0:a:0', // 720p stream  
        '-map', '0:v:0', '-map', '0:a:0', // 480p stream
        '-b:v:0', '2500k', '-s:v:0', '1920x1080', '-maxrate:v:0', '2750k', '-bufsize:v:0', '5000k',
        '-b:v:1', '1500k', '-s:v:1', '1280x720', '-maxrate:v:1', '1650k', '-bufsize:v:1', '3000k',
        '-b:v:2', '800k', '-s:v:2', '854x480', '-maxrate:v:2', '880k', '-bufsize:v:2', '1600k',
        '-b:a:0', '128k', '-b:a:1', '96k', '-b:a:2', '64k',
        '-hls_playlist_type', 'vod',
        '-hls_flags', 'independent_segments',
        '-y', // Overwrite output files
        masterPlaylistPath
      ],
      stdout: 'piped',
      stderr: 'piped'
    })
    
    const { code, stderr } = await command.output()
    
    if (code !== 0) {
      const errorText = new TextDecoder().decode(stderr)
      console.error('FFmpeg HLS error:', errorText)
      throw new Error(`FFmpeg HLS conversion failed: ${errorText}`)
    }
    
    // Read master playlist
    const masterPlaylist = await Deno.readTextFile(masterPlaylistPath)
    
    // Read all segment files
    const segments: { name: string; data: Uint8Array }[] = []
    let totalSize = 0
    
    // Read individual playlist files and segments
    const files = []
    for await (const dirEntry of Deno.readDir(hlsOutputDir)) {
      files.push(dirEntry.name)
    }
    
    for (const fileName of files) {
      if (fileName.endsWith('.ts') || fileName.endsWith('.m3u8')) {
        const filePath = `${hlsOutputDir}/${fileName}`
        const data = await Deno.readFile(filePath)
        segments.push({ name: fileName, data })
        totalSize += data.length
      }
    }
    
    console.log(`HLS conversion complete. Generated ${segments.length} files, total size: ${totalSize} bytes`)
    
    return {
      masterPlaylist,
      segments,
      compressedSize: totalSize
    }
  } finally {
    // Clean up temporary files
    try {
      await Deno.remove(tempInputPath)
      await Deno.remove(hlsOutputDir, { recursive: true })
    } catch (e) {
      console.warn('Failed to clean up temp files:', e)
    }
  }
}

interface GetUrlRequest {
  action: 'get_url';
  fileName: string;
  contentType: string;
}

interface ConfirmRequest {
  action: 'confirm';
  key: string;
  title: string;
  description?: string;
  originalFileName: string;
  contentType: string;
  originalSize: number;
}

interface UploadAndCompressRequest {
  action: 'upload_and_compress';
  file: File;
  title: string;
  description?: string;
}

serve(async (req) => {
  console.log('=== Edge Function Started ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)
  console.log('Headers:', Object.fromEntries(req.headers.entries()))
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting upload process...')
    
    // Get secrets
    const WASABI_ACCESS_KEY = Deno.env.get('WASABI_ACCESS_KEY')
    const WASABI_SECRET_KEY = Deno.env.get('WASABI_SECRET_KEY')
    const WASABI_REGION = Deno.env.get('WASABI_REGION') || 'us-central-1'
    const WASABI_ENDPOINT = Deno.env.get('WASABI_ENDPOINT') || 'https://s3.us-central-1.wasabisys.com'
    const WASABI_BUCKET = Deno.env.get('WASABI_BUCKET') || 'video-rec'
    
    console.log('Environment check:')
    console.log('- WASABI_ACCESS_KEY:', WASABI_ACCESS_KEY ? 'SET' : 'NOT SET')
    console.log('- WASABI_SECRET_KEY:', WASABI_SECRET_KEY ? 'SET' : 'NOT SET')
    console.log('- WASABI_REGION:', WASABI_REGION)
    console.log('- WASABI_ENDPOINT:', WASABI_ENDPOINT)
    console.log('- WASABI_BUCKET:', WASABI_BUCKET)
    
    if (!WASABI_ACCESS_KEY || !WASABI_SECRET_KEY) {
      console.error('Wasabi credentials not configured')
      return new Response(JSON.stringify({ 
        error: 'Wasabi credentials not configured' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // Initialize Supabase client for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    console.log('Supabase environment check:')
    console.log('- SUPABASE_URL:', supabaseUrl ? 'SET' : 'NOT SET')
    console.log('- SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'SET' : 'NOT SET')
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase credentials not configured')
      return new Response(JSON.stringify({ 
        error: 'Supabase credentials not configured' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No authorization header provided')
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
      console.error('Auth error:', authError)
      return new Response(JSON.stringify({ 
        error: 'Invalid authentication' 
      }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('User authenticated:', user.id)

    // Parse request body
    let body: GetUrlRequest | ConfirmRequest | UploadAndCompressRequest
    try {
      if (req.headers.get('content-type')?.includes('multipart/form-data')) {
        // Handle multipart form data for file uploads
        const formData = await req.formData()
        const file = formData.get('file') as File
        const title = formData.get('title') as string
        const description = formData.get('description') as string
        
        if (!file || !title) {
          return new Response(JSON.stringify({ 
            error: 'Missing required fields: file and title are required' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          })
        }
        
        body = {
          action: 'upload_and_compress',
          file,
          title,
          description: description || undefined
        }
      } else {
        body = await req.json() as GetUrlRequest | ConfirmRequest
      }
    } catch (error) {
      console.error('Failed to parse request body:', error)
      return new Response(JSON.stringify({ 
        error: 'Invalid request body' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Validate request body
    if (!body || !body.action) {
      console.error('Invalid request body: missing action')
      return new Response(JSON.stringify({ 
        error: 'Invalid request body: missing action' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Common S3 client
    const s3Client = new S3Client({
      region: WASABI_REGION,
      endpoint: WASABI_ENDPOINT,
      credentials: {
        accessKeyId: WASABI_ACCESS_KEY,
        secretAccessKey: WASABI_SECRET_KEY,
      },
      forcePathStyle: true,
    })

    if (body.action === 'get_url') {
      try {
        // Validate required fields
        if (!body.fileName || !body.contentType) {
          console.error('Missing required fields for get_url action')
          return new Response(JSON.stringify({ 
            error: 'Missing required fields: fileName and contentType are required' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          })
        }

        // Generate unique filename
        const timestamp = Date.now()
        const randomId = Math.random().toString(36).substring(2, 8)
        const fileExt = body.fileName.split('.').pop()
        const key = `${user.id}/${timestamp}-${randomId}.${fileExt}`

        const command = new PutObjectCommand({
          Bucket: WASABI_BUCKET,
          Key: key,
          ContentType: body.contentType,
        })
        
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 * 10 })
        const publicUrl = `${WASABI_ENDPOINT.replace(/\/$/, '')}/${WASABI_BUCKET}/${key}`

        console.log('Generated presigned URL for key:', key)
        return new Response(JSON.stringify({ uploadUrl, key, publicUrl }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      } catch (error) {
        console.error('Error generating presigned URL:', error)
        return new Response(JSON.stringify({ 
          error: 'Failed to generate upload URL' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }
    }

    if (body.action === 'confirm') {
      try {
        // Validate required fields
        if (!body.key || !body.title || !body.originalFileName || !body.contentType || body.originalSize === undefined) {
          console.error('Missing required fields for confirm action')
          return new Response(JSON.stringify({ 
            error: 'Missing required fields: key, title, originalFileName, contentType, and originalSize are required' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          })
        }

        const publicUrl = `${WASABI_ENDPOINT.replace(/\/$/, '')}/${WASABI_BUCKET}/${body.key}`

        const { data: videoData, error: dbError } = await supabase
          .from('videos')
          .insert({
            user_id: user.id,
            title: body.title,
            description: body.description || null,
            original_filename: body.originalFileName,
            file_url: publicUrl,
            original_size: body.originalSize,
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

        console.log('Video record created successfully:', videoData?.id)
        return new Response(JSON.stringify({ success: true, video: videoData }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      } catch (error) {
        console.error('Error confirming upload:', error)
        return new Response(JSON.stringify({ 
          error: 'Failed to confirm upload' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }
    }

    if (body.action === 'upload_and_compress') {
      try {
        console.log('Starting upload and compress process...')
        
        // Validate file
        if (!body.file || body.file.size === 0) {
          return new Response(JSON.stringify({ 
            error: 'Invalid file provided' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          })
        }

        // Check if file is a video
        if (!body.file.type.startsWith('video/')) {
          return new Response(JSON.stringify({ 
            error: 'File must be a video' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          })
        }

        console.log(`Processing video: ${body.file.name} (${body.file.size} bytes)`)
        
        // Convert video to HLS
        const hlsResult = await convertToHLS(body.file)
        
        // Generate unique directory for HLS files
        const timestamp = Date.now()
        const randomId = Math.random().toString(36).substring(2, 8)
        const hlsDir = `${user.id}/${timestamp}-${randomId}-hls`
        
        // Upload master playlist
        const masterPlaylistKey = `${hlsDir}/master.m3u8`
        const masterPlaylistCommand = new PutObjectCommand({
          Bucket: WASABI_BUCKET,
          Key: masterPlaylistKey,
          Body: hlsResult.masterPlaylist,
          ContentType: 'application/vnd.apple.mpegurl',
          ContentDisposition: 'inline',
        })
        await s3Client.send(masterPlaylistCommand)
        
        // Upload all segments
        for (const segment of hlsResult.segments) {
          const segmentKey = `${hlsDir}/${segment.name}`
          const contentType = segment.name.endsWith('.m3u8') 
            ? 'application/vnd.apple.mpegurl' 
            : 'video/mp2t'
          
          const segmentCommand = new PutObjectCommand({
            Bucket: WASABI_BUCKET,
            Key: segmentKey,
            Body: segment.data,
            ContentType: contentType,
            ContentDisposition: 'inline',
          })
          await s3Client.send(segmentCommand)
        }
        
        const publicUrl = `${WASABI_ENDPOINT.replace(/\/$/, '')}/${WASABI_BUCKET}/${masterPlaylistKey}`
        
        // Calculate compression ratio
        const compressionRatio = ((body.file.size - hlsResult.compressedSize) / body.file.size) * 100
        
        // Save video record to database
        const { data: videoData, error: dbError } = await supabase
          .from('videos')
          .insert({
            user_id: user.id,
            title: body.title,
            description: body.description || null,
            original_filename: body.file.name,
            file_url: publicUrl,
            original_size: body.file.size,
            file_size: hlsResult.compressedSize,
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

        console.log('Video converted to HLS and uploaded successfully:', videoData?.id)
        return new Response(JSON.stringify({ 
          success: true, 
          video: videoData,
          compressionRatio: compressionRatio,
          originalSize: body.file.size,
          compressedSize: hlsResult.compressedSize,
          hlsUrl: publicUrl,
          segmentCount: hlsResult.segments.length
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      } catch (error) {
        console.error('Error in upload and compress:', error)
        return new Response(JSON.stringify({ 
          error: `Upload and compression failed: ${error.message}` 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })

  } catch (error) {
    console.error('Error in upload function:', error)
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})