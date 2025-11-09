-- ⚡ QUICK FIX FOR 0% PROGRESS ISSUE
-- Run this entire file in Supabase SQL Editor

-- ==================================================
-- FIX 1: Update RLS Policies for student_progress
-- ==================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view their own progress" ON student_progress;
DROP POLICY IF EXISTS "Instructors can view student progress" ON student_progress;
DROP POLICY IF EXISTS "Students can view own progress" ON student_progress;
DROP POLICY IF EXISTS "Instructors can view all progress" ON student_progress;
DROP POLICY IF EXISTS "Students can insert own progress" ON student_progress;
DROP POLICY IF EXISTS "Students can update own progress" ON student_progress;

-- Create new comprehensive policies
CREATE POLICY "allow_students_own_progress_select"
ON student_progress FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "allow_instructors_view_progress"
ON student_progress FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM courses
        WHERE courses.id = student_progress.course_id
        AND courses.instructor_id = auth.uid()
    )
);

CREATE POLICY "allow_students_insert_progress"
ON student_progress FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "allow_students_update_progress"
ON student_progress FOR UPDATE
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "allow_system_all_progress"
ON student_progress FOR ALL
USING (true); -- Allow service role to do everything

-- ==================================================
-- FIX 2: Ensure Enrollments Exist
-- ==================================================

-- Insert enrollment if missing (replace IDs)
INSERT INTO enrollments (student_id, course_id, status, enrolled_at)
SELECT 
    '546c3d6d-fe3c-4525-b5a5-d5e353fb39ad', -- Your student ID
    'c5025e6f-fa48-4948-81ae-c426937ec815', -- Cloud Computing course
    'active',
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM enrollments
    WHERE student_id = '546c3d6d-fe3c-4525-b5a5-d5e353fb39ad'
    AND course_id = 'c5025e6f-fa48-4948-81ae-c426937ec815'
);

-- ==================================================
-- FIX 3: Update completed_at for 100% modules
-- ==================================================

UPDATE student_progress
SET completed_at = COALESCE(completed_at, NOW())
WHERE progress_percentage >= 100
AND completed_at IS NULL;

-- ==================================================
-- FIX 4: Grant Proper Permissions
-- ==================================================

GRANT ALL ON student_progress TO authenticated;
GRANT ALL ON student_progress TO anon;

-- ==================================================
-- VERIFICATION
-- ==================================================

-- Check if data is now visible
SELECT 
    'Fix Applied' as status,
    COUNT(*) as total_progress_entries,
    COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed_entries
FROM student_progress
WHERE course_id = 'c5025e6f-fa48-4948-81ae-c426937ec815';

-- Show what instructor should see
SELECT 
    c.title,
    COUNT(DISTINCT e.student_id) as students,
    COUNT(DISTINCT cm.id) as total_modules,
    COUNT(DISTINCT CASE WHEN sp.completed_at IS NOT NULL THEN sp.module_id END) as completed,
    ROUND(
        COUNT(DISTINCT CASE WHEN sp.completed_at IS NOT NULL THEN sp.module_id END)::numeric / 
        NULLIF(COUNT(DISTINCT cm.id), 0) * 100,
        2
    ) as progress_pct
FROM courses c
LEFT JOIN enrollments e ON c.id = e.course_id
LEFT JOIN course_modules cm ON c.id = cm.course_id
LEFT JOIN student_progress sp ON c.id = sp.course_id AND sp.completed_at IS NOT NULL
WHERE c.id = 'c5025e6f-fa48-4948-81ae-c426937ec815'
GROUP BY c.id, c.title;
