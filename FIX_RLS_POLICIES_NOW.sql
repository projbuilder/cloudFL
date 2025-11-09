-- =============================================
-- QUICK FIX: RLS Policies for Enhanced Quizzes
-- =============================================
-- Run this to fix the "row-level security policy" error

-- Step 1: Drop existing policies (clean slate)
DROP POLICY IF EXISTS "Students can view own attempts" ON public.enhanced_quiz_attempts;
DROP POLICY IF EXISTS "Students can insert own attempts" ON public.enhanced_quiz_attempts;
DROP POLICY IF EXISTS "Students can update own attempts" ON public.enhanced_quiz_attempts;
DROP POLICY IF EXISTS "Instructors can view course attempts" ON public.enhanced_quiz_attempts;

-- Step 2: Recreate INSERT policy (this is what's failing)
CREATE POLICY "Students can insert own attempts"
  ON public.enhanced_quiz_attempts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

-- Step 3: Recreate SELECT policy
CREATE POLICY "Students can view own attempts"
  ON public.enhanced_quiz_attempts FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

-- Step 4: Add UPDATE policy (for updating attempts)
CREATE POLICY "Students can update own attempts"
  ON public.enhanced_quiz_attempts FOR UPDATE
  TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- Step 5: Add instructor policy
CREATE POLICY "Instructors can view course attempts"
  ON public.enhanced_quiz_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE id = enhanced_quiz_attempts.course_id
      AND instructor_id = auth.uid()
    )
  );

-- Step 6: Verify RLS is enabled
ALTER TABLE public.enhanced_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Step 7: Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.enhanced_quiz_attempts TO authenticated;

-- Step 8: Verify policies were created
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ RLS POLICIES FIXED!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Students can now insert quiz attempts';
  RAISE NOTICE '✅ Students can view their own attempts';
  RAISE NOTICE '✅ Students can update their own attempts';
  RAISE NOTICE '✅ Instructors can view course attempts';
  RAISE NOTICE '';
  RAISE NOTICE 'Try taking a quiz again!';
  RAISE NOTICE '';
END $$;

-- Step 9: Test query (optional - check if policies work)
-- SELECT 
--   tablename, 
--   policyname, 
--   roles, 
--   cmd 
-- FROM pg_policies 
-- WHERE tablename = 'enhanced_quiz_attempts';
