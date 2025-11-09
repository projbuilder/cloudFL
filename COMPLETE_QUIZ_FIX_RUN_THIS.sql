-- ================================================================
-- COMPLETE FIX: Enhanced Quiz System + RLS Policies
-- ================================================================
-- This creates tables AND fixes RLS policies in one script
-- Run this ONCE in Supabase SQL Editor

-- Step 1: Create tables if they don't exist
CREATE TABLE IF NOT EXISTS public.enhanced_quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id UUID REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  questions JSONB NOT NULL,
  total_points INTEGER NOT NULL DEFAULT 0,
  time_limit INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.enhanced_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID REFERENCES public.enhanced_quizzes(id) ON DELETE SET NULL, -- Nullable, no FK error
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  difficulty VARCHAR(20) NOT NULL,
  answers JSONB NOT NULL,
  quiz_data JSONB, -- Stores quiz if not saved to enhanced_quizzes
  score FLOAT NOT NULL,
  max_score FLOAT NOT NULL,
  percentage FLOAT NOT NULL,
  time_spent INTEGER,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  strengths TEXT[],
  weaknesses TEXT[],
  recommended_next_difficulty VARCHAR(20),
  personalized_feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_enhanced_quizzes_module ON public.enhanced_quizzes(module_id);
CREATE INDEX IF NOT EXISTS idx_enhanced_quizzes_difficulty ON public.enhanced_quizzes(difficulty);
CREATE INDEX IF NOT EXISTS idx_enhanced_attempts_student ON public.enhanced_quiz_attempts(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enhanced_attempts_quiz ON public.enhanced_quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_enhanced_attempts_module ON public.enhanced_quiz_attempts(module_id, student_id);

-- Step 3: Enable RLS
ALTER TABLE public.enhanced_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enhanced_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop all existing policies (clean slate)
DROP POLICY IF EXISTS "Anyone can view quizzes" ON public.enhanced_quizzes;
DROP POLICY IF EXISTS "Instructors can manage quizzes" ON public.enhanced_quizzes;
DROP POLICY IF EXISTS "Students can view own attempts" ON public.enhanced_quiz_attempts;
DROP POLICY IF EXISTS "Students can insert own attempts" ON public.enhanced_quiz_attempts;
DROP POLICY IF EXISTS "Students can update own attempts" ON public.enhanced_quiz_attempts;
DROP POLICY IF EXISTS "Instructors can view course attempts" ON public.enhanced_quiz_attempts;

-- Step 5: Create policies for enhanced_quizzes
CREATE POLICY "Anyone can view quizzes"
  ON public.enhanced_quizzes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Instructors can manage quizzes"
  ON public.enhanced_quizzes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      INNER JOIN public.course_modules cm ON c.id = cm.course_id
      WHERE cm.id = enhanced_quizzes.module_id
      AND c.instructor_id = auth.uid()
    )
  );

-- Step 6: Create policies for enhanced_quiz_attempts (CRITICAL!)
CREATE POLICY "Students can view own attempts"
  ON public.enhanced_quiz_attempts FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can insert own attempts"
  ON public.enhanced_quiz_attempts FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update own attempts"
  ON public.enhanced_quiz_attempts FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

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

-- Step 7: Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.enhanced_quizzes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.enhanced_quiz_attempts TO authenticated;

-- Step 8: Create helper functions
CREATE OR REPLACE FUNCTION get_recommended_difficulty(
  p_student_id UUID,
  p_course_id UUID
)
RETURNS VARCHAR(20) AS $$
DECLARE
  v_avg_percentage FLOAT;
  v_recent_difficulty VARCHAR(20);
BEGIN
  -- Get average percentage from recent attempts
  SELECT AVG(percentage), MAX(difficulty)
  INTO v_avg_percentage, v_recent_difficulty
  FROM public.enhanced_quiz_attempts
  WHERE student_id = p_student_id
    AND course_id = p_course_id
    AND completed_at > NOW() - INTERVAL '7 days'
  LIMIT 5;

  -- If no attempts, recommend easy
  IF v_avg_percentage IS NULL THEN
    RETURN 'easy';
  END IF;

  -- If scoring high, recommend harder
  IF v_avg_percentage >= 90 THEN
    IF v_recent_difficulty = 'medium' THEN
      RETURN 'hard';
    ELSIF v_recent_difficulty = 'easy' THEN
      RETURN 'medium';
    END IF;
  END IF;

  -- If scoring low, recommend easier
  IF v_avg_percentage < 70 THEN
    IF v_recent_difficulty = 'hard' THEN
      RETURN 'medium';
    ELSIF v_recent_difficulty = 'medium' THEN
      RETURN 'easy';
    END IF;
  END IF;

  -- Default: stay at current level
  RETURN COALESCE(v_recent_difficulty, 'easy');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Test the setup
DO $$
DECLARE
  v_test_user_id UUID;
  v_policies_count INTEGER;
BEGIN
  -- Check if policies were created
  SELECT COUNT(*)
  INTO v_policies_count
  FROM pg_policies
  WHERE tablename = 'enhanced_quiz_attempts';

  IF v_policies_count < 4 THEN
    RAISE EXCEPTION 'Failed to create all policies. Only % policies found.', v_policies_count;
  END IF;

  -- Success message
  RAISE NOTICE '';
  RAISE NOTICE '========================================================';
  RAISE NOTICE '✅ ENHANCED QUIZ SYSTEM SETUP COMPLETE!';
  RAISE NOTICE '========================================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Tables created: enhanced_quizzes, enhanced_quiz_attempts';
  RAISE NOTICE '✅ Indexes created for performance';
  RAISE NOTICE '✅ RLS enabled on both tables';
  RAISE NOTICE '✅ % RLS policies created', v_policies_count;
  RAISE NOTICE '✅ Permissions granted to authenticated users';
  RAISE NOTICE '✅ Helper functions created';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 You can now take quizzes and save attempts!';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Refresh your browser (Ctrl+Shift+R)';
  RAISE NOTICE '  2. Go to Adaptive Quiz tab';
  RAISE NOTICE '  3. Take a quiz and complete it';
  RAISE NOTICE '  4. Check console for success message';
  RAISE NOTICE '';
END $$;

-- Step 10: Show created policies
SELECT 
  tablename,
  policyname,
  cmd,
  qual IS NOT NULL as has_using,
  with_check IS NOT NULL as has_check
FROM pg_policies 
WHERE tablename IN ('enhanced_quizzes', 'enhanced_quiz_attempts')
ORDER BY tablename, policyname;
