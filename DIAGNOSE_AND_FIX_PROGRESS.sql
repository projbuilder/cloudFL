-- 🔍 DIAGNOSE PROGRESS ISSUE
-- The Instructor Dashboard is finding 0 progress entries
-- But your SQL shows you have completed entries
-- Let's find out why!

-- ==================================================
-- STEP 1: Verify Your Data Exists
-- ==================================================

-- Get your student ID
SELECT id as student_id, email FROM auth.users 
WHERE email LIKE '%evony%' OR email LIKE '%1689%';

-- Get your instructor ID  
SELECT id as instructor_id, email FROM auth.users 
WHERE role = 'instructor';

-- Get the course IDs
SELECT id, title, instructor_id FROM courses;

-- ==================================================
-- STEP 2: Check Student Progress Table
-- ==================================================

-- Use your actual student_id from Step 1
SELECT 
    sp.id,
    sp.student_id,
    sp.course_id,
    sp.module_id,
    sp.progress_percentage,
    sp.completed_at,
    c.title as course_title,
    cm.title as module_title
FROM student_progress sp
LEFT JOIN courses c ON sp.course_id = c.id
LEFT JOIN course_modules cm ON sp.module_id = cm.id
WHERE sp.student_id = '546c3d6d-fe3c-4525-b5a5-d5e353fb39ad' -- Replace with your ID
ORDER BY sp.created_at DESC;

-- ==================================================
-- STEP 3: Check Enrollments
-- ==================================================

-- Verify enrollment exists
SELECT 
    e.*,
    c.title as course_title,
    c.instructor_id,
    u.email as student_email
FROM enrollments e
LEFT JOIN courses c ON e.course_id = c.id
LEFT JOIN users u ON e.student_id = u.id
WHERE e.student_id = '546c3d6d-fe3c-4525-b5a5-d5e353fb39ad'; -- Replace

-- ==================================================
-- STEP 4: Test The Exact Query Instructor Dashboard Uses
-- ==================================================

-- This is what the Instructor Dashboard does:
-- Replace instructor_id with YOUR instructor ID from Step 1

-- Get courses by instructor
SELECT id, title FROM courses 
WHERE instructor_id = 'YOUR_INSTRUCTOR_ID'; -- Replace

-- Get progress for specific course
-- Replace course_id with the Cloud Computing course ID
SELECT 
    progress_percentage, 
    time_spent_minutes, 
    completed_at
FROM student_progress
WHERE course_id = 'c5025e6f-fa48-4948-81ae-c426937ec815';

-- ==================================================
-- STEP 5: Check If RLS Is Blocking
-- ==================================================

-- Disable RLS temporarily to test
-- (Run as postgres/admin user)
ALTER TABLE student_progress DISABLE ROW LEVEL SECURITY;

-- Try the query again
SELECT * FROM student_progress
WHERE course_id = 'c5025e6f-fa48-4948-81ae-c426937ec815';

-- Re-enable RLS
ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;

-- ==================================================
-- FIX 1: Ensure Enrollment Exists
-- ==================================================

-- If enrollment is missing, create it
-- Replace IDs with actual values
INSERT INTO enrollments (student_id, course_id, status)
VALUES (
    '546c3d6d-fe3c-4525-b5a5-d5e353fb39ad', -- Your student ID
    'c5025e6f-fa48-4948-81ae-c426937ec815', -- Cloud Computing course ID
    'active'
)
ON CONFLICT (student_id, course_id) DO NOTHING;

-- ==================================================
-- FIX 2: Update RLS Policy for student_progress
-- ==================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view their own progress" ON student_progress;
DROP POLICY IF EXISTS "Instructors can view student progress" ON student_progress;

-- Create proper policies
CREATE POLICY "Students can view own progress"
ON student_progress FOR SELECT
TO authenticated
USING (auth.uid() = student_id);

CREATE POLICY "Instructors can view all progress"
ON student_progress FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM courses
        WHERE courses.id = student_progress.course_id
        AND courses.instructor_id = auth.uid()
    )
);

CREATE POLICY "Students can insert own progress"
ON student_progress FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own progress"
ON student_progress FOR UPDATE
TO authenticated
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

-- ==================================================
-- FIX 3: Force Refresh Progress Data
-- ==================================================

-- If completed_at is NULL but progress is 100, fix it
UPDATE student_progress
SET completed_at = COALESCE(completed_at, updated_at)
WHERE progress_percentage >= 100
AND completed_at IS NULL;

-- ==================================================
-- VERIFICATION QUERY
-- ==================================================

-- Run this after fixes to verify
SELECT 
    c.title as course_title,
    c.id as course_id,
    c.instructor_id,
    COUNT(DISTINCT e.student_id) as enrolled_students,
    COUNT(DISTINCT cm.id) as total_modules,
    COUNT(DISTINCT sp.module_id) as progress_entries,
    COUNT(DISTINCT CASE WHEN sp.completed_at IS NOT NULL THEN sp.module_id END) as completed_modules,
    ROUND(
        COUNT(DISTINCT CASE WHEN sp.completed_at IS NOT NULL THEN sp.module_id END)::numeric / 
        NULLIF(COUNT(DISTINCT cm.id) * COUNT(DISTINCT e.student_id), 0) * 100,
        2
    ) as calculated_progress_percentage
FROM courses c
LEFT JOIN enrollments e ON c.id = e.course_id
LEFT JOIN course_modules cm ON c.id = cm.course_id
LEFT JOIN student_progress sp ON c.id = sp.course_id
WHERE c.id = 'c5025e6f-fa48-4948-81ae-c426937ec815'
GROUP BY c.id, c.title, c.instructor_id;

-- ==================================================
-- FINAL CHECK: What the UI Should Show
-- ==================================================

-- After running fixes, this should return your progress
SELECT 
    'Student Progress' as check_type,
    COUNT(*) as total_entries,
    COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed_entries,
    ROUND(AVG(progress_percentage), 2) as avg_progress
FROM student_progress
WHERE course_id = 'c5025e6f-fa48-4948-81ae-c426937ec815'
AND student_id = '546c3d6d-fe3c-4525-b5a5-d5e353fb39ad';
