-- ========================================
-- Phase 2B: Enhanced Progress Tracking
-- ========================================
-- Adds detailed performance metrics per module
-- Tracks strengths, weaknesses, time spent
-- Enables personalized learning recommendations

-- Add detailed progress tracking to student_progress table
ALTER TABLE IF EXISTS public.student_progress 
ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES public.course_modules(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS quiz_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS quiz_score_avg NUMERIC(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS time_spent_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS strength_topics TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS weakness_topics TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS study_recommendations TEXT;

-- Create index for module-level progress queries
CREATE INDEX IF NOT EXISTS idx_student_progress_module 
ON public.student_progress(student_id, module_id);

-- Create index for course-level aggregations
CREATE INDEX IF NOT EXISTS idx_student_progress_course_student 
ON public.student_progress(course_id, student_id);

-- Create quiz_attempts table for detailed quiz analytics
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.course_modules(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  answers JSONB NOT NULL, -- Array of {questionId, selectedAnswer, isCorrect, timeSpent}
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  difficulty_level VARCHAR(20) NOT NULL DEFAULT 'medium',
  correct_count INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  topics_correct TEXT[] DEFAULT '{}',
  topics_incorrect TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for quiz analytics
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student 
ON public.quiz_attempts(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_module 
ON public.quiz_attempts(module_id, student_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_course 
ON public.quiz_attempts(course_id, student_id, created_at DESC);

-- Create module_study_sessions table for time tracking
CREATE TABLE IF NOT EXISTS public.module_study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER, -- Calculated on end
  interactions_count INTEGER DEFAULT 0, -- Clicks, scrolls, etc.
  completed BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for study session queries
CREATE INDEX IF NOT EXISTS idx_study_sessions_student_module 
ON public.module_study_sessions(student_id, module_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_study_sessions_active 
ON public.module_study_sessions(student_id, ended_at) 
WHERE ended_at IS NULL;

-- Create student_learning_analytics table for ML insights
CREATE TABLE IF NOT EXISTS public.student_learning_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  
  -- Performance metrics
  overall_score NUMERIC(5,2) DEFAULT 0.00,
  module_scores JSONB DEFAULT '{}'::jsonb, -- {moduleId: score}
  quiz_performance JSONB DEFAULT '{}'::jsonb, -- Aggregated quiz stats
  
  -- Learning patterns
  study_time_total_minutes INTEGER DEFAULT 0,
  study_time_per_module JSONB DEFAULT '{}'::jsonb,
  avg_session_duration_minutes INTEGER DEFAULT 0,
  study_consistency_score NUMERIC(5,2) DEFAULT 0.00, -- 0-100
  
  -- Strengths & Weaknesses
  strong_topics TEXT[] DEFAULT '{}',
  weak_topics TEXT[] DEFAULT '{}',
  improvement_rate NUMERIC(5,2) DEFAULT 0.00, -- % improvement over time
  
  -- Recommendations
  recommended_modules UUID[] DEFAULT '{}',
  recommended_focus_areas TEXT[] DEFAULT '{}',
  difficulty_preference VARCHAR(20) DEFAULT 'medium',
  
  -- Engagement metrics
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  activity_streak_days INTEGER DEFAULT 0,
  total_interactions INTEGER DEFAULT 0,
  
  -- Metadata
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index for student-course analytics
CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_analytics_student_course 
ON public.student_learning_analytics(student_id, course_id);

-- Create index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_learning_analytics_performance 
ON public.student_learning_analytics(course_id, overall_score DESC);

-- ========================================
-- RLS Policies
-- ========================================

-- Enable RLS on new tables
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_learning_analytics ENABLE ROW LEVEL SECURITY;

-- Quiz attempts policies
CREATE POLICY "Students can view their own quiz attempts"
ON public.quiz_attempts FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Students can insert their own quiz attempts"
ON public.quiz_attempts FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Instructors can view quiz attempts for their courses"
ON public.quiz_attempts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.courses 
    WHERE courses.id = quiz_attempts.course_id 
    AND courses.instructor_id = auth.uid()
  )
);

-- Study session policies
CREATE POLICY "Students can manage their own study sessions"
ON public.module_study_sessions FOR ALL
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Instructors can view study sessions for their courses"
ON public.module_study_sessions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.courses 
    WHERE courses.id = module_study_sessions.course_id 
    AND courses.instructor_id = auth.uid()
  )
);

-- Learning analytics policies
CREATE POLICY "Students can view their own analytics"
ON public.student_learning_analytics FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Students can update their own analytics"
ON public.student_learning_analytics FOR ALL
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Instructors can view analytics for their courses"
ON public.student_learning_analytics FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.courses 
    WHERE courses.id = student_learning_analytics.course_id 
    AND courses.instructor_id = auth.uid()
  )
);

