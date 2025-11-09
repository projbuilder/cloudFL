import { useState, useEffect } from 'react'
import { useAuth } from '@/core/auth'
import { supabase } from '@/lib/supabase'
import { Clock, TrendingUp, Award, RefreshCw, Eye, Calendar, Target } from 'lucide-react'
import type { QuizAttempt } from '@/types/enhancedQuiz'

interface Props {
  courseId: string
  onReview?: (attemptId: string) => void
  onRetake?: (moduleId: string, difficulty: 'easy' | 'medium' | 'hard') => void
}

export function QuizHistory({ courseId, onReview, onRetake }: Props) {
  const { user } = useAuth()
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all')
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date')

  useEffect(() => {
    if (user) {
      loadQuizHistory()
    }
  }, [user, courseId])

  async function loadQuizHistory() {
    if (!user) return
    
    setLoading(true)
    try {
      console.log('📜 Loading quiz history for:', { user_id: user.id, course_id: courseId })
      
      const { data, error } = await supabase
        .from('enhanced_quiz_attempts')
        .select(`
          *,
          enhanced_quizzes(
            title,
            module_id
          ),
          course_modules!inner(
            title,
            module_number
          )
        `)
        .eq('student_id', user.id)
        .eq('course_id', courseId)
        .order('completed_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('❌ Error loading quiz history:', error)
        throw error
      }

      console.log('✅ Loaded quiz attempts:', data?.length || 0)
      setAttempts(data || [])
    } catch (error) {
      console.error('Error loading quiz history:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredAttempts = attempts
    .filter(a => filter === 'all' || a.difficulty === filter)
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.completed_at || b.started_at).getTime() - 
               new Date(a.completed_at || a.started_at).getTime()
      } else {
        return b.percentage - a.percentage
      }
    })

  // Calculate statistics
  const stats = {
    total: attempts.length,
    avgScore: attempts.length > 0 
      ? attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length 
      : 0,
    bestScore: attempts.length > 0 
      ? Math.max(...attempts.map(a => a.percentage)) 
      : 0,
    recentTrend: attempts.length >= 3
      ? (attempts.slice(0, 3).reduce((sum, a) => sum + a.percentage, 0) / 3) -
        (attempts.slice(-3).reduce((sum, a) => sum + a.percentage, 0) / 3)
      : 0
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fl-primary"></div>
      </div>
    )
  }

  if (attempts.length === 0) {
    return (
      <div className="text-center py-12 glass-card rounded-xl p-8">
        <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-bold mb-2">No Quiz History Yet</h3>
        <p className="text-muted-foreground mb-6">
          Take your first quiz to start tracking your progress!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total Quizzes</span>
            <Target className="w-5 h-5 text-fl-primary" />
          </div>
          <div className="text-3xl font-bold text-fl-primary">{stats.total}</div>
        </div>

        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Average Score</span>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-blue-500">
            {stats.avgScore.toFixed(0)}%
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Best Score</span>
            <Award className="w-5 h-5 text-yellow-500" />
          </div>
          <div className="text-3xl font-bold text-yellow-500">
            {stats.bestScore.toFixed(0)}%
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Recent Trend</span>
            <TrendingUp className={`w-5 h-5 ${stats.recentTrend >= 0 ? 'text-green-500' : 'text-red-500'}`} />
          </div>
          <div className={`text-3xl font-bold ${stats.recentTrend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {stats.recentTrend >= 0 ? '+' : ''}{stats.recentTrend.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Filters and Sort */}
      <div className="glass-card p-4 rounded-xl">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === 'all'
                  ? 'bg-fl-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('easy')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === 'easy'
                  ? 'bg-green-500 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Easy
            </button>
            <button
              onClick={() => setFilter('medium')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === 'medium'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Medium
            </button>
            <button
              onClick={() => setFilter('hard')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === 'hard'
                  ? 'bg-red-500 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Hard
            </button>
          </div>

          <div className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <button
              onClick={() => setSortBy('date')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                sortBy === 'date'
                  ? 'bg-fl-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Date
            </button>
            <button
              onClick={() => setSortBy('score')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                sortBy === 'score'
                  ? 'bg-fl-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Score
            </button>
          </div>
        </div>
      </div>

      {/* Quiz Attempts List */}
      <div className="space-y-4">
        {filteredAttempts.map((attempt) => {
          const passed = attempt.percentage >= 60
          const quizData = (attempt as any).enhanced_quizzes
          const moduleData = (attempt as any).course_modules

          return (
            <div key={attempt.id} className="glass-card p-6 rounded-xl hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h4 className="font-bold text-lg mb-2">
                    {quizData?.title || `Module ${moduleData?.module_number || ''}: ${moduleData?.title || 'Quiz'}`}
                  </h4>
                  <div className="flex gap-2 flex-wrap">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        attempt.difficulty === 'easy'
                          ? 'bg-green-500/20 text-green-500'
                          : attempt.difficulty === 'medium'
                          ? 'bg-yellow-500/20 text-yellow-500'
                          : 'bg-red-500/20 text-red-500'
                      }`}
                    >
                      {attempt.difficulty.toUpperCase()}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        passed
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-yellow-500/20 text-yellow-500'
                      }`}
                    >
                      {passed ? '✓ PASSED' : '○ NEEDS REVIEW'}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-4xl font-bold ${
                    passed ? 'text-green-500' : 'text-yellow-500'
                  }`}>
                    {attempt.percentage.toFixed(0)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {attempt.score.toFixed(1)}/{attempt.max_score} pts
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(attempt.completed_at || attempt.started_at).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {attempt.time_spent ? `${Math.floor(attempt.time_spent / 60)}m ${attempt.time_spent % 60}s` : 'N/A'}
                </div>
              </div>

              {/* Personalized Feedback */}
              {attempt.personalized_feedback && (
                <div className="mb-4 p-3 bg-fl-primary/5 rounded-lg border border-fl-primary/20">
                  <p className="text-sm text-foreground">{attempt.personalized_feedback}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => onReview && onReview(attempt.id)}
                  className="flex-1 px-4 py-2 bg-fl-primary text-white rounded-lg hover:bg-fl-primary/90 transition-all font-medium flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Review Answers
                </button>
                <button
                  onClick={() => onRetake && onRetake(attempt.module_id, attempt.difficulty)}
                  className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-all font-medium flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retake Quiz
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {filteredAttempts.length === 0 && (
        <div className="text-center py-8 glass-card rounded-xl p-6">
          <p className="text-muted-foreground">No quizzes found for this filter</p>
        </div>
      )}
    </div>
  )
}
