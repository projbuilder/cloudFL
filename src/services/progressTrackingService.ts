/**
 * Enhanced Progress Tracking Service - Phase 2B
 * 
 * Provides detailed analytics on student learning:
 * - Module-level performance tracking
 * - Quiz attempt history and analytics
 * - Study time tracking
 * - Strengths and weaknesses identification
 * - Personalized recommendations
 */

import { supabase } from '@/lib/supabase'

// ========================================
// Types
// ========================================

export interface ModuleProgress {
  moduleId: string
  moduleTitle: string
  progress: number // 0-100
  quizAttempts: number
  avgQuizScore: number
  timeSpentMinutes: number
  completed: boolean
  completedAt?: string
  strengthTopics: string[]
  weaknessTopics: string[]
}

export interface QuizAttempt {
  id: string
  quizId: string
  moduleId: string
  score: number
  correctCount: number
  totalQuestions: number
  timeSpentSeconds: number
  difficulty: string
  topicsCorrect: string[]
  topicsIncorrect: string[]
  createdAt: string
}

export interface StudySession {
  id: string
  moduleId: string
  moduleTitle: string
  startedAt: string
  endedAt?: string
  durationSeconds?: number
  completed: boolean
}

export interface LearningAnalytics {
  studentId: string
  courseId: string
  overallScore: number
  studyTimeTotal: number // minutes
  avgSessionDuration: number // minutes
  studyConsistency: number // 0-100
  strongTopics: string[]
  weakTopics: string[]
  improvementRate: number
  recommendedModules: string[]
  recommendedFocusAreas: string[]
  activityStreak: number
  lastActivityAt: string
}

export interface CourseInsights {
  totalModules: number
  completedModules: number
  averageScore: number
  totalStudyTime: number
  quizAttempts: number
  strengths: Array<{ topic: string; confidence: number }>
  weaknesses: Array<{ topic: string; needsWork: number }>
  recommendations: string[]
  progressTrend: Array<{ date: string; score: number }>
}

// ========================================
// Module Progress Tracking
// ========================================

export async function getModuleProgress(
  studentId: string,
  courseId: string
): Promise<ModuleProgress[]> {
  try {
    // Get all modules for the course
    const { data: modules, error: modulesError } = await supabase
      .from('course_modules')
      .select('id, title, module_number')
      .eq('course_id', courseId)
      .order('module_number')

    if (modulesError) throw modulesError
    if (!modules || modules.length === 0) return []

    // Get progress for each module
    const moduleProgress = await Promise.all(
      modules.map(async (module) => {
        try {
          const { data: progress, error } = await supabase
            .from('student_progress')
            .select('*')
            .eq('student_id', studentId)
            .eq('module_id', module.id)
            .maybeSingle() // Use maybeSingle to handle 0 rows gracefully

          // If column doesn't exist (406 error), return defaults
          if (error && error.code === 'PGRST116') {
            console.log(`No progress data for module ${module.id} yet`)
          }

          return {
            moduleId: module.id,
            moduleTitle: module.title,
            progress: progress?.progress_percentage || 0,
            quizAttempts: progress?.quiz_attempts || 0,
            avgQuizScore: progress?.quiz_score_avg || 0,
            timeSpentMinutes: progress?.time_spent_minutes || 0,
            completed: (progress?.progress_percentage || 0) >= 100,
            completedAt: progress?.completed_at,
            strengthTopics: progress?.strength_topics || [],
            weaknessTopics: progress?.weakness_topics || []
          }
        } catch (moduleError) {
          console.warn(`Error fetching progress for module ${module.id}:`, moduleError)
          // Return default values on error
          return {
            moduleId: module.id,
            moduleTitle: module.title,
            progress: 0,
            quizAttempts: 0,
            avgQuizScore: 0,
            timeSpentMinutes: 0,
            completed: false,
            completedAt: undefined,
            strengthTopics: [],
            weaknessTopics: []
          }
        }
      })
    )

    return moduleProgress
  } catch (error) {
    console.error('Error in getModuleProgress:', error)
    return []
  }
}

