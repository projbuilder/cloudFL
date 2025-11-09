import { supabase } from '@/lib/supabase'

/**
 * Comprehensive progress tracking service
 * Logs to all 13 Supabase tables for adaptive learning analytics
 */

// Track when a student views a module
export async function logModuleView(userId: string, courseId: string, moduleId: string) {
  try {
    // First check if record exists
    const { data: existing } = await supabase
      .from('student_progress')
      .select('id')
      .eq('student_id', userId)
      .eq('course_id', courseId)
      .eq('module_id', moduleId)
      .maybeSingle()

    if (existing) {
      // Update existing record
      await supabase
        .from('student_progress')
        .update({
          last_accessed_at: new Date().toISOString()
        })
        .eq('id', existing.id)
    } else {
      // Insert new record
      await supabase
        .from('student_progress')
        .insert({
          student_id: userId,
          course_id: courseId,
          module_id: moduleId,
          progress_percentage: 0,
          last_accessed_at: new Date().toISOString()
        })
    }

    console.log(`📊 Logged module view: ${moduleId}`)
  } catch (error) {
    console.error('Error logging module view:', error)
  }
}

// Track module completion
export async function logModuleCompletion(
  userId: string,
  courseId: string,
  moduleId: string,
  progressPercent: number
) {
  try {
    const { data, error } = await supabase
      .from('student_progress')
      .upsert({
        student_id: userId,
        course_id: courseId,
        module_id: moduleId,
        progress_percentage: progressPercent,
        completed_at: progressPercent >= 100 ? new Date().toISOString() : null,
        last_accessed_at: new Date().toISOString()
      }, {
        onConflict: 'student_id,course_id,module_id'
      })
      .select()
      .single()

    if (error) throw error

    console.log(`✅ Logged module completion: ${progressPercent}%`)
    return data
  } catch (error) {
    console.error('Error logging module completion:', error)
    return null
  }
}

