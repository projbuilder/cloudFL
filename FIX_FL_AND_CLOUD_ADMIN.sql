-- ⚡ FIX FL TRAINING & CLOUD ADMIN DASHBOARD
-- This ensures FL training data saves and Cloud Admin can read it

-- ==================================================
-- STEP 1: Fix fl_model_updates table RLS
-- ==================================================

-- Drop old policies
DROP POLICY IF EXISTS "Students can insert own updates" ON public.fl_model_updates;
DROP POLICY IF EXISTS "Students can view own updates" ON public.fl_model_updates;
DROP POLICY IF EXISTS "Instructors can view updates" ON public.fl_model_updates;

-- Create permissive policies
CREATE POLICY "allow_authenticated_fl_insert"
  ON public.fl_model_updates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "allow_authenticated_fl_select"
  ON public.fl_model_updates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "allow_authenticated_fl_update"
  ON public.fl_model_updates
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Enable RLS and grant permissions
ALTER TABLE public.fl_model_updates ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.fl_model_updates TO authenticated;

-- ==================================================
-- STEP 2: Verify FL table structure
-- ==================================================

-- Check if table exists and has correct columns
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'fl_model_updates'
ORDER BY ordinal_position;

-- ==================================================
-- STEP 3: Check existing FL data
-- ==================================================

SELECT 
    COUNT(*) as total_updates,
    COUNT(DISTINCT node_id) as unique_nodes,
    MAX(created_at) as last_update,
    ROUND(AVG(local_accuracy), 2) as avg_accuracy
FROM public.fl_model_updates;

-- ==================================================
-- STEP 4: Verify all policies are created
-- ==================================================

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename IN (
    'fl_model_updates',
    'enhanced_quiz_attempts',
    'student_xp',
    'student_achievements'
)
ORDER BY tablename, policyname;

-- ==================================================
-- STEP 5: Check RLS status on all critical tables
-- ==================================================

SELECT 
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename IN (
    'fl_model_updates',
    'enhanced_quiz_attempts', 
    'student_xp',
    'student_achievements',
    'student_progress',
    'courses',
    'users'
)
ORDER BY tablename;

-- ==================================================
-- OPTIONAL: Insert test FL data (for debugging)
-- ==================================================
-- Uncomment and replace YOUR_USER_ID to test manually

/*
INSERT INTO public.fl_model_updates (
    node_id,
    student_id,
    course_id,
    model_weights,
    local_accuracy,
    samples_count,
    epsilon,
    delta,
    created_at
) VALUES (
    'test-node-' || gen_random_uuid()::text,
    'YOUR_USER_ID'::uuid,
    'c5025e6f-fa48-4948-81ae-c426937ec815'::uuid,
    '{}'::jsonb,
    75.5,
    100,
    0.5,
    0.00001,
    NOW()
);

-- Verify insert worked
SELECT * FROM public.fl_model_updates 
WHERE student_id = 'YOUR_USER_ID'::uuid
ORDER BY created_at DESC LIMIT 1;
*/
