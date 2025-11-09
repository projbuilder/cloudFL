-- ⚡ FIX ENHANCED_QUIZZES RLS POLICY
-- Fixes 403 error when saving generated quizzes

-- Drop old policies
DROP POLICY IF EXISTS "Students can insert quizzes" ON public.enhanced_quizzes;
DROP POLICY IF EXISTS "Students can view own quizzes" ON public.enhanced_quizzes;
DROP POLICY IF EXISTS "Instructors can view all quizzes" ON public.enhanced_quizzes;

-- Create permissive policy for all authenticated users
CREATE POLICY "allow_authenticated_enhanced_quizzes"
  ON public.enhanced_quizzes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Enable RLS and grant permissions
ALTER TABLE public.enhanced_quizzes ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.enhanced_quizzes TO authenticated;

-- Verify policy created
SELECT 
    policyname,
    permissive,
    cmd
FROM pg_policies 
WHERE tablename = 'enhanced_quizzes';
