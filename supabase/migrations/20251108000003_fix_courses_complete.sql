-- Complete courses table schema fix
-- Handles all possible missing columns

-- First, check current schema and add ALL missing columns

-- Add instructor_id if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courses' 
    AND column_name = 'instructor_id'
  ) THEN
    ALTER TABLE public.courses ADD COLUMN instructor_id UUID;
    -- Add foreign key after adding column
    ALTER TABLE public.courses ADD CONSTRAINT fk_instructor 
      FOREIGN KEY (instructor_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add title if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courses' 
    AND column_name = 'title'
  ) THEN
    ALTER TABLE public.courses ADD COLUMN title TEXT NOT NULL DEFAULT 'Untitled Course';
  END IF;
END $$;

-- Add description if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courses' 
    AND column_name = 'description'
  ) THEN
    ALTER TABLE public.courses ADD COLUMN description TEXT;
  END IF;
END $$;

-- Add category if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courses' 
    AND column_name = 'category'
  ) THEN
    ALTER TABLE public.courses ADD COLUMN category TEXT;
  END IF;
END $$;

-- Add difficulty_level if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courses' 
    AND column_name = 'difficulty_level'
  ) THEN
    ALTER TABLE public.courses ADD COLUMN difficulty_level INTEGER DEFAULT 1;
  END IF;
END $$;

-- Add is_published if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courses' 
    AND column_name = 'is_published'
  ) THEN
    ALTER TABLE public.courses ADD COLUMN is_published BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add metadata if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courses' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.courses ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- Add created_at if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courses' 
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.courses ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();
  END IF;
END $$;

-- Add updated_at if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courses' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.courses ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
  END IF;
END $$;

-- Verify final schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'courses'
ORDER BY ordinal_position;

-- Create enrollments table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
  UNIQUE(student_id, course_id)
);

-- Enable RLS
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Policies for enrollments
DROP POLICY IF EXISTS "Users can view their own enrollments" ON public.enrollments;
CREATE POLICY "Users can view their own enrollments" 
ON public.enrollments FOR SELECT 
USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Users can enroll themselves" ON public.enrollments;
CREATE POLICY "Users can enroll themselves" 
ON public.enrollments FOR INSERT 
WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Instructors can view enrollments for their courses" ON public.enrollments;
CREATE POLICY "Instructors can view enrollments for their courses" 
ON public.enrollments FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.courses 
    WHERE courses.id = enrollments.course_id 
    AND courses.instructor_id = auth.uid()
  )
);

-- Create course_modules table
CREATE TABLE IF NOT EXISTS public.course_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  key_points TEXT[],
  estimated_duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(course_id, module_number)
);

-- Enable RLS
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Published course modules viewable" ON public.course_modules;
CREATE POLICY "Published course modules viewable" 
ON public.course_modules FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.courses 
    WHERE courses.id = course_modules.course_id 
    AND (courses.is_published = true OR courses.instructor_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Instructors manage modules" ON public.course_modules;
CREATE POLICY "Instructors manage modules" 
ON public.course_modules FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.courses 
    WHERE courses.id = course_modules.course_id 
    AND courses.instructor_id = auth.uid()
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_courses_instructor ON public.courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_courses_published ON public.courses(is_published);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_modules_course ON public.course_modules(course_id);
CREATE INDEX IF NOT EXISTS idx_modules_course_number ON public.course_modules(course_id, module_number);

-- Success message
SELECT 'Migration completed successfully! All columns added.' as result;
