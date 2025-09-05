import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.470.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UploadRequest {
  file: string; // base64 encoded file
  fileName: string;
  contentType: string;
  title: string;
  description?: string;
  originalSize: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting upload to Wasabi...')
    
    // Get secrets
    const WASABI_ACCESS_KEY = Deno.env.get('WASABI_ACCESS_KEY')
    const WASABI_SECRET_KEY = Deno.env.get('WASABI_SECRET_KEY')
    
    if (!WASABI_ACCESS_KEY || !WASABI_SECRET_KEY) {
      throw new Error('Wasabi credentials not configured')
    }

    // Initialize Supabase client for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Authorization required', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response('Invalid authentication', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    console.log('User authenticated:', user.id)

    const body: UploadRequest = await req.json()
    console.log('Received file upload request for:', body.fileName)
    
    // Decode base64 file
    const fileBuffer = Uint8Array.from(atob(body.file), c => c.charCodeAt(0))
    console.log('File decoded, size:', fileBuffer.length)
    
    // Generate unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2)
    const fileExt = body.fileName.split('.').pop()
    const wasabiFileName = `${user.id}/${timestamp}-${randomId}.${fileExt}`

    console.log('Generated Wasabi filename:', wasabiFileName)

    // Configure S3 client for Wasabi
    const s3Client = new S3Client({
      region: 'us-central-1',
      endpoint: 'https://s3.us-central-1.wasabisys.com',
      credentials: {
        accessKeyId: WASABI_ACCESS_KEY,
        secretAccessKey: WASABI_SECRET_KEY,
      },
    })

    // Upload to Wasabi
    const uploadCommand = new PutObjectCommand({
      Bucket: 'video-rec',
      Key: wasabiFileName,
      Body: fileBuffer,
      ContentType: body.contentType,
    })

    console.log('Uploading to Wasabi...')
    const uploadResult = await s3Client.send(uploadCommand)
    console.log('Wasabi upload successful:', uploadResult.$metadata.httpStatusCode)

    // Create file URL (Wasabi public URL)
    const fileUrl = `https://s3.us-central-1.wasabisys.com/video-rec/${wasabiFileName}`
    
    console.log('Creating database record...')
    
    // Save video record to database
    const { data: videoData, error: dbError } = await supabase
      .from('videos')
      .insert({
        user_id: user.id,
        title: body.title,
        description: body.description,
        original_filename: body.fileName,
        file_url: fileUrl,
        file_size: fileBuffer.length,
        original_size: body.originalSize,
        compression_ratio: Math.round((fileBuffer.length / body.originalSize) * 100),
        status: 'processed'
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      throw dbError
    }

    console.log('Video record created successfully:', videoData.id)

    return new Response(JSON.stringify({ 
      success: true, 
      video: videoData,
      message: 'Video uploaded to Wasabi successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in upload-to-wasabi function:', error)
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})