-- ============================================
-- FEDERATED LEARNING E-LEARNING PLATFORM
-- Database Schema with pgvector for RAG
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing tables if they exist (for clean slate)
DROP TABLE IF EXISTS quiz_attempts CASCADE;
DROP TABLE IF EXISTS quizzes CASCADE;
DROP TABLE IF EXISTS course_embeddings CASCADE;
DROP TABLE IF EXISTS course_modules CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS student_profiles CASCADE;
DROP TABLE IF EXISTS courses CASCADE;

-- ============================================
-- COURSES TABLE
-- ============================================
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  instructor_name TEXT,
  level TEXT CHECK (level IN ('Beginner', 'Intermediate', 'Advanced')),
  duration TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COURSE MODULES (AI-transformed content)
-- ============================================
CREATE TABLE course_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  module_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT NOT NULL,
  key_points JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VECTOR EMBEDDINGS FOR RAG
-- ============================================
CREATE TABLE course_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  module_id UUID REFERENCES course_modules(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(768), -- Gemini embedding dimension
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create vector similarity search index
CREATE INDEX ON course_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- QUIZZES
-- ============================================
CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id UUID REFERENCES course_modules(id) ON DELETE CASCADE,
  title TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STUDENT QUIZ ATTEMPTS (for adaptive learning)
-- ============================================
CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID, -- Will be NULL for demo
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  score FLOAT CHECK (score >= 0 AND score <= 1),
  answers JSONB,
  time_spent INTEGER, -- seconds
  difficulty_adjusted_to TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STUDENT PROFILES (for FL personalization)
-- ============================================
CREATE TABLE student_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_name TEXT,
  current_difficulty TEXT DEFAULT 'medium',
  learning_style TEXT DEFAULT 'balanced',
  performance_history JSONB DEFAULT '[]'::jsonb,
  local_model_version INTEGER DEFAULT 1,
  last_sync TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CHAT MESSAGES (AI tutor conversations)
-- ============================================
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID,
  message TEXT NOT NULL,
  role TEXT CHECK (role IN ('user', 'assistant')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PUBLIC READ POLICIES (for demo purposes)
-- ============================================
CREATE POLICY "Public read courses" ON courses FOR SELECT USING (true);
CREATE POLICY "Public insert courses" ON courses FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read modules" ON course_modules FOR SELECT USING (true);
CREATE POLICY "Public insert modules" ON course_modules FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read embeddings" ON course_embeddings FOR SELECT USING (true);
CREATE POLICY "Public insert embeddings" ON course_embeddings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read quizzes" ON quizzes FOR SELECT USING (true);
CREATE POLICY "Public insert quizzes" ON quizzes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public all quiz_attempts" ON quiz_attempts FOR ALL USING (true);
CREATE POLICY "Public all profiles" ON student_profiles FOR ALL USING (true);
CREATE POLICY "Public all messages" ON chat_messages FOR ALL USING (true);

-- ============================================
-- STORAGE POLICIES FOR COURSE MATERIALS BUCKET
-- ============================================
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read course materials" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'course-materials');

CREATE POLICY "Public upload course materials" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'course-materials' AND auth.role() IN ('anon', 'authenticated', 'service_role')
  );

CREATE POLICY "Public update course materials" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'course-materials' AND auth.role() IN ('anon', 'authenticated', 'service_role')
  )
  WITH CHECK (
    bucket_id = 'course-materials' AND auth.role() IN ('anon', 'authenticated', 'service_role')
  );

-- ============================================
-- VECTOR SIMILARITY SEARCH FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION match_course_content(
  query_embedding vector(768),
  course_id_param UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  module_id UUID,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    course_embeddings.id,
    course_embeddings.module_id,
    course_embeddings.content,
    1 - (course_embeddings.embedding <=> query_embedding) AS similarity
  FROM course_embeddings
  WHERE 
    course_embeddings.course_id = course_id_param
    AND 1 - (course_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY course_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- INSERT DEMO COURSE
-- ============================================
INSERT INTO courses (id, title, description, instructor_name, level, duration, thumbnail_url)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  'Introduction to Federated Learning',
  'Learn privacy-preserving machine learning with hands-on projects. Understand how FL works, implement client-side training, and build real-world applications.',
  'Dr. Sarah Chen',
  'Intermediate',
  '8 weeks',
  'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800'
);

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ===============================================';
  RAISE NOTICE '✅ DATABASE SETUP COMPLETE!';
  RAISE NOTICE '✅ ===============================================';
  RAISE NOTICE '✅ Tables created with pgvector support';
  RAISE NOTICE '✅ Row Level Security enabled';
  RAISE NOTICE '✅ Vector search function ready';
  RAISE NOTICE '✅ Demo course inserted';
  RAISE NOTICE '';
  RAISE NOTICE '📋 NEXT STEPS:';
  RAISE NOTICE '   1. Go to Storage → Create bucket: "course-materials" (Public)';
  RAISE NOTICE '   2. Copy demo course ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  RAISE NOTICE '   3. Start uploading PDFs!';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Your FL E-Learning Platform is ready!';
  RAISE NOTICE '===============================================';
END $$;
