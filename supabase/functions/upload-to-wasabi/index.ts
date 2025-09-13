import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.645.0";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.645.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    let body: GetUrlRequest | ConfirmRequest
    try {
      body = await req.json() as GetUrlRequest | ConfirmRequest
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