export async function updateModuleProgress(
  studentId: string,
  courseId: string,
  moduleId: string,
  updates: {
    progress?: number
    quizAttempts?: number
    avgQuizScore?: number
    timeSpent?: number
    strengthTopics?: string[]
    weaknessTopics?: string[]
  }
): Promise<void> {
  const updateData: any = {
    student_id: studentId,
    course_id: courseId,
    module_id: moduleId,
    progress_percentage: updates.progress,
    quiz_attempts: updates.quizAttempts,
    quiz_score_avg: updates.avgQuizScore,
    time_spent_minutes: updates.timeSpent,
    strength_topics: updates.strengthTopics,
    weakness_topics: updates.weaknessTopics,
    completed_at: updates.progress === 100 ? new Date().toISOString() : null,
    last_accessed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  // Remove undefined values
  Object.keys(updateData).forEach(key => 
    updateData[key] === undefined && delete updateData[key]
  )

  const { error } = await supabase
    .from('student_progress')
    .upsert(updateData, {
      onConflict: 'student_id,course_id,module_id',
      ignoreDuplicates: false
    })

  if (error) throw error

  // Update learning analytics
  await updateLearningAnalyticsInDB(studentId, courseId)
}

// ========================================
// Quiz Attempt Tracking
// ========================================

export async function recordQuizAttempt(params: {
  studentId: string
  quizId: string
  moduleId: string
  courseId: string
  score: number
  answers: any[]
  timeSpentSeconds: number
  difficulty: string
  correctCount: number
  totalQuestions: number
  topicsCorrect?: string[]
  topicsIncorrect?: string[]
}): Promise<string> {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .insert({
      student_id: params.studentId,
      quiz_id: params.quizId,
      module_id: params.moduleId,
      course_id: params.courseId,
      score: params.score,
      answers: params.answers,
      time_spent_seconds: params.timeSpentSeconds,
      difficulty_level: params.difficulty,
      correct_count: params.correctCount,
      total_questions: params.totalQuestions,
      topics_correct: params.topicsCorrect || [],
      topics_incorrect: params.topicsIncorrect || []
    })
    .select('id')
    .single()

  if (error) throw error

  // Update module progress with new quiz data
  const currentProgress = await supabase
    .from('student_progress')
    .select('quiz_attempts, quiz_score_avg')
    .eq('student_id', params.studentId)
    .eq('module_id', params.moduleId)
    .single()

  const attempts = (currentProgress.data?.quiz_attempts || 0) + 1
  const prevAvg = currentProgress.data?.quiz_score_avg || 0
  const newAvg = ((prevAvg * (attempts - 1)) + params.score) / attempts

  await updateModuleProgress(params.studentId, params.courseId, params.moduleId, {
    quizAttempts: attempts,
    avgQuizScore: parseFloat(newAvg.toFixed(2)),
    strengthTopics: params.topicsCorrect,
    weaknessTopics: params.topicsIncorrect
  })

  return data.id
}

export async function getQuizAttempts(
  studentId: string,
  moduleId?: string,
  limit: number = 10
): Promise<QuizAttempt[]> {
  console.log('📊 Fetching quiz attempts from enhanced_quiz_attempts table...')
  
  let query = supabase
    .from('enhanced_quiz_attempts')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (moduleId) {
    query = query.eq('module_id', moduleId)
  }

  const { data, error } = await query

  if (error) {
    console.error('❌ Error fetching quiz attempts:', error)
    throw error
  }

  console.log(`✅ Found ${data?.length || 0} quiz attempts`)

  return (data || []).map(attempt => ({
    id: attempt.id,
    quizId: attempt.quiz_id || 'unknown',
    moduleId: attempt.module_id,
    score: attempt.percentage, // Use percentage instead of score
    correctCount: Math.round((attempt.percentage / 100) * attempt.answers.length), // Estimate
    totalQuestions: attempt.answers.length,
    timeSpentSeconds: attempt.time_spent || 0,
    difficulty: attempt.difficulty,
    topicsCorrect: attempt.strengths || [],
    topicsIncorrect: attempt.weaknesses || [],
    createdAt: attempt.created_at
  }))
}

// ========================================
// Study Session Tracking
// ========================================

export async function startStudySession(
  studentId: string,
  courseId: string,
  moduleId: string
): Promise<string> {
  // End any active sessions first
  await endActiveStudySessions(studentId)

  const { data, error } = await supabase
    .from('module_study_sessions')
    .insert({
      student_id: studentId,
      course_id: courseId,
      module_id: moduleId,
      started_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function endStudySession(
  sessionId: string,
  completed: boolean = false
): Promise<void> {
  const endedAt = new Date()
  
  // Get session start time to calculate duration
  const { data: session } = await supabase
    .from('module_study_sessions')
    .select('started_at, student_id, course_id, module_id')
    .eq('id', sessionId)
    .single()

  if (!session) return

  const startedAt = new Date(session.started_at)
  const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)

  const { error } = await supabase
    .from('module_study_sessions')
    .update({
      ended_at: endedAt.toISOString(),
      duration_seconds: durationSeconds,
      completed
    })
    .eq('id', sessionId)

  if (error) throw error

  // Update total time spent on module
  const { data: currentProgress } = await supabase
    .from('student_progress')
    .select('time_spent_minutes')
    .eq('student_id', session.student_id)
    .eq('module_id', session.module_id)
    .single()

  const currentMinutes = currentProgress?.time_spent_minutes || 0
  const additionalMinutes = Math.floor(durationSeconds / 60)

  await updateModuleProgress(
    session.student_id,
    session.course_id,
    session.module_id,
    { timeSpent: currentMinutes + additionalMinutes }
  )
}

export async function endActiveStudySessions(studentId: string): Promise<void> {
  const { data: activeSessions } = await supabase
    .from('module_study_sessions')
    .select('id')
    .eq('student_id', studentId)
    .is('ended_at', null)

  if (activeSessions) {
    for (const session of activeSessions) {
      await endStudySession(session.id, false)
    }
  }
}

export async function getStudySessions(
  studentId: string,
  moduleId?: string,
  limit: number = 20
): Promise<StudySession[]> {
  let query = supabase
    .from('module_study_sessions')
    .select(`
      *,
      course_modules!inner(title)
    `)
    .eq('student_id', studentId)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (moduleId) {
    query = query.eq('module_id', moduleId)
  }

  const { data, error } = await query

  if (error) throw error

  return data.map(session => ({
    id: session.id,
    moduleId: session.module_id,
    moduleTitle: session.course_modules.title,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    durationSeconds: session.duration_seconds,
    completed: session.completed
  }))
}

// ========================================
// Learning Analytics
// ========================================

async function updateLearningAnalyticsInDB(
  studentId: string,
  courseId: string
): Promise<void> {
  // Call the database function to update analytics
  const { error } = await supabase.rpc('update_learning_analytics', {
    p_student_id: studentId,
    p_course_id: courseId
  })

  if (error) {
    console.error('Error updating learning analytics:', error)
  }
}

export async function getLearningAnalytics(
  studentId: string,
  courseId: string
): Promise<LearningAnalytics | null> {
  try {
    const { data, error } = await supabase
      .from('student_learning_analytics')
      .select('*')
      .eq('student_id', studentId)
      .eq('course_id', courseId)
      .maybeSingle() // Use maybeSingle() instead of single() to avoid 406 errors

    // Handle no data - this is normal for new courses
    if (!data) {
      console.log('No analytics data yet - this is normal for new courses')
      return null
    }

    if (error) {
      console.warn('Analytics query error:', error)
      return null
    }

    return {
      studentId: data.student_id,
      courseId: data.course_id,
      overallScore: data.overall_score,
      studyTimeTotal: data.study_time_total_minutes,
      avgSessionDuration: data.avg_session_duration_minutes,
      studyConsistency: data.study_consistency_score,
      strongTopics: data.strong_topics || [],
      weakTopics: data.weak_topics || [],
      improvementRate: data.improvement_rate,
      recommendedModules: data.recommended_modules || [],
      recommendedFocusAreas: data.recommended_focus_areas || [],
      activityStreak: data.activity_streak_days,
      lastActivityAt: data.last_activity_at
    }
  } catch (error) {
    console.warn('Error fetching learning analytics:', error)
    return null
  }
}

export async function getCourseInsights(
  studentId: string,
  courseId: string
): Promise<CourseInsights> {
  // Get module progress
  const moduleProgress = await getModuleProgress(studentId, courseId)
  
  // Get quiz attempts
  const quizAttempts = await getQuizAttempts(studentId)
  
  // Get analytics
  const analytics = await getLearningAnalytics(studentId, courseId)

  // Calculate insights
  const totalModules = moduleProgress.length
  const completedModules = moduleProgress.filter(m => m.completed).length
  
  // Calculate average score from actual quiz attempts, not from module progress
  const averageScore = quizAttempts.length > 0
    ? quizAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / quizAttempts.length
    : 0
  
  // Calculate total study time from both module viewing and quiz time
  const moduleTime = moduleProgress.reduce((sum, m) => sum + m.timeSpentMinutes, 0)
  const quizTime = quizAttempts.reduce((sum, attempt) => sum + Math.round(attempt.timeSpentSeconds / 60), 0)
  const totalStudyTime = moduleTime + quizTime
  
  console.log(`⏱️ Total Study Time: ${totalStudyTime} min (Module: ${moduleTime} min, Quiz: ${quizTime} min)`)

  // Identify strengths and weaknesses from quiz data
  const topicScores = new Map<string, { correct: number; total: number }>()
  
  // Extract topics from quiz attempts
  const { data: quizData } = await supabase
    .from('enhanced_quiz_attempts')
    .select('difficulty, percentage, answers, module_id, created_at')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })
  
  if (quizData && quizData.length > 0) {
    quizData.forEach(quiz => {
      const difficulty = quiz.difficulty || 'easy'
      const score = quiz.percentage
      
      // Create topic from difficulty and performance
      const topic = `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Level Questions`
      const current = topicScores.get(topic) || { correct: 0, total: 0 }
      
      if (score >= 70) {
        topicScores.set(topic, { correct: current.correct + 1, total: current.total + 1 })
      } else {
        topicScores.set(topic, { correct: current.correct, total: current.total + 1 })
      }
      
      // Add module-based topics
      if (quiz.answers && Array.isArray(quiz.answers)) {
        quiz.answers.forEach((answer: any) => {
          const moduleTopic = `Module Concepts`
          const modCurrent = topicScores.get(moduleTopic) || { correct: 0, total: 0 }
          if (answer.is_correct) {
            topicScores.set(moduleTopic, { correct: modCurrent.correct + 1, total: modCurrent.total + 1 })
          } else {
            topicScores.set(moduleTopic, { correct: modCurrent.correct, total: modCurrent.total + 1 })
          }
        })
      }
    })
  }

  const strengths = Array.from(topicScores.entries())
    .filter(([_, scores]) => scores.total >= 1)
    .map(([topic, scores]) => ({
      topic,
      confidence: (scores.correct / scores.total) * 100
    }))
    .filter(s => s.confidence >= 70)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)

  const weaknesses = Array.from(topicScores.entries())
    .filter(([_, scores]) => scores.total >= 1)
    .map(([topic, scores]) => ({
      topic,
      needsWork: ((scores.total - scores.correct) / scores.total) * 100
    }))
    .filter(w => w.needsWork >= 30)
    .sort((a, b) => b.needsWork - a.needsWork)
    .slice(0, 5)
  
  console.log('💪 Strengths:', strengths)
  console.log('⚠️ Weaknesses:', weaknesses)

  // Generate recommendations
  const recommendations: string[] = []
  
  if (completedModules < totalModules * 0.5) {
    recommendations.push(`Complete more modules - you're ${Math.round((completedModules/totalModules) * 100)}% done`)
  }
  
  if (averageScore < 70) {
    recommendations.push('Review material before taking quizzes - aim for 70%+ scores')
  }
  
  if (analytics && analytics.studyConsistency < 50) {
    recommendations.push('Study more consistently - try to study a bit each day')
  }
  
  if (weaknesses.length > 0) {
    recommendations.push(`Focus on: ${weaknesses[0].topic}`)
  }

  // Get progress trend (last 7 quiz attempts) - make sure we have data
  const progressTrend = quizData && quizData.length > 0
    ? quizData
        .slice(0, 7)
        .reverse()
        .map(quiz => ({
          date: new Date(quiz.created_at || Date.now()).toLocaleDateString(),
          score: quiz.percentage || 0
        }))
    : []
  
  console.log('📊 Progress Trend Data:', progressTrend)

  return {
    totalModules,
    completedModules,
    averageScore: parseFloat(averageScore.toFixed(2)),
    totalStudyTime,
    quizAttempts: quizAttempts.length,
    strengths,
    weaknesses,
    recommendations,
    progressTrend
  }
}
