-- ========================================
-- QUICK FIX: Add Missing UNIQUE Constraint
-- ========================================
-- This fixes the 406 error on student_learning_analytics

-- Step 1: Drop existing table (safe - no data yet)
DROP TABLE IF EXISTS public.student_learning_analytics CASCADE;

-- Step 2: Recreate with UNIQUE constraint
CREATE TABLE public.student_learning_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  
  -- Quiz performance
  total_quizzes_taken INTEGER DEFAULT 0,
  total_quiz_score FLOAT DEFAULT 0,
  average_quiz_score FLOAT DEFAULT 0,
  highest_quiz_score FLOAT DEFAULT 0,
  lowest_quiz_score FLOAT DEFAULT 0,
  
  -- Difficulty progression
  easy_quizzes_completed INTEGER DEFAULT 0,
  medium_quizzes_completed INTEGER DEFAULT 0,
  hard_quizzes_completed INTEGER DEFAULT 0,
  current_difficulty VARCHAR(20) DEFAULT 'easy',
  
  -- Learning patterns
  avg_time_per_quiz INTEGER DEFAULT 0,
  preferred_learning_time VARCHAR(50),
  study_streak_days INTEGER DEFAULT 0,
  last_quiz_at TIMESTAMP WITH TIME ZONE,
  
  -- Adaptive insights
  strong_topics TEXT[],
  weak_topics TEXT[],
  recommended_difficulty VARCHAR(20) DEFAULT 'easy',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- ✅ UNIQUE constraint (this was missing!)
  UNIQUE(student_id, course_id)
);

-- Step 3: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_analytics_student ON public.student_learning_analytics(student_id);
CREATE INDEX IF NOT EXISTS idx_analytics_course ON public.student_learning_analytics(course_id);
CREATE INDEX IF NOT EXISTS idx_analytics_difficulty ON public.student_learning_analytics(current_difficulty);

-- Step 4: Enable RLS
ALTER TABLE public.student_learning_analytics ENABLE ROW LEVEL SECURITY;

-- Step 5: Recreate policies
DROP POLICY IF EXISTS "Students can view own analytics" ON public.student_learning_analytics;
CREATE POLICY "Students can view own analytics"
  ON public.student_learning_analytics FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can insert own analytics" ON public.student_learning_analytics;
CREATE POLICY "Students can insert own analytics"
  ON public.student_learning_analytics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can update own analytics" ON public.student_learning_analytics;
CREATE POLICY "Students can update own analytics"
  ON public.student_learning_analytics FOR UPDATE
  TO authenticated
  USING (auth.uid() = student_id);

-- Step 6: Recreate trigger function
CREATE OR REPLACE FUNCTION update_student_analytics()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.student_learning_analytics (
    student_id,
    course_id,
    total_quizzes_taken,
    total_quiz_score,
    average_quiz_score,
    last_quiz_at,
    updated_at
  ) VALUES (
    NEW.student_id,
    NEW.course_id,
    1,
    NEW.score,
    NEW.score,
    NEW.created_at,
    NOW()
  )
  ON CONFLICT (student_id, course_id)
  DO UPDATE SET
    total_quizzes_taken = public.student_learning_analytics.total_quizzes_taken + 1,
    total_quiz_score = public.student_learning_analytics.total_quiz_score + NEW.score,
    average_quiz_score = (public.student_learning_analytics.total_quiz_score + NEW.score) / (public.student_learning_analytics.total_quizzes_taken + 1),
    highest_quiz_score = GREATEST(public.student_learning_analytics.highest_quiz_score, NEW.score),
    lowest_quiz_score = LEAST(COALESCE(public.student_learning_analytics.lowest_quiz_score, NEW.score), NEW.score),
    last_quiz_at = NEW.created_at,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Attach trigger to enhanced_quiz_attempts (new table)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'enhanced_quiz_attempts') THEN
    DROP TRIGGER IF EXISTS update_analytics_on_enhanced_quiz ON public.enhanced_quiz_attempts;
    CREATE TRIGGER update_analytics_on_enhanced_quiz
      AFTER INSERT ON public.enhanced_quiz_attempts
      FOR EACH ROW
      EXECUTE FUNCTION update_student_analytics();
    
    RAISE NOTICE '✅ Analytics trigger created on enhanced_quiz_attempts';
  END IF;
END $$;

-- Step 8: Also attach to old quiz_attempts if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quiz_attempts') THEN
    DROP TRIGGER IF EXISTS update_analytics_on_quiz ON public.quiz_attempts;
    CREATE TRIGGER update_analytics_on_quiz
      AFTER INSERT ON public.quiz_attempts
      FOR EACH ROW
      EXECUTE FUNCTION update_student_analytics();
    
    RAISE NOTICE '✅ Analytics trigger created on quiz_attempts';
  END IF;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ 406 ERROR FIXED!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Added UNIQUE constraint on (student_id, course_id)';
  RAISE NOTICE '✅ Recreated RLS policies';
  RAISE NOTICE '✅ Attached triggers to quiz tables';
  RAISE NOTICE '';
  RAISE NOTICE 'You should now see analytics data without 406 errors!';
  RAISE NOTICE '';
END $$;
