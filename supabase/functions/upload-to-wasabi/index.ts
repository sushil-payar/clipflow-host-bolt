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

    const body: UploadRequest = await req.json()
    
    // Decode base64 file
    const fileBuffer = Uint8Array.from(atob(body.file), c => c.charCodeAt(0))
    
    // Generate unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2)
    const fileExt = body.fileName.split('.').pop()
    const wasabiFileName = `${user.id}/${timestamp}-${randomId}.${fileExt}`

    // Upload to Wasabi S3
    const wasabiEndpoint = 'https://s3.us-central-1.wasabisys.com'
    const bucketName = 'video-rec'
    
    // Create S3 upload request
    const uploadUrl = `${wasabiEndpoint}/${bucketName}/${wasabiFileName}`
    
    // Create AWS Signature V4 for authentication
    const region = 'us-central-1'
    const service = 's3'
    const method = 'PUT'
    const host = 's3.us-central-1.wasabisys.com'
    
    const now = new Date()
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '')
    
    // Create canonical request
    const canonicalUri = `/${bucketName}/${wasabiFileName}`
    const canonicalQueryString = ''
    const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`
    const signedHeaders = 'host;x-amz-date'
    
    // Create payload hash
    const encoder = new TextEncoder()
    const payloadBuffer = encoder.encode('')
    const payloadHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', fileBuffer)))
      .map(b => b.toString(16).padStart(2, '0')).join('')
    
    const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`
    
    // Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256'
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest))))
      .map(b => b.toString(16).padStart(2, '0')).join('')}`
    
    // Create signing key
    const getSignatureKey = async (key: string, dateStamp: string, regionName: string, serviceName: string) => {
      const kDate = await crypto.subtle.importKey('raw', encoder.encode(`AWS4${key}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      const kRegion = await crypto.subtle.importKey('raw', new Uint8Array(await crypto.subtle.sign('HMAC', kDate, encoder.encode(dateStamp))), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      const kService = await crypto.subtle.importKey('raw', new Uint8Array(await crypto.subtle.sign('HMAC', kRegion, encoder.encode(regionName))), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      const kSigning = await crypto.subtle.importKey('raw', new Uint8Array(await crypto.subtle.sign('HMAC', kService, encoder.encode(serviceName))), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      return await crypto.subtle.importKey('raw', new Uint8Array(await crypto.subtle.sign('HMAC', kSigning, encoder.encode('aws4_request'))), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    }
    
    const signingKey = await getSignatureKey(WASABI_SECRET_KEY, dateStamp, region, service)
    const signature = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', signingKey, encoder.encode(stringToSign))))
      .map(b => b.toString(16).padStart(2, '0')).join('')
    
    // Create authorization header
    const authorization = `${algorithm} Credential=${WASABI_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    
    // Upload file to Wasabi
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': authorization,
        'x-amz-date': amzDate,
        'Content-Type': body.contentType,
        'Content-Length': fileBuffer.length.toString(),
      },
      body: fileBuffer,
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.error('Wasabi upload failed:', errorText)
      throw new Error(`Wasabi upload failed: ${uploadResponse.status}`)
    }

    console.log('File uploaded to Wasabi successfully')

    // Create file URL (Wasabi public URL)
    const fileUrl = `${wasabiEndpoint}/${bucketName}/${wasabiFileName}`
    
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