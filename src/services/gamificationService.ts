/**
 * Gamification Service - Phase 4F
 * Manages XP, levels, achievements, badges, and leaderboards
 */

import { supabase } from '@/lib/supabase'

// ========================================
// Types
// ========================================

export interface StudentXP {
  id: string
  studentId: string
  courseId: string
  totalXp: number
  level: number
  xpToNextLevel: number
  currentStreakDays: number
  longestStreakDays: number
  lastActivityDate: string
}

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  category: string
  requirementType: string
  requirementValue: number
  xpReward: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

export interface StudentAchievement {
  id: string
  studentId: string
  achievementId: string
  courseId: string
  earnedAt: string
  achievement?: Achievement
}

export interface LeaderboardEntry {
  studentId: string
  email: string
  totalXp: number
  level: number
  currentStreakDays: number
  badgeCount: number
  rank: number
}

// ========================================
// XP and Level Functions
// ========================================

export async function getStudentXP(
  studentId: string,
  courseId: string
): Promise<StudentXP | null> {
  try {
    const { data, error } = await supabase
      .from('student_xp')
      .select('*')
      .eq('student_id', studentId)
      .eq('course_id', courseId)
      .maybeSingle()

    if (error) throw error

    if (!data) return null

    return {
      id: data.id,
      studentId: data.student_id,
      courseId: data.course_id,
      totalXp: data.total_xp,
      level: data.level,
      xpToNextLevel: data.xp_to_next_level,
      currentStreakDays: data.current_streak_days,
      longestStreakDays: data.longest_streak_days,
      lastActivityDate: data.last_activity_date
    }
  } catch (error) {
    console.error('Error fetching student XP:', error)
    return null
  }
}

export async function awardXP(
  studentId: string,
  courseId: string,
  xpAmount: number,
  reason?: string
): Promise<void> {
  try {
    const { error } = await supabase.rpc('award_xp', {
      p_student_id: studentId,
      p_course_id: courseId,
      p_xp_amount: xpAmount
    })

    if (error) throw error

    console.log(`✨ Awarded ${xpAmount} XP! ${reason || ''}`)
  } catch (error) {
    console.error('Error awarding XP:', error)
  }
}

// ========================================
// Achievements
// ========================================

export async function getAllAchievements(): Promise<Achievement[]> {
  try {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .order('rarity', { ascending: true })

    if (error) throw error

    return (data || []).map(a => ({
      id: a.id,
      name: a.name,
      description: a.description,
      icon: a.icon,
      category: a.category,
      requirementType: a.requirement_type,
      requirementValue: a.requirement_value,
      xpReward: a.xp_reward,
      rarity: a.rarity as Achievement['rarity']
    }))
  } catch (error) {
    console.error('Error fetching achievements:', error)
    return []
  }
}

export async function getStudentAchievements(
  studentId: string,
  courseId?: string
): Promise<StudentAchievement[]> {
  try {
    let query = supabase
      .from('student_achievements')
      .select(`
        *,
        achievements (*)
      `)
      .eq('student_id', studentId)
      .order('earned_at', { ascending: false })

    if (courseId) {
      query = query.eq('course_id', courseId)
    }

    const { data, error } = await query

    if (error) throw error

    return (data || []).map(sa => ({
      id: sa.id,
      studentId: sa.student_id,
      achievementId: sa.achievement_id,
      courseId: sa.course_id,
      earnedAt: sa.earned_at,
      achievement: sa.achievements ? {
        id: sa.achievements.id,
        name: sa.achievements.name,
        description: sa.achievements.description,
        icon: sa.achievements.icon,
        category: sa.achievements.category,
        requirementType: sa.achievements.requirement_type,
        requirementValue: sa.achievements.requirement_value,
        xpReward: sa.achievements.xp_reward,
        rarity: sa.achievements.rarity
      } : undefined
    }))
  } catch (error) {
    console.error('Error fetching student achievements:', error)
    return []
  }
}

