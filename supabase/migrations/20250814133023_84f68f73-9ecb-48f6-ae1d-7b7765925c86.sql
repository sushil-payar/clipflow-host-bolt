-- Fix function search path by setting it explicitly
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;