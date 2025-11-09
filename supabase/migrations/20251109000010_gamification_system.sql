-- ========================================
-- PHASE 4F: Gamification System
-- ========================================
-- Adds achievements, XP, badges, leaderboards, and streaks

-- ========================================
-- 1. Student XP and Levels
-- ========================================

CREATE TABLE IF NOT EXISTS public.student_xp (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  total_xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  xp_to_next_level INTEGER DEFAULT 100,
  current_streak_days INTEGER DEFAULT 0,
  longest_streak_days INTEGER DEFAULT 0,
  last_activity_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_student_xp_student ON public.student_xp(student_id);
CREATE INDEX IF NOT EXISTS idx_student_xp_course ON public.student_xp(course_id);
CREATE INDEX IF NOT EXISTS idx_student_xp_level ON public.student_xp(level DESC);

-- ========================================
-- 2. Achievements/Badges
-- ========================================

CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50), -- Emoji or icon name
  category VARCHAR(50), -- 'quiz', 'streak', 'completion', 'speed', 'perfect'
  requirement_type VARCHAR(50), -- 'quiz_count', 'streak_days', 'perfect_scores', etc.
  requirement_value INTEGER,
  xp_reward INTEGER DEFAULT 0,
  rarity VARCHAR(20) DEFAULT 'common', -- 'common', 'rare', 'epic', 'legendary'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pre-populate achievements
INSERT INTO public.achievements (name, description, icon, category, requirement_type, requirement_value, xp_reward, rarity) VALUES
  ('First Steps', 'Complete your first quiz', '🎯', 'quiz', 'quiz_count', 1, 10, 'common'),
  ('Quiz Master', 'Complete 10 quizzes', '🏆', 'quiz', 'quiz_count', 10, 100, 'rare'),
  ('Quiz Legend', 'Complete 50 quizzes', '👑', 'quiz', 'quiz_count', 50, 500, 'epic'),
  ('Perfect Score', 'Get 100% on any quiz', '💯', 'perfect', 'perfect_count', 1, 50, 'common'),
  ('Perfectionist', 'Get 100% on 5 quizzes', '⭐', 'perfect', 'perfect_count', 5, 200, 'rare'),
  ('Flawless Victory', 'Get 100% on 20 quizzes', '🌟', 'perfect', 'perfect_count', 20, 1000, 'legendary'),
  ('Streak Starter', 'Study for 3 days in a row', '🔥', 'streak', 'streak_days', 3, 30, 'common'),
  ('On Fire', 'Study for 7 days in a row', '🔥🔥', 'streak', 'streak_days', 7, 100, 'rare'),
  ('Unstoppable', 'Study for 30 days in a row', '🔥🔥🔥', 'streak', 'streak_days', 30, 500, 'epic'),
  ('Speed Demon', 'Complete a quiz in under 2 minutes', '⚡', 'speed', 'fast_quiz', 1, 50, 'rare'),
  ('Course Complete', 'Complete all modules in a course', '🎓', 'completion', 'course_completion', 1, 300, 'epic'),
  ('Early Bird', 'Study before 8 AM', '🌅', 'time', 'morning_study', 1, 20, 'common'),
  ('Night Owl', 'Study after 10 PM', '🦉', 'time', 'night_study', 1, 20, 'common'),
  ('Knowledge Seeker', 'Unlock all difficulty levels', '📚', 'progression', 'unlock_all', 1, 150, 'rare'),
  ('FL Contributor', 'Contribute to federated learning 5 times', '🔒', 'fl', 'fl_contributions', 5, 100, 'rare')
ON CONFLICT DO NOTHING;

-- ========================================
-- 3. Student Achievements (Earned Badges)
-- ========================================

CREATE TABLE IF NOT EXISTS public.student_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, achievement_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_student_achievements_student ON public.student_achievements(student_id);
CREATE INDEX IF NOT EXISTS idx_student_achievements_earned ON public.student_achievements(earned_at DESC);

-- ========================================
-- 4. Leaderboard View (Materialized for Performance)
-- ========================================

CREATE OR REPLACE VIEW public.course_leaderboard AS
SELECT 
  sx.student_id,
  sx.course_id,
  u.email,
  sx.total_xp,
  sx.level,
  sx.current_streak_days,
  COUNT(DISTINCT sa.achievement_id) as badge_count,
  ROW_NUMBER() OVER (PARTITION BY sx.course_id ORDER BY sx.total_xp DESC) as rank
FROM public.student_xp sx
JOIN auth.users u ON sx.student_id = u.id
LEFT JOIN public.student_achievements sa ON sx.student_id = sa.student_id AND sx.course_id = sa.course_id
GROUP BY sx.student_id, sx.course_id, u.email, sx.total_xp, sx.level, sx.current_streak_days;

-- ========================================
-- 5. XP Triggers
-- ========================================

