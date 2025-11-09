-- ⚡ FIX FL WITH CORRECT COLUMN NAMES
-- Actual columns: id, student_id, course_id, model_weights, accuracy, training_round, privacy_budget_used, created_at

-- ==================================================
-- STEP 1: Fix RLS policies for fl_model_updates
-- ==================================================

DROP POLICY IF EXISTS "Students can insert own updates" ON public.fl_model_updates;
DROP POLICY IF EXISTS "Students can view own updates" ON public.fl_model_updates;
DROP POLICY IF EXISTS "Instructors can view updates" ON public.fl_model_updates;
DROP POLICY IF EXISTS "allow_authenticated_fl_insert" ON public.fl_model_updates;
DROP POLICY IF EXISTS "allow_authenticated_fl_select" ON public.fl_model_updates;
DROP POLICY IF EXISTS "allow_authenticated_fl_update" ON public.fl_model_updates;

CREATE POLICY "allow_authenticated_fl_all"
  ON public.fl_model_updates
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.fl_model_updates ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.fl_model_updates TO authenticated;

-- ==================================================
-- STEP 2: Check existing FL data (using correct columns)
-- ==================================================

SELECT 
    COUNT(*) as total_updates,
    COUNT(DISTINCT student_id) as unique_students,
    MAX(created_at) as last_update,
    ROUND(AVG(accuracy)::numeric, 2) as avg_accuracy,
    ROUND(AVG(privacy_budget_used)::numeric, 2) as avg_privacy_budget
FROM public.fl_model_updates;

-- ==================================================
-- STEP 3: View recent FL updates
-- ==================================================

SELECT 
    id,
    student_id,
    course_id,
    accuracy,
    training_round,
    privacy_budget_used,
    created_at
FROM public.fl_model_updates
ORDER BY created_at DESC
LIMIT 10;

-- ==================================================
-- STEP 4: Verify policies created
-- ==================================================

SELECT 
    policyname,
    permissive,
    cmd
FROM pg_policies 
WHERE tablename = 'fl_model_updates';
