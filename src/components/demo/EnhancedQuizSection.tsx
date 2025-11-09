import { useState, useEffect } from 'react'
import { Brain, CheckCircle, XCircle, Clock, Award, TrendingUp, Lightbulb } from 'lucide-react'
import { 
  generateEnhancedQuiz, 
  gradeDescriptiveAnswer,
  calculateQuizResults,
  recommendNextDifficulty,
  type EnhancedQuestion,
  type DifficultyLevel,
  type QuizAttempt
} from '@/services/enhancedQuizService'
import { recordQuizAttempt } from '@/services/progressTrackingService'
import { useAuth } from '@/core/auth'

interface EnhancedQuizSectionProps {
  moduleId: string
  courseId: string
  initialDifficulty?: DifficultyLevel
  questionCount?: number
  attemptCount?: number
  onQuizComplete?: (score: number) => void
}

export function EnhancedQuizSection({
  moduleId,
  courseId,
  initialDifficulty = 'easy',
  questionCount = 10,
  attemptCount = 0,
  onQuizComplete
}: EnhancedQuizSectionProps) {
  const { user } = useAuth()
  const [questions, setQuestions] = useState<EnhancedQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | number>>({})
  const [showResults, setShowResults] = useState(false)
  const [loading, setLoading] = useState(true)
  const [grading, setGrading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(initialDifficulty)
  const [startTime] = useState(Date.now())
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())

  useEffect(() => {
    loadQuiz()
  }, [moduleId, difficulty])

  async function loadQuiz() {
    setLoading(true)
    try {
      const quiz = await generateEnhancedQuiz(moduleId, difficulty, questionCount)
      setQuestions(quiz)
      setCurrentIndex(0)
      setAnswers({})
      setShowResults(false)
      setQuestionStartTime(Date.now())
    } catch (error) {
      console.error('Error loading quiz:', error)
    } finally {
      setLoading(false)
    }
  }

  const currentQuestion = questions[currentIndex]
  const progress = ((currentIndex + 1) / questions.length) * 100

  function handleAnswerChange(value: string | number) {
    setAnswers({ ...answers, [currentQuestion.id]: value })
  }

  async function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setQuestionStartTime(Date.now())
    } else {
      await finishQuiz()
    }
  }

  function handlePrevious() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setQuestionStartTime(Date.now())
    }
  }

  async function finishQuiz() {
    setGrading(true)
    try {
      const attempts: QuizAttempt[] = []
      
      // Grade each question
      for (const question of questions) {
        const studentAnswer = answers[question.id]
        const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000)
        
        let isCorrect = false
        let pointsEarned = 0

        if (question.type === 'mcq') {
          isCorrect = studentAnswer === question.correctAnswer
          pointsEarned = isCorrect ? question.points : 0
        } else if (question.type === 'fill_blank') {
          const correct = String(question.correctAnswer).toLowerCase().trim()
          const student = String(studentAnswer || '').toLowerCase().trim()
          isCorrect = correct === student
          pointsEarned = isCorrect ? question.points : 0
        } else if (question.type === 'descriptive') {
          // AI grading for descriptive
          if (studentAnswer) {
            const grading = await gradeDescriptiveAnswer(
              question.question,
              String(question.correctAnswer),
              String(studentAnswer),
              question.points
            )
            isCorrect = grading.isCorrect
            pointsEarned = Math.floor((grading.score / 100) * question.points)
          }
        }

        attempts.push({
          questionId: question.id,
          studentAnswer: studentAnswer || '',
          isCorrect,
          pointsEarned,
          timeSpent
        })
      }

      const results = calculateQuizResults(questions, attempts)
      setResults(results)
      setShowResults(true)

      // Track quiz attempt
      if (user) {
        const topics = questions.map(q => q.topic)
        const topicsCorrect = attempts
          .filter((a, i) => a.isCorrect)
          .map((_, i) => questions[i].topic)
        const topicsIncorrect = attempts
          .filter((a, i) => !a.isCorrect)
          .map((_, i) => questions[i].topic)

        await recordQuizAttempt({
          studentId: user.id,
          quizId: `quiz-${moduleId}-${Date.now()}`,
          moduleId: moduleId,
          courseId: courseId,
          score: results.percentage,
          answers: attempts,
          timeSpentSeconds: Math.floor((Date.now() - startTime) / 1000),
          difficulty: difficulty,
          correctCount: results.correctCount,
          totalQuestions: questions.length,
          topicsCorrect: [...new Set(topicsCorrect)],
          topicsIncorrect: [...new Set(topicsIncorrect)]
        })
      }

      // Recommend next difficulty
      const nextDifficulty = recommendNextDifficulty(
        difficulty,
        results.percentage,
        attemptCount
      )
      
      if (nextDifficulty !== difficulty) {
        console.log(`💡 Recommendation: Try ${nextDifficulty} difficulty next time!`)
      }

      onQuizComplete?.(results.percentage)
    } catch (error) {
      console.error('Error grading quiz:', error)
    } finally {
      setGrading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fl-primary"></div>
      </div>
    )
  }

  if (showResults && results) {
    const nextDifficulty = recommendNextDifficulty(difficulty, results.percentage, attemptCount)
    const shouldUpgrade = nextDifficulty !== difficulty

    return (
      <div className="glass-card p-8 rounded-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-fl-primary to-fl-secondary mb-4">
            <Award className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold mb-2">Quiz Complete!</h2>
          <p className="text-muted-foreground">
            Difficulty: <span className="capitalize font-semibold">{difficulty}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-fl-primary mb-1">
              {results.percentage}%
            </div>
            <div className="text-sm text-muted-foreground">Score</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-green-500 mb-1">
              {results.correctCount}/{results.totalQuestions}
            </div>
            <div className="text-sm text-muted-foreground">Correct</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-fl-secondary mb-1">
              {results.score}
            </div>
            <div className="text-sm text-muted-foreground">Points</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-purple-500 mb-1">
              {results.passingGrade ? 'PASS' : 'RETRY'}
            </div>
            <div className="text-sm text-muted-foreground">Status</div>
          </div>
        </div>

        {shouldUpgrade && (
          <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg mb-2">Great Performance! 🎉</h3>
                <p className="text-foreground/80 mb-3">
                  You scored {results.percentage}%! Ready for a challenge?
                </p>
                <button
                  onClick={() => {
                    setDifficulty(nextDifficulty)
                    loadQuiz()
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg transition-all font-medium"
                >
                  Try {nextDifficulty.toUpperCase()} Difficulty →
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 px-6 py-3 bg-muted hover:bg-muted/80 rounded-lg transition-colors font-medium"
          >
            Back to Course
          </button>
          <button
            onClick={loadQuiz}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-fl-primary to-fl-secondary text-white rounded-lg hover:shadow-lg transition-all font-medium"
          >
            Retake Quiz
          </button>
        </div>
      </div>
    )
  }

  if (grading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-fl-primary mb-4"></div>
        <p className="text-lg text-muted-foreground">Grading your answers...</p>
        <p className="text-sm text-muted-foreground mt-2">AI is reviewing descriptive answers</p>
      </div>
    )
  }

  if (!currentQuestion) return null

  const currentAnswer = answers[currentQuestion.id]

  return (
    <div className="glass-card p-8 rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-fl-primary/20 rounded-lg">
            <Brain className="w-6 h-6 text-fl-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Enhanced Quiz</h2>
            <p className="text-sm text-muted-foreground capitalize">
              {difficulty} Difficulty • Question {currentIndex + 1}/{questions.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Question {currentIndex + 1}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-fl-primary to-fl-secondary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="mb-8">
        <div className="flex items-start gap-3 mb-4">
          <span className="flex-shrink-0 w-8 h-8 bg-fl-primary/20 rounded-full flex items-center justify-center text-fl-primary font-bold">
            {currentIndex + 1}
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                currentQuestion.type === 'mcq' ? 'bg-blue-500/20 text-blue-500' :
                currentQuestion.type === 'descriptive' ? 'bg-purple-500/20 text-purple-500' :
                'bg-orange-500/20 text-orange-500'
              }`}>
                {currentQuestion.type === 'mcq' ? 'Multiple Choice' :
                 currentQuestion.type === 'descriptive' ? 'Descriptive' :
                 'Fill in the Blank'}
              </span>
              <span className="text-xs text-muted-foreground">
                {currentQuestion.points} points
              </span>
            </div>
            <p className="text-lg font-medium leading-relaxed">
              {currentQuestion.question}
            </p>
            {currentQuestion.hint && difficulty === 'easy' && (
              <div className="mt-3 flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <Lightbulb className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-500/90">
                  <strong>Hint:</strong> {currentQuestion.hint}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Answer Input */}
        <div className="ml-11">
          {currentQuestion.type === 'mcq' && currentQuestion.options && (
            <div className="space-y-3">
              {currentQuestion.options.map((option, idx) => (
                <label
                  key={idx}
                  className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    currentAnswer === idx
                      ? 'border-fl-primary bg-fl-primary/5'
                      : 'border-border hover:border-fl-primary/50'
                  }`}
                >
                  <input
                    type="radio"
                    name={currentQuestion.id}
                    checked={currentAnswer === idx}
                    onChange={() => handleAnswerChange(idx)}
                    className="mt-1"
                  />
                  <span className="flex-1">{option}</span>
                </label>
              ))}
            </div>
          )}

          {currentQuestion.type === 'fill_blank' && (
            <input
              type="text"
              value={currentAnswer || ''}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="Type your answer..."
              className="w-full px-4 py-3 bg-muted border border-border rounded-lg focus:outline-none focus:border-fl-primary transition-colors"
            />
          )}

          {currentQuestion.type === 'descriptive' && (
            <textarea
              value={currentAnswer || ''}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="Write your detailed answer here..."
              rows={6}
              className="w-full px-4 py-3 bg-muted border border-border rounded-lg focus:outline-none focus:border-fl-primary transition-colors resize-none"
            />
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="px-6 py-2.5 bg-muted hover:bg-muted/80 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Previous
        </button>
        <div className="text-sm text-muted-foreground">
          {Object.keys(answers).length}/{questions.length} answered
        </div>
        <button
          onClick={handleNext}
          disabled={!currentAnswer && currentAnswer !== 0}
          className="px-6 py-2.5 bg-gradient-to-r from-fl-primary to-fl-secondary text-white rounded-lg hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {currentIndex === questions.length - 1 ? 'Finish Quiz' : 'Next →'}
        </button>
      </div>
    </div>
  )
}