-- ========================================
-- Helper Functions
-- ========================================

-- Function to calculate study consistency score
CREATE OR REPLACE FUNCTION calculate_consistency_score(
  p_student_id UUID,
  p_course_id UUID,
  p_days INTEGER DEFAULT 30
) RETURNS NUMERIC AS $$
DECLARE
  v_active_days INTEGER;
  v_total_days INTEGER;
BEGIN
  -- Count distinct days with activity
  SELECT COUNT(DISTINCT DATE(started_at))
  INTO v_active_days
  FROM public.module_study_sessions
  WHERE student_id = p_student_id
    AND course_id = p_course_id
    AND started_at >= NOW() - INTERVAL '1 day' * p_days;
  
  v_total_days := p_days;
  
  -- Return consistency as percentage
  RETURN (v_active_days::NUMERIC / v_total_days::NUMERIC * 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update learning analytics
CREATE OR REPLACE FUNCTION update_learning_analytics(
  p_student_id UUID,
  p_course_id UUID
) RETURNS VOID AS $$
DECLARE
  v_analytics RECORD;
BEGIN
  -- Calculate aggregated metrics
  WITH quiz_stats AS (
    SELECT 
      AVG(score) as avg_score,
      COUNT(*) as attempt_count,
      ARRAY_AGG(DISTINCT topic) as all_topics
    FROM public.quiz_attempts qa
    CROSS JOIN UNNEST(qa.topics_correct) as topic
    WHERE qa.student_id = p_student_id 
      AND qa.course_id = p_course_id
  ),
  study_stats AS (
    SELECT 
      SUM(duration_seconds) / 60 as total_minutes,
      AVG(duration_seconds) / 60 as avg_session_minutes
    FROM public.module_study_sessions
    WHERE student_id = p_student_id 
      AND course_id = p_course_id
      AND ended_at IS NOT NULL
  )
  SELECT 
    q.avg_score,
    q.attempt_count,
    s.total_minutes,
    s.avg_session_minutes
  INTO v_analytics
  FROM quiz_stats q, study_stats s;
  
  -- Update or insert analytics
  INSERT INTO public.student_learning_analytics (
    student_id,
    course_id,
    overall_score,
    study_time_total_minutes,
    avg_session_duration_minutes,
    study_consistency_score,
    last_activity_at,
    updated_at
  ) VALUES (
    p_student_id,
    p_course_id,
    COALESCE(v_analytics.avg_score, 0),
    COALESCE(v_analytics.total_minutes, 0)::INTEGER,
    COALESCE(v_analytics.avg_session_minutes, 0)::INTEGER,
    calculate_consistency_score(p_student_id, p_course_id, 30),
    NOW(),
    NOW()
  )
  ON CONFLICT (student_id, course_id)
  DO UPDATE SET
    overall_score = EXCLUDED.overall_score,
    study_time_total_minutes = EXCLUDED.study_time_total_minutes,
    avg_session_duration_minutes = EXCLUDED.avg_session_duration_minutes,
    study_consistency_score = EXCLUDED.study_consistency_score,
    last_activity_at = EXCLUDED.last_activity_at,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- Success Message
-- ========================================
SELECT 'Phase 2B: Enhanced Progress Tracking migration completed successfully!' as result;