export async function checkAndAwardAchievements(
  studentId: string,
  courseId: string
): Promise<StudentAchievement[]> {
  try {
    // Get all achievements
    const allAchievements = await getAllAchievements()
    
    // Get already earned achievements
    const earned = await getStudentAchievements(studentId, courseId)
    const earnedIds = new Set(earned.map(e => e.achievementId))
    
    // Get student stats
    const { data: quizData } = await supabase
      .from('enhanced_quiz_attempts')
      .select('*')
      .eq('student_id', studentId)
      .eq('course_id', courseId)
    
    const { data: xpData } = await supabase
      .from('student_xp')
      .select('*')
      .eq('student_id', studentId)
      .eq('course_id', courseId)
      .maybeSingle()
    
    const quizCount = quizData?.length || 0
    const perfectCount = quizData?.filter(q => q.percentage === 100).length || 0
    const streakDays = xpData?.current_streak_days || 0
    const fastQuizCount = quizData?.filter(q => q.time_spent < 120).length || 0
    
    // Check achievements
    const newAchievements: StudentAchievement[] = []
    
    for (const achievement of allAchievements) {
      if (earnedIds.has(achievement.id)) continue
      
      let earned = false
      
      switch (achievement.requirementType) {
        case 'quiz_count':
          earned = quizCount >= achievement.requirementValue
          break
        case 'perfect_count':
          earned = perfectCount >= achievement.requirementValue
          break
        case 'streak_days':
          earned = streakDays >= achievement.requirementValue
          break
        case 'fast_quiz':
          earned = fastQuizCount >= achievement.requirementValue
          break
      }
      
      if (earned) {
        // Award achievement
        const { data: newAch, error } = await supabase
          .from('student_achievements')
          .insert({
            student_id: studentId,
            achievement_id: achievement.id,
            course_id: courseId
          })
          .select()
          .single()
        
        if (!error && newAch) {
          newAchievements.push({
            id: newAch.id,
            studentId: newAch.student_id,
            achievementId: newAch.achievement_id,
            courseId: newAch.course_id,
            earnedAt: newAch.earned_at,
            achievement
          })
          
          // Award XP for achievement
          await awardXP(studentId, courseId, achievement.xpReward, `Achievement: ${achievement.name}`)
          
          console.log(`🏆 Achievement Unlocked: ${achievement.name}!`)
        }
      }
    }
    
    return newAchievements
  } catch (error) {
    console.error('Error checking achievements:', error)
    return []
  }
}

// ========================================
// Leaderboard
// ========================================

export async function getCourseLeaderboard(
  courseId: string,
  limit: number = 10
): Promise<LeaderboardEntry[]> {
  try {
    const { data, error } = await supabase
      .from('course_leaderboard')
      .select('*')
      .eq('course_id', courseId)
      .order('rank', { ascending: true })
      .limit(limit)

    if (error) throw error

    return (data || []).map(entry => ({
      studentId: entry.student_id,
      email: entry.email,
      totalXp: entry.total_xp,
      level: entry.level,
      currentStreakDays: entry.current_streak_days,
      badgeCount: entry.badge_count,
      rank: entry.rank
    }))
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return []
  }
}

// ========================================
// Helper Functions
// ========================================

export function getXPForLevel(level: number): number {
  return level * level * 100
}

export function getLevelFromXP(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1
}

export function getRarityColor(rarity: Achievement['rarity']): string {
  switch (rarity) {
    case 'common': return 'text-gray-400'
    case 'rare': return 'text-blue-400'
    case 'epic': return 'text-purple-400'
    case 'legendary': return 'text-yellow-400'
    default: return 'text-gray-400'
  }
}

export function getRarityBg(rarity: Achievement['rarity']): string {
  switch (rarity) {
    case 'common': return 'bg-gray-500/20'
    case 'rare': return 'bg-blue-500/20'
    case 'epic': return 'bg-purple-500/20'
    case 'legendary': return 'bg-yellow-500/20'
    default: return 'bg-gray-500/20'
  }
}