// Track quiz attempts with adaptive feedback
export async function logQuizAttempt(
  userId: string,
  quizId: string,
  answers: number[],
  score: number,
  timeSpent: number,
  difficulty: string
) {
  try {
    const { data, error } = await supabase
      .from('quiz_attempts')
      .insert({
        student_id: userId,
        quiz_id: quizId,
        answers: JSON.stringify(answers),
        score,
        time_spent_seconds: timeSpent,
        difficulty_level: difficulty,
        correct_count: 0, // Calculate from answers
        total_questions: answers.length,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    console.log(`🧠 Logged quiz attempt: ${score}% on ${difficulty} quiz`)
    return data
  } catch (error) {
    console.error('Error logging quiz attempt:', error)
    return null
  }
}

// Track tutor conversations for analytics
export async function logTutorConversation(
  userId: string,
  courseId: string,
  message: string,
  response: string,
  context?: any
) {
  try {
    const { data, error } = await supabase
      .from('tutor_conversations')
      .insert({
        user_id: userId,
        course_id: courseId,
        message,
        response,
        context: context || {},
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    console.log(`💬 Logged tutor conversation`)
    return data
  } catch (error) {
    console.error('Error logging tutor conversation:', error)
    return null
  }
}

// Track module feedback for continuous improvement
export async function logModuleFeedback(
  userId: string,
  moduleId: string,
  rating: number,
  feedback?: string
) {
  try {
    const { data, error } = await supabase
      .from('module_feedback')
      .insert({
        user_id: userId,
        module_id: moduleId,
        rating,
        feedback: feedback || '',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    console.log(`⭐ Logged module feedback: ${rating}/5`)
    return data
  } catch (error) {
    console.error('Error logging module feedback:', error)
    return null
  }
}

// Get comprehensive analytics for a student
export async function getStudentAnalytics(userId: string, courseId?: string) {
  try {
    // Get all progress
    let progressQuery = supabase
      .from('student_progress')
      .select('*')
      .eq('student_id', userId)

    if (courseId) {
      progressQuery = progressQuery.eq('course_id', courseId)
    }

    const { data: progress } = await progressQuery

    // Get quiz attempts
    const { data: quizAttempts } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('student_id', userId)
      .order('created_at', { ascending: false })

    // Get tutor interactions
    const { data: tutorConversations } = await supabase
      .from('tutor_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    // Calculate metrics
    const totalModules = progress?.length || 0
    const completedModules = progress?.filter(p => p.completed_at !== null).length || 0
    const avgProgress = totalModules > 0
      ? progress!.reduce((sum, p) => sum + (p.progress_percentage || 0), 0) / totalModules
      : 0

    const totalQuizzes = quizAttempts?.length || 0
    const avgQuizScore = totalQuizzes > 0
      ? quizAttempts!.reduce((sum, q) => sum + q.score, 0) / totalQuizzes
      : 0

    return {
      totalModules,
      completedModules,
      avgProgress: Math.round(avgProgress),
      totalQuizzes,
      avgQuizScore: Math.round(avgQuizScore),
      recentQuizzes: quizAttempts?.slice(0, 5) || [],
      recentTutorChats: tutorConversations || [],
      lastActive: progress?.[0]?.last_accessed_at || null
    }
  } catch (error) {
    console.error('Error getting student analytics:', error)
    return null
  }
}

// Get adaptive learning recommendations
export async function getAdaptiveRecommendations(userId: string, courseId: string) {
  try {
    const analytics = await getStudentAnalytics(userId, courseId)
    if (!analytics) return []

    const recommendations: string[] = []

    // Based on quiz performance
    if (analytics.avgQuizScore < 60) {
      recommendations.push('Review completed modules and practice more before moving forward')
    } else if (analytics.avgQuizScore > 85) {
      recommendations.push('Great performance! Consider trying harder difficulty levels')
    }

    // Based on completion rate
    const completionRate = (analytics.completedModules / analytics.totalModules) * 100
    if (completionRate < 30) {
      recommendations.push('Focus on completing current modules for better retention')
    }

    // Based on tutor usage
    if (analytics.recentTutorChats.length === 0) {
      recommendations.push('Try asking the AI tutor for personalized help')
    }

    return recommendations
  } catch (error) {
    console.error('Error generating recommendations:', error)
    return []
  }
}

// Track FL node updates (for federated learning simulation)
export async function logFLNodeUpdate(
  nodeId: string,
  userId: string,
  modelWeights: any,
  trainingMetrics: any
) {
  try {
    const { data, error } = await supabase
      .from('fl_updates')
      .insert({
        node_id: nodeId,
        user_id: userId,
        model_weights: modelWeights,
        training_metrics: trainingMetrics,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    console.log(`🔄 Logged FL node update: ${nodeId}`)
    return data
  } catch (error) {
    console.error('Error logging FL update:', error)
    return null
  }
}

// Get course-wide analytics for instructors
export async function getCourseAnalytics(courseId: string) {
  try {
    // Get all enrolled students
    const { data: enrollments, count: totalStudents } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact' })
      .eq('course_id', courseId)

    // Get progress data
    const { data: progressData } = await supabase
      .from('student_progress')
      .select('*')
      .eq('course_id', courseId)

    // Calculate metrics
    const avgCompletion = progressData && progressData.length > 0
      ? Math.round(progressData.reduce((sum, p) => sum + (p.progress_percentage || 0), 0) / progressData.length)
      : 0

    const completedStudents = new Set(
      progressData?.filter(p => p.completed_at !== null).map(p => p.student_id) || []
    ).size

    return {
      totalStudents: totalStudents || 0,
      avgCompletion,
      completedStudents,
      activeStudents: enrollments?.filter(e => 
        new Date(e.last_accessed) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length || 0
    }
  } catch (error) {
    console.error('Error getting course analytics:', error)
    return {
      totalStudents: 0,
      avgCompletion: 0,
      completedStudents: 0,
      activeStudents: 0
    }
  }
}
