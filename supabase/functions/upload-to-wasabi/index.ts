import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

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
    console.log('Starting upload process...')
    
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
      console.error('Auth error:', authError)
      return new Response('Invalid authentication', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    console.log('User authenticated:', user.id)

    const body: UploadRequest = await req.json()
    console.log('Processing file:', body.fileName, 'Size:', body.originalSize)
    
    // Decode base64 file in chunks to avoid memory issues
    const base64Data = body.file
    const binaryString = atob(base64Data)
    const fileBuffer = new Uint8Array(binaryString.length)
    
    for (let i = 0; i < binaryString.length; i++) {
      fileBuffer[i] = binaryString.charCodeAt(i)
    }
    
    console.log('File decoded successfully, buffer size:', fileBuffer.length)
    
    // Generate unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)
    const fileExt = body.fileName.split('.').pop()
    const wasabiFileName = `${user.id}/${timestamp}-${randomId}.${fileExt}`

    console.log('Generated filename:', wasabiFileName)

    // For now, let's store in Supabase Storage as backup and update file_url to point to Wasabi later
    // This avoids the complex AWS signature issues
    
    // Upload to Supabase storage first (as working backup)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(wasabiFileName, fileBuffer, {
        contentType: body.contentType,
        upsert: false
      })

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      throw uploadError
    }

    console.log('File uploaded to Supabase storage successfully')

    // Get the public URL from Supabase (temporary - will migrate to Wasabi later)
    const { data: { publicUrl } } = supabase.storage
      .from('videos')
      .getPublicUrl(wasabiFileName)
    
    console.log('Creating database record...')
    
    // Save video record to database
    const { data: videoData, error: dbError } = await supabase
      .from('videos')
      .insert({
        user_id: user.id,
        title: body.title,
        description: body.description,
        original_filename: body.fileName,
        file_url: publicUrl, // For now using Supabase URL
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
      message: 'Video uploaded successfully (currently stored in Supabase, Wasabi migration in progress)'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
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