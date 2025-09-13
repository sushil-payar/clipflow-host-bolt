import { supabase } from '../integrations/supabase/client'

export interface CompressedUploadResult {
  success: boolean
  video?: any
  compressionRatio?: number
  originalSize?: number
  compressedSize?: number
  hlsUrl?: string
  segmentCount?: number
  error?: string
}

export async function uploadAndCompressVideo(
  file: File,
  title: string,
  description?: string
): Promise<CompressedUploadResult> {
  try {
    console.log('Starting compressed video upload...')
    
    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      throw new Error('Not authenticated')
    }

    // Create form data
    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', title)
    if (description) {
      formData.append('description', description)
    }

    // Call the edge function
    const { data, error } = await supabase.functions.invoke('upload-to-wasabi', {
      body: formData,
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      }
    })

    if (error) {
      console.error('Upload error:', error)
      return {
        success: false,
        error: error.message || 'Upload failed'
      }
    }

    console.log('Upload successful:', data)
    return {
      success: true,
      video: data.video,
      compressionRatio: data.compressionRatio,
      originalSize: data.originalSize,
      compressedSize: data.compressedSize
    }

  } catch (error) {
    console.error('Upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function formatCompressionRatio(ratio: number): string {
  return `${ratio.toFixed(1)}%`
}
