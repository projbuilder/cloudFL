-- ========================================
-- Quick Fix: Publish Existing Courses
-- ========================================
-- Run this in Supabase SQL Editor to make
-- existing unpublished courses visible to students

-- Update all unpublished courses to be published
UPDATE public.courses
SET is_published = true
WHERE is_published = false;

-- Verify the update
SELECT 
  id, 
  title, 
  is_published,
  created_at
FROM public.courses
ORDER BY created_at DESC;

-- Expected result: All courses should now have is_published = true
