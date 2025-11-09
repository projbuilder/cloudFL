-- ========================================
-- Phase 3B: Federated Learning Tables
-- ========================================
-- Tables for privacy-preserving distributed machine learning

-- ========================================
-- 1. FL Model Updates Table
-- ========================================
-- Stores encrypted model updates from students

CREATE TABLE IF NOT EXISTS public.fl_model_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  model_weights JSONB NOT NULL, -- Encrypted model weights and biases
  accuracy FLOAT NOT NULL CHECK (accuracy >= 0 AND accuracy <= 1),
  training_round INTEGER NOT NULL DEFAULT 1,
  privacy_budget_used FLOAT NOT NULL DEFAULT 0.5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure student can only submit one update per round per course
  UNIQUE(student_id, course_id, training_round)
);

-- Indexes for fl_model_updates
CREATE INDEX IF NOT EXISTS idx_fl_updates_course ON public.fl_model_updates(course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fl_updates_student ON public.fl_model_updates(student_id, course_id);
CREATE INDEX IF NOT EXISTS idx_fl_updates_round ON public.fl_model_updates(course_id, training_round);

-- RLS for fl_model_updates
ALTER TABLE public.fl_model_updates ENABLE ROW LEVEL SECURITY;

-- Students can insert their own updates
CREATE POLICY "Students can insert own model updates"
  ON public.fl_model_updates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

-- Students can view their own updates
CREATE POLICY "Students can view own model updates"
  ON public.fl_model_updates FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

-- Instructors can view updates for their courses
CREATE POLICY "Instructors can view course model updates"
  ON public.fl_model_updates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = fl_model_updates.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- ========================================
-- 2. FL Global Models Table
-- ========================================
-- Stores aggregated global models

CREATE TABLE IF NOT EXISTS public.fl_global_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  model_weights JSONB NOT NULL, -- Aggregated model weights
  num_contributors INTEGER NOT NULL DEFAULT 0,
  avg_accuracy FLOAT NOT NULL CHECK (avg_accuracy >= 0 AND avg_accuracy <= 1),
  deployed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One global model per version per course
  UNIQUE(course_id, version)
);

-- Indexes for fl_global_models
CREATE INDEX IF NOT EXISTS idx_fl_global_course ON public.fl_global_models(course_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_fl_global_deployed ON public.fl_global_models(deployed_at DESC);

-- RLS for fl_global_models
ALTER TABLE public.fl_global_models ENABLE ROW LEVEL SECURITY;

-- Students can view global models for enrolled courses
CREATE POLICY "Students can view global models for enrolled courses"
  ON public.fl_global_models FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.course_id = fl_global_models.course_id
      AND enrollments.student_id = auth.uid()
    )
  );

-- Instructors can view global models for their courses
CREATE POLICY "Instructors can view course global models"
  ON public.fl_global_models FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = fl_global_models.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- ========================================
-- 3. FL Training Sessions Table
-- ========================================
-- Track training sessions for analytics

CREATE TABLE IF NOT EXISTS public.fl_training_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  epochs_completed INTEGER DEFAULT 0,
  final_loss FLOAT,
  final_accuracy FLOAT,
  training_time_seconds INTEGER,
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed'))
);

-- Indexes for fl_training_sessions
CREATE INDEX IF NOT EXISTS idx_fl_sessions_student ON public.fl_training_sessions(student_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_fl_sessions_course ON public.fl_training_sessions(course_id, started_at DESC);

-- RLS for fl_training_sessions
ALTER TABLE public.fl_training_sessions ENABLE ROW LEVEL SECURITY;

-- Students can manage their own sessions
CREATE POLICY "Students can manage own training sessions"
  ON public.fl_training_sessions FOR ALL
  TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- Instructors can view sessions for their courses
CREATE POLICY "Instructors can view course training sessions"
  ON public.fl_training_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = fl_training_sessions.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- ========================================
-- 4. Helper Functions
-- ========================================

-- Function to get latest global model for a course
CREATE OR REPLACE FUNCTION get_latest_global_model(p_course_id UUID)
RETURNS TABLE (
  version INTEGER,
  model_weights JSONB,
  num_contributors INTEGER,
  avg_accuracy FLOAT,
  deployed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.version,
    m.model_weights,
    m.num_contributors,
    m.avg_accuracy,
    m.deployed_at
  FROM public.fl_global_models m
  WHERE m.course_id = p_course_id
  ORDER BY m.version DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get student's FL statistics
CREATE OR REPLACE FUNCTION get_student_fl_stats(p_student_id UUID, p_course_id UUID)
RETURNS TABLE (
  total_contributions INTEGER,
  avg_accuracy FLOAT,
  last_training_date TIMESTAMP WITH TIME ZONE,
  total_training_time INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(u.id)::INTEGER as total_contributions,
    AVG(u.accuracy)::FLOAT as avg_accuracy,
    MAX(u.created_at) as last_training_date,
    COALESCE(SUM(s.training_time_seconds), 0)::INTEGER as total_training_time
  FROM public.fl_model_updates u
  LEFT JOIN public.fl_training_sessions s 
    ON s.student_id = u.student_id 
    AND s.course_id = u.course_id
  WHERE u.student_id = p_student_id
    AND u.course_id = p_course_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get course FL analytics
CREATE OR REPLACE FUNCTION get_course_fl_analytics(p_course_id UUID)
RETURNS TABLE (
  total_students_training INTEGER,
  total_model_updates INTEGER,
  current_model_version INTEGER,
  avg_student_accuracy FLOAT,
  last_aggregation_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT u.student_id)::INTEGER as total_students_training,
    COUNT(u.id)::INTEGER as total_model_updates,
    COALESCE(MAX(m.version), 0)::INTEGER as current_model_version,
    AVG(u.accuracy)::FLOAT as avg_student_accuracy,
    MAX(m.deployed_at) as last_aggregation_date
  FROM public.fl_model_updates u
  LEFT JOIN public.fl_global_models m ON m.course_id = u.course_id
  WHERE u.course_id = p_course_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 5. Update student_learning_analytics
-- ========================================

-- Add FL columns to student_learning_analytics if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_learning_analytics') THEN
    -- Add FL-related columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'student_learning_analytics' AND column_name = 'fl_contributions') THEN
      ALTER TABLE public.student_learning_analytics 
      ADD COLUMN fl_contributions INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'student_learning_analytics' AND column_name = 'fl_model_accuracy') THEN
      ALTER TABLE public.student_learning_analytics 
      ADD COLUMN fl_model_accuracy FLOAT DEFAULT 0;
    END IF;
  END IF;
END $$;

-- ========================================
-- 6. Performance Optimization
-- ========================================

-- Analyze tables for query optimization
ANALYZE public.fl_model_updates;
ANALYZE public.fl_global_models;
ANALYZE public.fl_training_sessions;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Phase 3B: Federated Learning tables created successfully!';
  RAISE NOTICE '📊 Tables: fl_model_updates, fl_global_models, fl_training_sessions';
  RAISE NOTICE '🔐 RLS policies enabled for privacy protection';
  RAISE NOTICE '⚡ Helper functions created for analytics';
END $$;
