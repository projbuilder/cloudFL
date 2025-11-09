-- Debug Progress Issue
-- Run this to see what's actually in the database

-- 1. Check student_progress table
SELECT 
    sp.module_id,
    sp.progress_percentage,
    sp.completed_at,
    cm.title as module_title,
    cm.module_number
FROM student_progress sp
LEFT JOIN course_modules cm ON sp.module_id = cm.id
WHERE sp.student_id = 'YOUR_STUDENT_ID' -- Replace with actual student ID
ORDER BY cm.module_number;

-- 2. Count completed modules
SELECT 
    COUNT(*) as total_modules,
    COUNT(sp.completed_at) as completed_modules
FROM course_modules cm
LEFT JOIN student_progress sp ON cm.id = sp.module_id 
    AND sp.student_id = 'YOUR_STUDENT_ID' -- Replace
WHERE cm.course_id = 'YOUR_COURSE_ID'; -- Replace

-- 3. Show which module is supposedly complete
SELECT * FROM student_progress 
WHERE student_id = 'YOUR_STUDENT_ID' -- Replace
AND progress_percentage = 100;

-- 4. Check if completed_at is set
SELECT * FROM student_progress 
WHERE student_id = 'YOUR_STUDENT_ID' -- Replace
AND completed_at IS NOT NULL;

-- TO GET YOUR IDS:
-- Student ID:
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Course ID:
SELECT id, title FROM courses WHERE title LIKE '%Computing%';
