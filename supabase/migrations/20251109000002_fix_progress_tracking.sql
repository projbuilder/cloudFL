-- ========================================
-- Fix Progress Tracking Migration
-- ========================================
-- Safer approach: Add columns first, then constraints

-- Step 1: Add columns without foreign key constraints
ALTER TABLE IF EXISTS public.student_progress 
ADD COLUMN IF NOT EXISTS module_id UUID,
ADD COLUMN IF NOT EXISTS quiz_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS quiz_score_avg NUMERIC(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS time_spent_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS strength_topics TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS weakness_topics TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS study_recommendations TEXT;

-- Step 2: Add foreign key constraint separately (only if column exists and constraint doesn't)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'student_progress_module_id_fkey'
    AND table_name = 'student_progress'
  ) THEN
    ALTER TABLE public.student_progress
    ADD CONSTRAINT student_progress_module_id_fkey
    FOREIGN KEY (module_id) REFERENCES public.course_modules(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_student_progress_module 
ON public.student_progress(student_id, module_id);

CREATE INDEX IF NOT EXISTS idx_student_progress_course_student 
ON public.student_progress(course_id, student_id);

-- Step 4: Create quiz_attempts table (simplified - no quiz_id FK since quizzes table might not exist)
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL,
  module_id UUID REFERENCES public.course_modules(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  answers JSONB NOT NULL,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  difficulty_level VARCHAR(20) NOT NULL DEFAULT 'medium',
  correct_count INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  topics_correct TEXT[] DEFAULT '{}',
  topics_incorrect TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for quiz_attempts
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student 
ON public.quiz_attempts(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_module 
ON public.quiz_attempts(module_id, student_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_course 
ON public.quiz_attempts(course_id, student_id, created_at DESC);

-- Step 5: Create module_study_sessions table
CREATE TABLE IF NOT EXISTS public.module_study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  interactions_count INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for study sessions
CREATE INDEX IF NOT EXISTS idx_study_sessions_student_module 
ON public.module_study_sessions(student_id, module_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_study_sessions_active 
ON public.module_study_sessions(student_id, ended_at) 
WHERE ended_at IS NULL;

-- Step 6: Create student_learning_analytics table
CREATE TABLE IF NOT EXISTS public.student_learning_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  overall_score NUMERIC(5,2) DEFAULT 0.00,
  module_scores JSONB DEFAULT '{}'::jsonb,
  quiz_performance JSONB DEFAULT '{}'::jsonb,
  study_time_total_minutes INTEGER DEFAULT 0,
  study_time_per_module JSONB DEFAULT '{}'::jsonb,
  avg_session_duration_minutes INTEGER DEFAULT 0,
  study_consistency_score NUMERIC(5,2) DEFAULT 0.00,
  strong_topics TEXT[] DEFAULT '{}',
  weak_topics TEXT[] DEFAULT '{}',
  improvement_rate NUMERIC(5,2) DEFAULT 0.00,
  recommended_modules UUID[] DEFAULT '{}',
  recommended_focus_areas TEXT[] DEFAULT '{}',
  difficulty_preference VARCHAR(20) DEFAULT 'medium',
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  activity_streak_days INTEGER DEFAULT 0,
  total_interactions INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index for student-course analytics
CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_analytics_student_course 
ON public.student_learning_analytics(student_id, course_id);

-- Create index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_learning_analytics_performance 
ON public.student_learning_analytics(course_id, overall_score DESC);

-- Step 7: Enable RLS on new tables
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_learning_analytics ENABLE ROW LEVEL SECURITY;

-- Step 8: Create RLS policies
-- Quiz attempts policies
DROP POLICY IF EXISTS "Students can view their own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Students can view their own quiz attempts"
ON public.quiz_attempts FOR SELECT
USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can insert their own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Students can insert their own quiz attempts"
ON public.quiz_attempts FOR INSERT
WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Instructors can view quiz attempts for their courses" ON public.quiz_attempts;
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
DROP POLICY IF EXISTS "Students can manage their own study sessions" ON public.module_study_sessions;
CREATE POLICY "Students can manage their own study sessions"
ON public.module_study_sessions FOR ALL
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Instructors can view study sessions for their courses" ON public.module_study_sessions;
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
DROP POLICY IF EXISTS "Students can view their own analytics" ON public.student_learning_analytics;
CREATE POLICY "Students can view their own analytics"
ON public.student_learning_analytics FOR SELECT
USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can update their own analytics" ON public.student_learning_analytics;
CREATE POLICY "Students can update their own analytics"
ON public.student_learning_analytics FOR ALL
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Instructors can view analytics for their courses" ON public.student_learning_analytics;
CREATE POLICY "Instructors can view analytics for their courses"
ON public.student_learning_analytics FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.courses 
    WHERE courses.id = student_learning_analytics.course_id 
    AND courses.instructor_id = auth.uid()
  )
);

-- Success message
SELECT 'Progress tracking migration completed successfully!' as result;
