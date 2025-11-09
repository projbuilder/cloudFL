-- ========================================
-- Complete Fix for Progress Tracking
-- ========================================

-- First, ensure all columns exist in student_progress
DO $$ 
BEGIN
  -- Add module_id if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_progress' AND column_name = 'module_id') THEN
    ALTER TABLE public.student_progress ADD COLUMN module_id UUID;
  END IF;
  
  -- Add other columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_progress' AND column_name = 'quiz_attempts') THEN
    ALTER TABLE public.student_progress ADD COLUMN quiz_attempts INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_progress' AND column_name = 'quiz_score_avg') THEN
    ALTER TABLE public.student_progress ADD COLUMN quiz_score_avg NUMERIC(5,2) DEFAULT 0.00;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_progress' AND column_name = 'time_spent_minutes') THEN
    ALTER TABLE public.student_progress ADD COLUMN time_spent_minutes INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_progress' AND column_name = 'completed_at') THEN
    ALTER TABLE public.student_progress ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_progress' AND column_name = 'strength_topics') THEN
    ALTER TABLE public.student_progress ADD COLUMN strength_topics TEXT[] DEFAULT '{}';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_progress' AND column_name = 'weakness_topics') THEN
    ALTER TABLE public.student_progress ADD COLUMN weakness_topics TEXT[] DEFAULT '{}';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_progress' AND column_name = 'study_recommendations') THEN
    ALTER TABLE public.student_progress ADD COLUMN study_recommendations TEXT;
  END IF;
END $$;

-- Add unique constraint for upsert operations (CRITICAL!)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'student_progress_unique_constraint'
  ) THEN
    ALTER TABLE public.student_progress
    ADD CONSTRAINT student_progress_unique_constraint 
    UNIQUE (student_id, course_id, module_id);
    RAISE NOTICE 'Added unique constraint';
  END IF;
END $$;

-- Add foreign key for module_id
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'student_progress_module_id_fkey'
  ) THEN
    ALTER TABLE public.student_progress
    ADD CONSTRAINT student_progress_module_id_fkey
    FOREIGN KEY (module_id) REFERENCES public.course_modules(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_student_progress_student_course 
ON public.student_progress(student_id, course_id);

CREATE INDEX IF NOT EXISTS idx_student_progress_module 
ON public.student_progress(student_id, module_id);

-- Create quiz_attempts table
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

-- Create student_learning_analytics table
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, course_id)
);

-- Enable RLS on tables
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_learning_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quiz_attempts
DROP POLICY IF EXISTS "Students can view their own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Students can view their own quiz attempts"
ON public.quiz_attempts FOR SELECT
USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can insert their own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Students can insert their own quiz attempts"
ON public.quiz_attempts FOR INSERT
WITH CHECK (auth.uid() = student_id);

-- RLS Policies for student_learning_analytics
DROP POLICY IF EXISTS "Students can view their own analytics" ON public.student_learning_analytics;
CREATE POLICY "Students can view their own analytics"
ON public.student_learning_analytics FOR SELECT
USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can manage their own analytics" ON public.student_learning_analytics;
CREATE POLICY "Students can manage their own analytics"
ON public.student_learning_analytics FOR ALL
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student 
ON public.quiz_attempts(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_analytics_student_course 
ON public.student_learning_analytics(student_id, course_id);

-- Success message
SELECT 'Complete progress tracking setup finished!' as result;
