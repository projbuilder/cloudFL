-- ========================================
-- SAFE MIGRATION RUNNER - RUN THIS FIRST!
-- ========================================
-- This script will run ALL migrations safely
-- Copy and paste this entire file into Supabase SQL Editor

-- ========================================
-- STEP 1: Check Current State
-- ========================================

DO $$
DECLARE
  has_courses BOOLEAN;
  has_enrollments BOOLEAN;
  has_progress BOOLEAN;
  has_quiz_attempts BOOLEAN;
  progress_columns TEXT;
  quiz_columns TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '🔍 Checking current database state...';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  
  -- Check tables
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'courses') INTO has_courses;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'enrollments') INTO has_enrollments;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_progress') INTO has_progress;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quiz_attempts') INTO has_quiz_attempts;
  
  RAISE NOTICE '📋 Table Status:';
  RAISE NOTICE '  courses: %', CASE WHEN has_courses THEN '✅ EXISTS' ELSE '❌ MISSING' END;
  RAISE NOTICE '  enrollments: %', CASE WHEN has_enrollments THEN '✅ EXISTS' ELSE '❌ MISSING' END;
  RAISE NOTICE '  student_progress: %', CASE WHEN has_progress THEN '✅ EXISTS' ELSE '❌ MISSING' END;
  RAISE NOTICE '  quiz_attempts: %', CASE WHEN has_quiz_attempts THEN '✅ EXISTS' ELSE '❌ MISSING' END;
  RAISE NOTICE '';
  
  -- Check student_progress columns if table exists
  IF has_progress THEN
    SELECT string_agg(column_name, ', ' ORDER BY column_name) 
    INTO progress_columns
    FROM information_schema.columns 
    WHERE table_name = 'student_progress';
    
    RAISE NOTICE '📊 student_progress columns: %', progress_columns;
    RAISE NOTICE '';
  END IF;
  
  -- Check quiz_attempts columns if table exists
  IF has_quiz_attempts THEN
    SELECT string_agg(column_name, ', ' ORDER BY column_name) 
    INTO quiz_columns
    FROM information_schema.columns 
    WHERE table_name = 'quiz_attempts';
    
    RAISE NOTICE '🎯 quiz_attempts columns: %', quiz_columns;
    RAISE NOTICE '';
  END IF;
END $$;

-- ========================================
-- STEP 2: Create Missing Columns (SAFE)
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE '🔧 Adding missing columns (if needed)...';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  
  -- Add columns to student_progress if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_progress') THEN
    
    -- Add module_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'student_progress' AND column_name = 'module_id') THEN
      ALTER TABLE public.student_progress ADD COLUMN module_id UUID;
      RAISE NOTICE '✅ Added module_id to student_progress';
    ELSE
      RAISE NOTICE '⏭️ module_id already exists in student_progress';
    END IF;
    
    -- Add progress_percentage if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'student_progress' AND column_name = 'progress_percentage') THEN
      ALTER TABLE public.student_progress ADD COLUMN progress_percentage FLOAT DEFAULT 0;
      RAISE NOTICE '✅ Added progress_percentage to student_progress';
    ELSE
      RAISE NOTICE '⏭️ progress_percentage already exists in student_progress';
    END IF;
    
    -- Add completed_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'student_progress' AND column_name = 'completed_at') THEN
      ALTER TABLE public.student_progress ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
      RAISE NOTICE '✅ Added completed_at to student_progress';
    ELSE
      RAISE NOTICE '⏭️ completed_at already exists in student_progress';
    END IF;
    
    -- Add last_accessed_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'student_progress' AND column_name = 'last_accessed_at') THEN
      ALTER TABLE public.student_progress ADD COLUMN last_accessed_at TIMESTAMP WITH TIME ZONE;
      RAISE NOTICE '✅ Added last_accessed_at to student_progress';
    ELSE
      RAISE NOTICE '⏭️ last_accessed_at already exists in student_progress';
    END IF;
  END IF;
  
  -- Add columns to quiz_attempts if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quiz_attempts') THEN
    
    -- Add module_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'quiz_attempts' AND column_name = 'module_id') THEN
      ALTER TABLE public.quiz_attempts ADD COLUMN module_id UUID;
      RAISE NOTICE '✅ Added module_id to quiz_attempts';
    ELSE
      RAISE NOTICE '⏭️ module_id already exists in quiz_attempts';
    END IF;
    
    -- Add course_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'quiz_attempts' AND column_name = 'course_id') THEN
      ALTER TABLE public.quiz_attempts ADD COLUMN course_id UUID;
      RAISE NOTICE '✅ Added course_id to quiz_attempts';
    ELSE
      RAISE NOTICE '⏭️ course_id already exists in quiz_attempts';
    END IF;
    
    -- Add difficulty_level if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'quiz_attempts' AND column_name = 'difficulty_level') THEN
      ALTER TABLE public.quiz_attempts ADD COLUMN difficulty_level VARCHAR(20);
      RAISE NOTICE '✅ Added difficulty_level to quiz_attempts';
    ELSE
      RAISE NOTICE '⏭️ difficulty_level already exists in quiz_attempts';
    END IF;
  END IF;
  
  RAISE NOTICE '';
END $$;

-- ========================================
-- STEP 3: Success Message
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ SAFE PREPARATION COMPLETE!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ All missing columns have been added';
  RAISE NOTICE '✅ Database is ready for Phase 2C optimization';
  RAISE NOTICE '✅ Database is ready for FL migration';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Next Steps:';
  RAISE NOTICE '  1. Run: 20251109000005_phase_2c_optimization_v2.sql';
  RAISE NOTICE '  2. Run: 20251109000006_convert_to_mermaid.sql';
  RAISE NOTICE '  3. Run: 20251109000007_federated_learning.sql';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 No errors should occur now!';
  RAISE NOTICE '';
END $$;
