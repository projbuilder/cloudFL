-- ========================================
-- Enhanced Quiz System with Multiple Question Types
-- ========================================

-- Enhanced Quizzes Table
CREATE TABLE IF NOT EXISTS public.enhanced_quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id UUID REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  questions JSONB NOT NULL, -- Array of EnhancedQuestion objects
  total_points INTEGER NOT NULL DEFAULT 0,
  time_limit INTEGER, -- seconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced Quiz Attempts (with detailed answers)
CREATE TABLE IF NOT EXISTS public.enhanced_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID REFERENCES public.enhanced_quizzes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.course_modules(id) ON DELETE CASCADE,
  difficulty VARCHAR(20) NOT NULL,
  
  -- Answers
  answers JSONB NOT NULL, -- Array of QuizAnswer objects
  
  -- Scoring
  score FLOAT NOT NULL,
  max_score FLOAT NOT NULL,
  percentage FLOAT NOT NULL,
  
  -- Timing
  time_spent INTEGER, -- seconds
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- AI Analysis
  strengths TEXT[],
  weaknesses TEXT[],
  recommended_next_difficulty VARCHAR(20),
  personalized_feedback TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_enhanced_quizzes_module ON public.enhanced_quizzes(module_id);
CREATE INDEX IF NOT EXISTS idx_enhanced_quizzes_difficulty ON public.enhanced_quizzes(difficulty);
CREATE INDEX IF NOT EXISTS idx_enhanced_attempts_student ON public.enhanced_quiz_attempts(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enhanced_attempts_quiz ON public.enhanced_quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_enhanced_attempts_course ON public.enhanced_quiz_attempts(course_id, student_id);

-- Enable RLS
ALTER TABLE public.enhanced_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enhanced_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for enhanced_quizzes
DROP POLICY IF EXISTS "Anyone can view quizzes" ON public.enhanced_quizzes;
CREATE POLICY "Anyone can view quizzes"
  ON public.enhanced_quizzes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Instructors can manage quizzes" ON public.enhanced_quizzes;
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

-- RLS Policies for enhanced_quiz_attempts
DROP POLICY IF EXISTS "Students can view own attempts" ON public.enhanced_quiz_attempts;
CREATE POLICY "Students can view own attempts"
  ON public.enhanced_quiz_attempts FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can insert own attempts" ON public.enhanced_quiz_attempts;
CREATE POLICY "Students can insert own attempts"
  ON public.enhanced_quiz_attempts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Instructors can view course attempts" ON public.enhanced_quiz_attempts;
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

-- Function to get quiz history for student
CREATE OR REPLACE FUNCTION get_student_quiz_history(
  p_student_id UUID,
  p_course_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  attempt_id UUID,
  quiz_title TEXT,
  difficulty VARCHAR(20),
  score FLOAT,
  max_score FLOAT,
  percentage FLOAT,
  completed_at TIMESTAMP WITH TIME ZONE,
  can_retake BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ea.id as attempt_id,
    eq.title as quiz_title,
    ea.difficulty,
    ea.score,
    ea.max_score,
    ea.percentage,
    ea.completed_at,
    true as can_retake -- Students can always retake
  FROM public.enhanced_quiz_attempts ea
  INNER JOIN public.enhanced_quizzes eq ON ea.quiz_id = eq.id
  WHERE ea.student_id = p_student_id
  AND (p_course_id IS NULL OR ea.course_id = p_course_id)
  AND ea.completed_at IS NOT NULL
  ORDER BY ea.completed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recommended next difficulty
CREATE OR REPLACE FUNCTION get_recommended_difficulty(
  p_student_id UUID,
  p_course_id UUID
)
RETURNS VARCHAR(20) AS $$
DECLARE
  v_avg_score FLOAT;
  v_recent_difficulty VARCHAR(20);
BEGIN
  -- Get average score from last 3 attempts
  SELECT AVG(percentage), MAX(difficulty)
  INTO v_avg_score, v_recent_difficulty
  FROM (
    SELECT percentage, difficulty
    FROM public.enhanced_quiz_attempts
    WHERE student_id = p_student_id
    AND course_id = p_course_id
    AND completed_at IS NOT NULL
    ORDER BY completed_at DESC
    LIMIT 3
  ) recent;
  
  -- If no attempts, start with easy
  IF v_avg_score IS NULL THEN
    RETURN 'easy';
  END IF;
  
  -- Adaptive difficulty logic
  IF v_avg_score >= 90 THEN
    -- Excellent performance, increase difficulty
    IF v_recent_difficulty = 'easy' THEN
      RETURN 'medium';
    ELSIF v_recent_difficulty = 'medium' THEN
      RETURN 'hard';
    ELSE
      RETURN 'hard'; -- Stay at hard
    END IF;
  ELSIF v_avg_score >= 70 THEN
    -- Good performance, maintain difficulty
    RETURN COALESCE(v_recent_difficulty, 'medium');
  ELSE
    -- Struggling, decrease difficulty
    IF v_recent_difficulty = 'hard' THEN
      RETURN 'medium';
    ELSIF v_recent_difficulty = 'medium' THEN
      RETURN 'easy';
    ELSE
      RETURN 'easy'; -- Stay at easy
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ Enhanced Quiz System Created!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Multiple question types supported:';
  RAISE NOTICE '   - Single-choice (traditional MCQ)';
  RAISE NOTICE '   - Multiple-choice (select multiple correct)';
  RAISE NOTICE '   - Descriptive (AI-graded written answers)';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Quiz history and review enabled';
  RAISE NOTICE '✅ Adaptive difficulty recommendations';
  RAISE NOTICE '✅ AI-powered personalized feedback';
  RAISE NOTICE '';
END $$;
