-- Add quiz_data column to existing enhanced_quiz_attempts table
-- This allows storing quiz data when quiz isn't saved to enhanced_quizzes

DO $$
BEGIN
  -- Check if column doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'enhanced_quiz_attempts'
    AND column_name = 'quiz_data'
  ) THEN
    -- Add the column
    ALTER TABLE public.enhanced_quiz_attempts
    ADD COLUMN quiz_data JSONB;
    
    RAISE NOTICE '✅ Added quiz_data column to enhanced_quiz_attempts';
  ELSE
    RAISE NOTICE '✓ quiz_data column already exists';
  END IF;
END $$;

-- Success message
SELECT '✅ Quiz Review should now work!' as status;
