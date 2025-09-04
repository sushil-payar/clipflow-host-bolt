-- Update RLS policy to allow public viewing of videos for shareable links
DROP POLICY IF EXISTS "Users can view their own videos" ON public.videos;

-- Create new policy that allows public viewing of videos
CREATE POLICY "Videos are publicly viewable" 
ON public.videos 
FOR SELECT 
USING (true);

-- Update storage policies to allow public access to video files
DROP POLICY IF EXISTS "Users can view their own videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own thumbnails" ON storage.objects;

-- Create public read access for videos bucket
CREATE POLICY "Videos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'videos');