import { useState, useEffect } from 'react'
import { Brain, CheckCircle2, XCircle, TrendingUp, Loader2, Sparkles, Award } from 'lucide-react'
import { generateQuizForModule, recordQuizAttempt, getQuizzesByModule } from '@/services/quizService'
import { recordQuizAttempt as trackQuizAttempt } from '@/services/progressTrackingService'
import { useAuth } from '@/core/auth'

interface AdaptiveQuizSectionProps {
  moduleId: string
  courseId: string
}

interface Question {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export function AdaptiveQuizSection({ moduleId, courseId, onQuizComplete, questionCount = 5 }: AdaptiveQuizSectionProps & { onQuizComplete?: (score: number) => void; questionCount?: number }) {
  const { user } = useAuth()
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy') // Start with Easy for new students
  const [quiz, setQuiz] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [answered, setAnswered] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [quizComplete, setQuizComplete] = useState(false)
  const [score, setScore] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [startTime, setStartTime] = useState(Date.now())

  useEffect(() => {
    loadOrGenerateQuiz()
  }, [moduleId, difficulty, questionCount])

  const loadOrGenerateQuiz = async () => {
    setLoading(true)
    setQuizComplete(false)
    setCurrentQ(0)
    setAnswers([])
    setScore(0)
    setAnswered(false)
    setSelected(null)

    try {
      // Check for existing quiz
      const existingQuizzes = await getQuizzesByModule(moduleId)
      const existingQuiz = existingQuizzes.find((q) => q.difficulty === difficulty)

      if (existingQuiz) {
        setQuiz(existingQuiz)
      } else {
        // Generate new quiz with Gemini (custom question count!)
        const result = await generateQuizForModule(moduleId, difficulty, questionCount)
        if (result.success) {
          setQuiz(result.quiz)
        } else {
          throw new Error('Quiz generation failed')
        }
      }
    } catch (error: any) {
      console.error('Quiz error:', error)
      alert(`Quiz generation failed: ${error.message || 'Unknown error'}. Please ensure modules exist first.`)
    } finally {
      setLoading(false)
      setStartTime(Date.now())
    }
  }

  const handleAnswer = (index: number) => {
    if (answered) return

    setSelected(index)
    setAnswered(true)

    const newAnswers = [...answers, index]
    setAnswers(newAnswers)

    if (index === quiz.questions[currentQ].correctIndex) {
      setScore(score + 1)
    }
  }

  const handleNext = () => {
    if (currentQ + 1 < quiz.questions.length) {
      setCurrentQ(currentQ + 1)
      setAnswered(false)
      setSelected(null)
    } else {
      finishQuiz()
    }
  }

  const finishQuiz = async () => {
    setQuizComplete(true)

    const timeSpent = Math.floor((Date.now() - startTime) / 1000)
    const result = await recordQuizAttempt(quiz.id, answers, timeSpent)

    setFeedback(result.feedback)

    // Track detailed progress analytics
    if (user && courseId) {
      try {
        // Calculate correct/incorrect topics
        const correctTopics: string[] = []
        const incorrectTopics: string[] = []
        
        answers.forEach((answer, index) => {
          const question = quiz.questions[index]
          const isCorrect = answer === question.correctIndex
          
          // Extract topic from question (simplified - could be more sophisticated)
          const topicMatch = question.question.match(/\b(federated|learning|privacy|security|aggregation|model|data)\b/gi)
          const topic = topicMatch ? topicMatch[0] : 'general'
          
          if (isCorrect) {
            correctTopics.push(topic)
          } else {
            incorrectTopics.push(topic)
          }
        })

        const accuracy = (score / quiz.questions.length) * 100
        
        await trackQuizAttempt({
          studentId: user.id,
          quizId: quiz.id,
          moduleId: moduleId,
          courseId: courseId,
          score: accuracy,
          answers: answers.map((answer, index) => ({
            questionId: index,
            selectedAnswer: answer,
            isCorrect: answer === quiz.questions[index].correctIndex,
            timeSpent: Math.floor(timeSpent / quiz.questions.length) // Estimate per question
          })),
          timeSpentSeconds: timeSpent,
          difficulty: difficulty,
          correctCount: score,
          totalQuestions: quiz.questions.length,
          topicsCorrect: Array.from(new Set(correctTopics)),
          topicsIncorrect: Array.from(new Set(incorrectTopics))
        })

        console.log('✅ Quiz attempt tracked successfully')
      } catch (error) {
        console.error('Failed to track quiz attempt:', error)
        // Don't block user experience if tracking fails
      }
    }

    // Call parent callback with score percentage
    const accuracy = (score / quiz.questions.length) * 100
    if (onQuizComplete) {
      onQuizComplete(Math.round(accuracy))
    }

    // Show difficulty adjustment
    if (result.newDifficulty !== difficulty) {
      setTimeout(() => {
        setDifficulty(result.newDifficulty as any)
      }, 3000)
    }
  }

