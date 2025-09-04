-- Make the videos bucket public so videos can be streamed
UPDATE storage.buckets 
SET public = true 
WHERE id = 'videos';