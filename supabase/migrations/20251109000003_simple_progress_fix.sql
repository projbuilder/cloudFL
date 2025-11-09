-- ========================================
-- Simple Progress Tracking Fix
-- ========================================
-- Add columns to student_progress table one by one

-- Check and add module_id column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_progress' 
    AND column_name = 'module_id'
  ) THEN
    ALTER TABLE public.student_progress ADD COLUMN module_id UUID;
    RAISE NOTICE 'Added module_id column';
  ELSE
    RAISE NOTICE 'module_id column already exists';
  END IF;
END $$;

-- Check and add quiz_attempts column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_progress' 
    AND column_name = 'quiz_attempts'
  ) THEN
    ALTER TABLE public.student_progress ADD COLUMN quiz_attempts INTEGER DEFAULT 0;
    RAISE NOTICE 'Added quiz_attempts column';
  ELSE
    RAISE NOTICE 'quiz_attempts column already exists';
  END IF;
END $$;

-- Check and add quiz_score_avg column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_progress' 
    AND column_name = 'quiz_score_avg'
  ) THEN
    ALTER TABLE public.student_progress ADD COLUMN quiz_score_avg NUMERIC(5,2) DEFAULT 0.00;
    RAISE NOTICE 'Added quiz_score_avg column';
  ELSE
    RAISE NOTICE 'quiz_score_avg column already exists';
  END IF;
END $$;

-- Check and add time_spent_minutes column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_progress' 
    AND column_name = 'time_spent_minutes'
  ) THEN
    ALTER TABLE public.student_progress ADD COLUMN time_spent_minutes INTEGER DEFAULT 0;
    RAISE NOTICE 'Added time_spent_minutes column';
  ELSE
    RAISE NOTICE 'time_spent_minutes column already exists';
  END IF;
END $$;

-- Check and add completed_at column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_progress' 
    AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE public.student_progress ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE 'Added completed_at column';
  ELSE
    RAISE NOTICE 'completed_at column already exists';
  END IF;
END $$;

-- Check and add strength_topics column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_progress' 
    AND column_name = 'strength_topics'
  ) THEN
    ALTER TABLE public.student_progress ADD COLUMN strength_topics TEXT[] DEFAULT '{}';
    RAISE NOTICE 'Added strength_topics column';
  ELSE
    RAISE NOTICE 'strength_topics column already exists';
  END IF;
END $$;

-- Check and add weakness_topics column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_progress' 
    AND column_name = 'weakness_topics'
  ) THEN
    ALTER TABLE public.student_progress ADD COLUMN weakness_topics TEXT[] DEFAULT '{}';
    RAISE NOTICE 'Added weakness_topics column';
  ELSE
    RAISE NOTICE 'weakness_topics column already exists';
  END IF;
END $$;

-- Check and add study_recommendations column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'student_progress' 
    AND column_name = 'study_recommendations'
  ) THEN
    ALTER TABLE public.student_progress ADD COLUMN study_recommendations TEXT;
    RAISE NOTICE 'Added study_recommendations column';
  ELSE
    RAISE NOTICE 'study_recommendations column already exists';
  END IF;
END $$;

-- Now add foreign key constraint for module_id (only if not exists)
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
    RAISE NOTICE 'Added foreign key constraint for module_id';
  ELSE
    RAISE NOTICE 'Foreign key constraint already exists';
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_student_progress_module 
ON public.student_progress(student_id, module_id);

CREATE INDEX IF NOT EXISTS idx_student_progress_course_student 
ON public.student_progress(course_id, student_id);

-- Success message
SELECT 'Student progress table updated successfully!' as result;
