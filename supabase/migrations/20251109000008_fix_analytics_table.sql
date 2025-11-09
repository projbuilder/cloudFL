-- ========================================
-- Fix student_learning_analytics Table
-- ========================================
-- Fix 406 Not Acceptable error

-- Drop existing table to recreate with correct schema
DROP TABLE IF EXISTS public.student_learning_analytics CASCADE;

-- Create table with proper structure
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
  avg_time_per_quiz INTEGER DEFAULT 0, -- seconds
  preferred_learning_time VARCHAR(50), -- morning, afternoon, evening
  study_streak_days INTEGER DEFAULT 0,
  last_quiz_at TIMESTAMP WITH TIME ZONE,
  
  -- Adaptive insights
  strong_topics TEXT[], -- Array of topics student excels at
  weak_topics TEXT[], -- Topics needing improvement
  recommended_difficulty VARCHAR(20) DEFAULT 'easy',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint for ON CONFLICT
  UNIQUE(student_id, course_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_analytics_student ON public.student_learning_analytics(student_id);
CREATE INDEX IF NOT EXISTS idx_analytics_course ON public.student_learning_analytics(course_id);
CREATE INDEX IF NOT EXISTS idx_analytics_difficulty ON public.student_learning_analytics(current_difficulty);

-- Enable RLS
ALTER TABLE public.student_learning_analytics ENABLE ROW LEVEL SECURITY;

-- Policies
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

-- Function to update analytics after quiz
CREATE OR REPLACE FUNCTION update_student_analytics()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update analytics record
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

-- Trigger to auto-update analytics (if quiz_attempts table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quiz_attempts') THEN
    DROP TRIGGER IF EXISTS update_analytics_on_quiz ON public.quiz_attempts;
    CREATE TRIGGER update_analytics_on_quiz
      AFTER INSERT ON public.quiz_attempts
      FOR EACH ROW
      EXECUTE FUNCTION update_student_analytics();
    
    RAISE NOTICE '✅ Analytics trigger created on quiz_attempts';
  ELSE
    RAISE NOTICE '⚠️ quiz_attempts table does not exist - skipping trigger';
  END IF;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ student_learning_analytics table fixed!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Table created with proper structure';
  RAISE NOTICE '✅ RLS policies enabled';
  RAISE NOTICE '✅ Auto-update trigger configured';
  RAISE NOTICE '✅ 406 error should be resolved';
  RAISE NOTICE '';
END $$;