-- Function to calculate level from XP
CREATE OR REPLACE FUNCTION calculate_level_from_xp(xp INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- Level formula: level = floor(sqrt(xp / 100)) + 1
  RETURN FLOOR(SQRT(xp::float / 100)) + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate XP needed for next level
CREATE OR REPLACE FUNCTION calculate_xp_for_next_level(current_level INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- XP needed = (level^2) * 100
  RETURN (current_level * current_level) * 100;
END;
$$ LANGUAGE plpgsql;

-- Function to award XP
CREATE OR REPLACE FUNCTION award_xp(
  p_student_id UUID,
  p_course_id UUID,
  p_xp_amount INTEGER
) RETURNS VOID AS $$
DECLARE
  v_new_xp INTEGER;
  v_new_level INTEGER;
  v_xp_for_next INTEGER;
BEGIN
  -- Upsert student XP
  INSERT INTO public.student_xp (student_id, course_id, total_xp, last_activity_date)
  VALUES (p_student_id, p_course_id, p_xp_amount, CURRENT_DATE)
  ON CONFLICT (student_id, course_id)
  DO UPDATE SET
    total_xp = student_xp.total_xp + p_xp_amount,
    last_activity_date = CURRENT_DATE,
    updated_at = NOW();
  
  -- Get new XP total
  SELECT total_xp INTO v_new_xp
  FROM public.student_xp
  WHERE student_id = p_student_id AND course_id = p_course_id;
  
  -- Calculate new level
  v_new_level := calculate_level_from_xp(v_new_xp);
  v_xp_for_next := calculate_xp_for_next_level(v_new_level);
  
  -- Update level
  UPDATE public.student_xp
  SET level = v_new_level, xp_to_next_level = v_xp_for_next - v_new_xp
  WHERE student_id = p_student_id AND course_id = p_course_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update streaks
CREATE OR REPLACE FUNCTION update_streak(
  p_student_id UUID,
  p_course_id UUID
) RETURNS VOID AS $$
DECLARE
  v_last_activity DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
BEGIN
  SELECT last_activity_date, current_streak_days, longest_streak_days
  INTO v_last_activity, v_current_streak, v_longest_streak
  FROM public.student_xp
  WHERE student_id = p_student_id AND course_id = p_course_id;
  
  -- If no previous activity or last activity was today, do nothing
  IF v_last_activity IS NULL OR v_last_activity = CURRENT_DATE THEN
    RETURN;
  END IF;
  
  -- If last activity was yesterday, increment streak
  IF v_last_activity = CURRENT_DATE - INTERVAL '1 day' THEN
    v_current_streak := v_current_streak + 1;
    
    -- Update longest streak if current is longer
    IF v_current_streak > v_longest_streak THEN
      v_longest_streak := v_current_streak;
    END IF;
  ELSE
    -- Streak broken, reset to 1
    v_current_streak := 1;
  END IF;
  
  -- Update streak
  UPDATE public.student_xp
  SET 
    current_streak_days = v_current_streak,
    longest_streak_days = v_longest_streak,
    last_activity_date = CURRENT_DATE
  WHERE student_id = p_student_id AND course_id = p_course_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to award XP on quiz completion
CREATE OR REPLACE FUNCTION award_xp_on_quiz()
RETURNS TRIGGER AS $$
DECLARE
  v_xp_amount INTEGER;
  v_time_bonus INTEGER;
BEGIN
  -- Base XP: 10 * percentage
  v_xp_amount := ROUND(NEW.percentage * 0.1);
  
  -- Difficulty multiplier
  CASE NEW.difficulty
    WHEN 'easy' THEN v_xp_amount := v_xp_amount * 1;
    WHEN 'medium' THEN v_xp_amount := v_xp_amount * 2;
    WHEN 'hard' THEN v_xp_amount := v_xp_amount * 3;
  END CASE;
  
  -- Perfect score bonus
  IF NEW.percentage = 100 THEN
    v_xp_amount := v_xp_amount + 50;
  END IF;
  
  -- Speed bonus (under 2 minutes)
  IF NEW.time_spent < 120 THEN
    v_xp_amount := v_xp_amount + 25;
  END IF;
  
  -- Award XP
  PERFORM award_xp(NEW.student_id, NEW.course_id, v_xp_amount);
  
  -- Update streak
  PERFORM update_streak(NEW.student_id, NEW.course_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_award_xp_on_quiz
  AFTER INSERT ON public.enhanced_quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION award_xp_on_quiz();

-- ========================================
-- 6. RLS Policies
-- ========================================

ALTER TABLE public.student_xp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;

-- Students can view their own XP
CREATE POLICY "Students can view own XP"
  ON public.student_xp FOR SELECT
  USING (auth.uid() = student_id);

-- Students can view all achievements (to see what's available)
CREATE POLICY "Anyone can view achievements"
  ON public.achievements FOR SELECT
  USING (true);

-- Students can view their earned achievements
CREATE POLICY "Students can view own achievements"
  ON public.student_achievements FOR SELECT
  USING (auth.uid() = student_id);

-- Instructors can view all XP for their courses
CREATE POLICY "Instructors can view course XP"
  ON public.student_xp FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = student_xp.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- ========================================
-- 7. Permissions
-- ========================================

GRANT SELECT ON public.student_xp TO authenticated;
GRANT SELECT ON public.achievements TO authenticated;
GRANT SELECT ON public.student_achievements TO authenticated;
GRANT SELECT ON public.course_leaderboard TO authenticated;

-- Success message
SELECT '✅ Gamification system installed!' as status;