  if (loading || !quiz) {
    return (
      <div className="glass-card p-12 rounded-2xl text-center">
        <Loader2 className="w-16 h-16 text-fl-primary mx-auto mb-4 animate-spin" />
        <h3 className="text-xl font-bold mb-2">Generating Adaptive Quiz</h3>
        <p className="text-muted-foreground">Gemini AI is creating questions based on module content...</p>
      </div>
    )
  }

  if (quizComplete) {
    const accuracy = (score / quiz.questions.length) * 100

    return (
      <div className="space-y-6">
        <div className="glass-card p-10 rounded-2xl text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Award className="w-12 h-12 text-white" />
          </div>

          <h3 className="text-3xl font-bold mb-3">Quiz Complete!</h3>

          <div className="text-7xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent mb-4">
            {score}/{quiz.questions.length}
          </div>

          <div className="text-2xl text-muted-foreground mb-6">Accuracy: {accuracy.toFixed(0)}%</div>

          <div className="bg-muted/50 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-center gap-3 mb-3">
              <TrendingUp className="w-6 h-6 text-green-500" />
              <h4 className="font-bold text-lg">Adaptive Feedback</h4>
            </div>
            <p className="text-muted-foreground">{feedback}</p>
          </div>

          <button
            onClick={() => loadOrGenerateQuiz()}
            className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:shadow-glow transition-all font-medium"
          >
            Try Again
          </button>
        </div>

        {/* How It Works */}
        <div className="glass-card p-6 rounded-xl bg-green-500/5 border border-green-500/20">
          <h4 className="font-bold mb-3 flex items-center gap-2">
            <Brain className="w-5 h-5 text-green-500" />
            Adaptive Algorithm:
          </h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="text-green-500 font-bold">•</span>
              <p><strong>Score ≥ 90%:</strong> Increase difficulty (you are ready for harder content)</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500 font-bold">•</span>
              <p><strong>Score 70-90%:</strong> Maintain difficulty (perfect learning zone)</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500 font-bold">•</span>
              <p><strong>Score &lt; 50%:</strong> Decrease difficulty (build stronger foundations)</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const question = quiz.questions[currentQ] as Question

  return (
    <div className="space-y-6">
      <div className="glass-card p-8 rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="text-sm text-muted-foreground mb-2">
              Question {currentQ + 1} of {quiz.questions.length}
            </div>
            <div className="flex gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  difficulty === 'easy'
                    ? 'bg-green-500/20 text-green-500'
                    : difficulty === 'medium'
                    ? 'bg-yellow-500/20 text-yellow-500'
                    : 'bg-red-500/20 text-red-500'
                }`}
              >
                {difficulty.toUpperCase()} MODE
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                AI Generated
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Score</div>
            <div className="text-4xl font-bold text-fl-primary">{score}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${((currentQ + 1) / quiz.questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <h3 className="text-xl font-bold mb-6">{question.question}</h3>

        {/* Options */}
        <div className="space-y-3 mb-6">
          {question.options.map((option, i) => {
            const isCorrect = i === question.correctIndex
            const isSelected = i === selected
            const showResult = answered

            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={answered}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  showResult && isCorrect
                    ? 'border-green-500 bg-green-500/10'
                    : showResult && isSelected && !isCorrect
                    ? 'border-red-500 bg-red-500/10'
                    : showResult
                    ? 'border-border bg-muted/30 opacity-60'
                    : 'border-border hover:border-green-500 hover:bg-green-500/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex-1">{option}</span>
                  {showResult && isCorrect && <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 ml-3" />}
                  {showResult && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 ml-3" />}
                </div>
              </button>
            )
          })}
        </div>

        {/* Explanation */}
        {answered && (
          <div className="mb-6 p-4 bg-muted/50 rounded-xl border border-border">
            <p className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Explanation:
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">{question.explanation}</p>
          </div>
        )}

        {/* Next Button */}
        {answered && (
          <button
            onClick={handleNext}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium hover:shadow-glow transition-all"
          >
            {currentQ + 1 < quiz.questions.length ? 'Next Question →' : 'Finish Quiz'}
          </button>
        )}
      </div>
    </div>
  )
}
