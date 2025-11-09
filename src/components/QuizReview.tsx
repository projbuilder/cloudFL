import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { CheckCircle2, XCircle, AlertCircle, Brain, Sparkles, ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react'
import type { QuizAttempt, EnhancedQuestion, QuizAnswer } from '@/types/enhancedQuiz'

interface Props {
  attemptId: string
  onBack?: () => void
}

export function QuizReview({ attemptId, onBack }: Props) {
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [quiz, setQuiz] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAttemptDetails()
  }, [attemptId])

  async function loadAttemptDetails() {
    setLoading(true)
    try {
      console.log('📖 Loading quiz review for attempt:', attemptId)
      
      // Load attempt with quiz data
      const { data: attemptData, error: attemptError } = await supabase
        .from('enhanced_quiz_attempts')
        .select(`
          *,
          enhanced_quizzes(*),
          course_modules(title, module_number)
        `)
        .eq('id', attemptId)
        .maybeSingle()

      if (attemptError) {
        console.error('❌ Error loading attempt:', attemptError)
        throw attemptError
      }

      if (!attemptData) {
        console.error('❌ No attempt found with ID:', attemptId)
        return
      }

      console.log('✅ Loaded attempt:', attemptData)
      
      setAttempt(attemptData)
      
      // Check multiple sources for quiz data
      const quizFromRelation = (attemptData as any).enhanced_quizzes
      const quizFromAttempt = (attemptData as any).quiz_data
      const moduleData = (attemptData as any).course_modules
      
      if (quizFromRelation && quizFromRelation.questions) {
        // Quiz was saved and linked
        console.log('✅ Using quiz from enhanced_quizzes relation')
        setQuiz(quizFromRelation)
      } else if (quizFromAttempt && quizFromAttempt.questions) {
        // Quiz wasn't saved but data stored in attempt
        console.log('✅ Using quiz_data from attempt')
        setQuiz({
          ...quizFromAttempt,
          title: quizFromAttempt.title || `Module ${moduleData?.module_number || ''}: ${moduleData?.title || 'Quiz'}`
        })
      } else {
        // No quiz data available - cannot show review
        console.error('❌ Quiz data incomplete - cannot show review')
        setQuiz(null)
      }
    } catch (error) {
      console.error('Error loading quiz review:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fl-primary"></div>
      </div>
    )
  }

  if (!attempt || !quiz) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Quiz attempt not found</p>
      </div>
    )
  }

  const passed = attempt.percentage >= 60
  const questions = quiz.questions as EnhancedQuestion[]
  const answers = attempt.answers as QuizAnswer[]

  return (
    <div className="space-y-6">
      {/* Back Button */}
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to History
        </button>
      )}

      {/* Summary Header */}
      <div className="glass-card p-8 rounded-2xl">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">{quiz.title}</h2>
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
                {attempt.difficulty.toUpperCase()} MODE
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  passed
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-yellow-500/20 text-yellow-500'
                }`}
              >
                {passed ? '✓ PASSED' : '○ NEEDS IMPROVEMENT'}
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className={`text-5xl font-bold mb-2 ${
              passed ? 'text-green-500' : 'text-yellow-500'
            }`}>
              {attempt.percentage.toFixed(0)}%
            </div>
            <div className="text-muted-foreground">
              {attempt.score.toFixed(1)} / {attempt.max_score} points
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-fl-primary">{questions.length}</div>
            <div className="text-sm text-muted-foreground">Questions</div>
          </div>
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-green-500">
              {answers.filter(a => a.is_correct).length}
            </div>
            <div className="text-sm text-muted-foreground">Correct</div>
          </div>
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-red-500">
              {answers.filter(a => !a.is_correct && a.points_earned === 0).length}
            </div>
            <div className="text-sm text-muted-foreground">Incorrect</div>
          </div>
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-yellow-500">
              {answers.filter(a => a.points_earned > 0 && !a.is_correct).length}
            </div>
            <div className="text-sm text-muted-foreground">Partial</div>
          </div>
        </div>

        {/* Personalized Feedback */}
        {attempt.personalized_feedback && (
          <div className="mt-6 p-4 bg-fl-primary/5 rounded-lg border border-fl-primary/20">
            <p className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-fl-primary" />
              AI Analysis:
            </p>
            <p className="text-sm text-foreground">{attempt.personalized_feedback}</p>
          </div>
        )}

        {/* Strengths & Weaknesses */}
        {(attempt.strengths?.length || attempt.weaknesses?.length) && (
          <div className="mt-6 grid md:grid-cols-2 gap-4">
            {attempt.strengths && attempt.strengths.length > 0 && (
              <div className="p-4 bg-green-500/5 rounded-lg border border-green-500/20">
                <p className="text-sm font-semibold mb-2 flex items-center gap-2 text-green-500">
                  <TrendingUp className="w-4 h-4" />
                  Strengths:
                </p>
                <ul className="space-y-1">
                  {attempt.strengths.map((strength, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {attempt.weaknesses && attempt.weaknesses.length > 0 && (
              <div className="p-4 bg-yellow-500/5 rounded-lg border border-yellow-500/20">
                <p className="text-sm font-semibold mb-2 flex items-center gap-2 text-yellow-500">
                  <TrendingDown className="w-4 h-4" />
                  Areas to Improve:
                </p>
                <ul className="space-y-1">
                  {attempt.weaknesses.map((weakness, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                      {weakness}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detailed Question Review */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold">Detailed Review</h3>

        {questions.map((question, qIndex) => {
          const answer = answers[qIndex]
          const isCorrect = answer?.is_correct || false
          const hasPartialCredit = answer && answer.points_earned > 0 && !answer.is_correct

          return (
            <div
              key={question.id}
              className={`glass-card p-6 rounded-xl border-2 ${
                isCorrect
                  ? 'border-green-500/30'
                  : hasPartialCredit
                  ? 'border-yellow-500/30'
                  : 'border-red-500/30'
              }`}
            >
              {/* Question Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-muted-foreground">
                      Question {qIndex + 1}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted">
                      {question.type === 'single-choice' ? 'Single Choice' :
                       question.type === 'multiple-choice' ? 'Multiple Choice' : 'Descriptive'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-fl-primary/20 text-fl-primary">
                      {question.points} pts
                    </span>
                  </div>
                  <h4 className="font-bold text-lg">{question.question}</h4>
                </div>

                <div className="text-right">
                  {isCorrect ? (
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  ) : hasPartialCredit ? (
                    <AlertCircle className="w-8 h-8 text-yellow-500" />
                  ) : (
                    <XCircle className="w-8 h-8 text-red-500" />
                  )}
                  <div className="text-sm text-muted-foreground mt-1">
                    {answer?.points_earned.toFixed(1)}/{question.points}
                  </div>
                </div>
              </div>

              {/* Single Choice Review */}
              {question.type === 'single-choice' && (
                <div className="space-y-2 mb-4">
                  {question.options.map((option, i) => {
                    const isYourAnswer = answer?.selected_indices?.[0] === i
                    const isCorrectAnswer = i === question.correctIndex

                    return (
                      <div
                        key={i}
                        className={`p-3 rounded-lg border-2 ${
                          isCorrectAnswer
                            ? 'border-green-500 bg-green-500/10'
                            : isYourAnswer
                            ? 'border-red-500 bg-red-500/10'
                            : 'border-border bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{option}</span>
                          <div className="flex items-center gap-2">
                            {isYourAnswer && !isCorrectAnswer && (
                              <span className="text-xs text-red-500 font-medium">Your answer</span>
                            )}
                            {isCorrectAnswer && (
                              <>
                                {isYourAnswer && (
                                  <span className="text-xs text-green-500 font-medium">Correct!</span>
                                )}
                                {!isYourAnswer && (
                                  <span className="text-xs text-green-500 font-medium">Correct answer</span>
                                )}
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                              </>
                            )}
                            {isYourAnswer && !isCorrectAnswer && (
                              <XCircle className="w-5 h-5 text-red-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Multiple Choice Review */}
              {question.type === 'multiple-choice' && (
                <div className="space-y-2 mb-4">
                  {question.options.map((option, i) => {
                    const isYourAnswer = answer?.selected_indices?.includes(i)
                    const isCorrectAnswer = question.correctIndices.includes(i)

                    return (
                      <div
                        key={i}
                        className={`p-3 rounded-lg border-2 ${
                          isCorrectAnswer && isYourAnswer
                            ? 'border-green-500 bg-green-500/10'
                            : isCorrectAnswer && !isYourAnswer
                            ? 'border-yellow-500 bg-yellow-500/10'
                            : isYourAnswer && !isCorrectAnswer
                            ? 'border-red-500 bg-red-500/10'
                            : 'border-border bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{option}</span>
                          <div className="flex items-center gap-2">
                            {isYourAnswer && isCorrectAnswer && (
                              <>
                                <span className="text-xs text-green-500 font-medium">✓ Selected correctly</span>
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                              </>
                            )}
                            {isYourAnswer && !isCorrectAnswer && (
                              <>
                                <span className="text-xs text-red-500 font-medium">✗ Shouldn't select</span>
                                <XCircle className="w-5 h-5 text-red-500" />
                              </>
                            )}
                            {!isYourAnswer && isCorrectAnswer && (
                              <>
                                <span className="text-xs text-yellow-500 font-medium">⚠ Missed this</span>
                                <AlertCircle className="w-5 h-5 text-yellow-500" />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Descriptive Review */}
              {question.type === 'descriptive' && (
                <div className="space-y-3 mb-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-semibold mb-2">Your Answer:</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {answer?.text_answer || 'No answer provided'}
                    </p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {answer?.text_answer?.split(/\s+/).filter(w => w).length || 0} words
                    </div>
                  </div>

                  {answer?.ai_feedback && (
                    <div className="p-4 bg-fl-primary/5 rounded-lg border border-fl-primary/20">
                      <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-fl-primary" />
                        AI Feedback:
                      </p>
                      <p className="text-sm text-foreground">{answer.ai_feedback}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Explanation */}
              <div className="p-4 bg-muted/50 rounded-lg border border-border">
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  Explanation:
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {question.explanation}
                </p>
              </div>

              {/* Why Wrong Answer is Wrong */}
              {!isCorrect && question.type === 'single-choice' && answer?.selected_indices?.[0] !== undefined && (
                <div className="mt-3 p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                  <p className="text-sm font-semibold mb-1 text-red-500">
                    Why your answer was incorrect:
                  </p>
                  <p className="text-sm text-foreground">
                    You selected "{question.options[answer.selected_indices[0]]}" but the correct answer is "{question.options[question.correctIndex]}". 
                    {question.explanation}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Recommended Next Steps */}
      {attempt.recommended_next_difficulty && (
        <div className="glass-card p-6 rounded-xl bg-fl-primary/5 border border-fl-primary/20">
          <h4 className="font-bold mb-2 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-fl-primary" />
            Recommended Next Step:
          </h4>
          <p className="text-sm text-foreground">
            Based on your performance, we recommend trying a{' '}
            <span className="font-bold text-fl-primary">
              {attempt.recommended_next_difficulty.toUpperCase()}
            </span>{' '}
            difficulty quiz next.
          </p>
        </div>
      )}
    </div>
  )
}
