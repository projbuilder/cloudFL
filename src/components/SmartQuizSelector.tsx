import { useState, useEffect } from 'react'
import { useAuth } from '@/core/auth'
import { supabase } from '@/lib/supabase'
import { Sparkles, Clock, Target, TrendingUp, CheckCircle, CheckSquare, FileText, Zap, Lock, Trophy } from 'lucide-react'

interface Props {
  courseId: string
  moduleId: string
  onSelectDifficulty: (difficulty: 'easy' | 'medium' | 'hard') => void
}

interface QuizConfig {
  difficulty: 'easy' | 'medium' | 'hard'
  questionCount: number
  singleChoice: number
  multipleChoice: number
  descriptive: number
  estimatedTime: number
  totalPoints: number
  description: string
}

export function SmartQuizSelector({ courseId, moduleId, onSelectDifficulty }: Props) {
  const { user } = useAuth()
  const [recommended, setRecommended] = useState<'easy' | 'medium' | 'hard'>('easy')
  const [loading, setLoading] = useState(true)
  const [unlockedDifficulties, setUnlockedDifficulties] = useState<Set<string>>(new Set(['easy']))
  const [completedDifficulties, setCompletedDifficulties] = useState<Set<string>>(new Set())
  const [isPerfected, setIsPerfected] = useState(false)

  useEffect(() => {
    if (user) {
      loadRecommendation()
      loadDifficultyProgress()
    }
  }, [user, courseId, moduleId])

  async function loadRecommendation() {
    if (!user) return
    
    setLoading(true)
    try {
      // Call database function to get recommended difficulty
      const { data, error } = await supabase
        .rpc('get_recommended_difficulty', {
          p_student_id: user.id,
          p_course_id: courseId
        })

      if (error) {
        console.error('Error getting recommendation:', error)
        setRecommended('easy') // Default to easy
      } else {
        setRecommended(data || 'easy')
      }
    } catch (error) {
      console.error('Recommendation error:', error)
      setRecommended('easy')
    } finally {
      setLoading(false)
    }
  }

  async function loadDifficultyProgress() {
    if (!user) return

    try {
      // Check quiz attempts for this module to determine unlocked difficulties
      const { data: attempts, error } = await supabase
        .from('enhanced_quiz_attempts')
        .select('difficulty, percentage')
        .eq('student_id', user.id)
        .eq('module_id', moduleId)
        .order('completed_at', { ascending: false })

      if (error) {
        console.error('Error loading difficulty progress:', error)
        return
      }

      if (!attempts || attempts.length === 0) {
        // No attempts yet, only easy is unlocked
        setUnlockedDifficulties(new Set(['easy']))
        return
      }

      const unlocked = new Set(['easy'])
      const completed = new Set<string>()

      // Check each difficulty
      const difficulties = ['easy', 'medium', 'hard']
      
      for (const diff of difficulties) {
        const diffAttempts = attempts.filter(a => a.difficulty === diff)
        if (diffAttempts.length > 0) {
          const bestScore = Math.max(...diffAttempts.map(a => a.percentage))
          
          // If scored 90%+, mark as completed and unlock next
          if (bestScore >= 90) {
            completed.add(diff)
            
            // Unlock next difficulty
            if (diff === 'easy') unlocked.add('medium')
            if (diff === 'medium') unlocked.add('hard')
          }
        }
      }

      setUnlockedDifficulties(unlocked)
      setCompletedDifficulties(completed)
      
      // Check if module is perfected (all 3 difficulties completed with 90%+)
      setIsPerfected(completed.size === 3)
    } catch (error) {
      console.error('Error checking difficulty progress:', error)
    }
  }

  const quizConfigs: QuizConfig[] = [
    {
      difficulty: 'easy',
      questionCount: 5,
      singleChoice: 4,
      multipleChoice: 1,
      descriptive: 0,
      estimatedTime: 5,
      totalPoints: 9,
      description: 'Perfect for beginners or quick review. Focus on basic concepts.'
    },
    {
      difficulty: 'medium',
      questionCount: 7,
      singleChoice: 3,
      multipleChoice: 2,
      descriptive: 2,
      estimatedTime: 15,
      totalPoints: 26,
      description: 'Test your understanding with mixed question types and scenarios.'
    },
    {
      difficulty: 'hard',
      questionCount: 10,
      singleChoice: 2,
      multipleChoice: 3,
      descriptive: 5,
      estimatedTime: 30,
      totalPoints: 53,
      description: 'Challenge yourself with deep conceptual questions and essay answers.'
    }
  ]

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fl-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Perfected Module Banner */}
      {isPerfected && (
        <div className="glass-card p-6 rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-2 border-yellow-500/50">
          <div className="flex items-center gap-4">
            <Trophy className="w-12 h-12 text-yellow-500" />
            <div>
              <h3 className="font-bold text-xl text-yellow-500">MODULE PERFECTED! 🎉</h3>
              <p className="text-sm text-muted-foreground">
                You've scored 90%+ on all difficulty levels! You've mastered this module!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AI Recommendation Banner */}
      <div className="glass-card p-6 rounded-xl bg-gradient-to-r from-fl-primary/10 to-purple-500/10 border-2 border-fl-primary/30">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-fl-primary/20 rounded-lg">
            <Sparkles className="w-6 h-6 text-fl-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-2">AI-Powered Recommendation</h3>
            <p className="text-sm text-muted-foreground mb-3">
              {isPerfected ? (
                <>You've perfected this module! Feel free to retake any quiz or move to the next module.</>
              ) : (
                <>
                  Based on your learning progress and past quiz performance, we recommend starting with{' '}
                  <span className={`font-bold ${
                    recommended === 'easy' ? 'text-green-500' :
                    recommended === 'medium' ? 'text-yellow-500' : 'text-red-500'
                  }`}>
                    {recommended.toUpperCase()} MODE
                  </span>.
                </>
              )}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              {isPerfected ? 'All difficulties mastered!' : 'This difficulty level matches your current skill level and learning pace.'}
            </div>
          </div>
        </div>
      </div>

      {/* Quiz Difficulty Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {quizConfigs.map((config) => {
          const isRecommended = config.difficulty === recommended
          const isLocked = !unlockedDifficulties.has(config.difficulty)
          const isCompleted = completedDifficulties.has(config.difficulty)
          
          return (
            <div
              key={config.difficulty}
              className={`glass-card rounded-2xl p-6 transition-all relative ${
                isLocked 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:shadow-xl cursor-pointer'
              } ${
                isRecommended && !isLocked ? 'ring-2 ring-fl-primary' : ''
              } ${
                isCompleted ? 'ring-2 ring-green-500' : ''
              }`}
              onClick={() => !isLocked && onSelectDifficulty(config.difficulty)}
            >
              {/* Lock Overlay */}
              {isLocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-2xl">
                  <div className="text-center">
                    <Lock className="w-12 h-12 text-white/80 mx-auto mb-2" />
                    <p className="text-white/90 font-semibold text-sm">
                      Score 90%+ on {config.difficulty === 'medium' ? 'Easy' : 'Medium'} to unlock
                    </p>
                  </div>
                </div>
              )}
              {/* Header */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`text-2xl font-bold ${
                    config.difficulty === 'easy' ? 'text-green-500' :
                    config.difficulty === 'medium' ? 'text-yellow-500' : 'text-red-500'
                  }`}>
                    {config.difficulty.toUpperCase()}
                  </h3>
                  {isCompleted && (
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-500 text-white flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      COMPLETED
                    </span>
                  )}
                  {isRecommended && !isCompleted && (
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-fl-primary text-white flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      RECOMMENDED
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{config.description}</p>
              </div>

              {/* Stats */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Questions
                  </span>
                  <span className="font-bold">{config.questionCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Est. Time
                  </span>
                  <span className="font-bold">{config.estimatedTime} min</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Total Points
                  </span>
                  <span className="font-bold">{config.totalPoints} pts</span>
                </div>
              </div>

              {/* Question Type Breakdown */}
              <div className="space-y-2 mb-6 p-3 bg-muted rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Question Types:</p>
                {config.singleChoice > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                    <span>{config.singleChoice} Single Choice</span>
                  </div>
                )}
                {config.multipleChoice > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckSquare className="w-4 h-4 text-purple-500" />
                    <span>{config.multipleChoice} Multiple Choice</span>
                  </div>
                )}
                {config.descriptive > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-orange-500" />
                    <span>{config.descriptive} Descriptive</span>
                  </div>
                )}
              </div>

              {/* Generate Button */}
              <button
                onClick={() => !isLocked && onSelectDifficulty(config.difficulty)}
                disabled={isLocked}
                className={`w-full py-3 rounded-xl font-medium transition-all ${
                  isLocked
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : config.difficulty === 'easy'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-glow'
                    : config.difficulty === 'medium'
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:shadow-glow'
                    : 'bg-gradient-to-r from-red-500 to-pink-500 text-white hover:shadow-glow'
                }`}
              >
                {isLocked ? (
                  <>
                    <Lock className="w-4 h-4 inline mr-2" />
                    Locked
                  </>
                ) : isCompleted ? (
                  <>
                    Retake {config.difficulty.charAt(0).toUpperCase() + config.difficulty.slice(1)} Quiz
                  </>
                ) : (
                  <>
                    Generate {config.difficulty.charAt(0).toUpperCase() + config.difficulty.slice(1)} Quiz
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Info Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm mb-1">Single Choice</p>
              <p className="text-xs text-muted-foreground">
                Traditional MCQ with one correct answer. Quick to answer.
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-start gap-3">
            <CheckSquare className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm mb-1">Multiple Choice</p>
              <p className="text-xs text-muted-foreground">
                Select 2+ correct answers. Tests deeper understanding.
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm mb-1">Descriptive</p>
              <p className="text-xs text-muted-foreground">
                Write detailed answers. AI analyzes your understanding.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Adaptive Learning Info */}
      <div className="glass-card p-6 rounded-xl bg-muted/30">
        <h4 className="font-bold mb-3 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-fl-primary" />
          How Difficulty Progression Works:
        </h4>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="text-green-500 font-bold">•</span>
            <p><strong>Score ≥ 90%:</strong> Unlock the next difficulty level and earn completion badge!</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-yellow-500 font-bold">•</span>
            <p><strong>Score 70-89%:</strong> Pass the quiz, but need 90%+ to unlock next level</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-red-500 font-bold">•</span>
            <p><strong>Score &lt; 70%:</strong> Review and retake to improve</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-yellow-500 font-bold">🏆</span>
            <p><strong>Perfect All 3:</strong> Achieve 90%+ on all difficulties to "PERFECT" the module!</p>
          </div>
        </div>
      </div>
    </div>
  )
}
