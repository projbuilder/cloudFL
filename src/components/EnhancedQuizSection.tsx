import { useState, useEffect } from 'react'
import { useAuth } from '@/core/auth'
import { Brain, CheckCircle2, XCircle, Clock, AlertCircle, Sparkles, FileText, CheckSquare } from 'lucide-react'
import { generateEnhancedQuiz, analyzeDescriptiveAnswer } from '@/services/enhancedQuizGenerator'
import { supabase } from '@/lib/supabase'
import type { EnhancedQuiz, EnhancedQuestion, QuizAnswer } from '@/types/enhancedQuiz'

interface Props {
  moduleId: string
  courseId: string
  difficulty?: 'easy' | 'medium' | 'hard'
  onQuizComplete?: (score: number, percentage: number) => void
}

export function EnhancedQuizSection({ moduleId, courseId, difficulty: initialDifficulty, onQuizComplete }: Props) {
  const { user } = useAuth()
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(initialDifficulty || 'easy')
  const [quiz, setQuiz] = useState<EnhancedQuiz | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<QuizAnswer[]>([])
  const [answered, setAnswered] = useState(false)
  const [quizComplete, setQuizComplete] = useState(false)
  const [score, setScore] = useState(0)
  const [maxScore, setMaxScore] = useState(0)
  const [startTime] = useState(Date.now())
  
  // Current question answer state
  const [selectedIndices, setSelectedIndices] = useState<number[]>([])
  const [textAnswer, setTextAnswer] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [aiFeedback, setAiFeedback] = useState<string>('')

  useEffect(() => {
    loadOrGenerateQuiz()
  }, [difficulty])

  async function loadOrGenerateQuiz() {
    setLoading(true)
    setQuizComplete(false)
    setCurrentQ(0)
    setAnswers([])
    setScore(0)
    
    try {
      const result = await generateEnhancedQuiz(moduleId, difficulty, difficulty === 'easy' ? 5 : difficulty === 'medium' ? 7 : 10)
      
      if (result.success && result.quiz) {
        setQuiz(result.quiz)
        setMaxScore(result.quiz.total_points)
      } else {
        throw new Error(result.error || 'Failed to generate quiz')
      }
    } catch (error) {
      console.error('Quiz generation error:', error)
      alert('Failed to generate quiz. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAnswer() {
    if (!quiz || answered) return
    
    const question = quiz.questions[currentQ]
    let pointsEarned = 0
    let isCorrect = false
    let feedback = ''
    
    setAnswered(true)
    
    // Grade based on question type
    if (question.type === 'single-choice') {
      isCorrect = selectedIndices[0] === question.correctIndex
      pointsEarned = isCorrect ? question.points : 0
    } else if (question.type === 'multiple-choice') {
      // Check if all correct answers selected and no incorrect ones
      const correctSet = new Set(question.correctIndices)
      const selectedSet = new Set(selectedIndices)
      
      const correctSelected = selectedIndices.filter(i => correctSet.has(i)).length
      const incorrectSelected = selectedIndices.filter(i => !correctSet.has(i)).length
      
      if (incorrectSelected === 0 && correctSelected === correctSet.size) {
        // Perfect answer
        isCorrect = true
        pointsEarned = question.points
      } else if (correctSelected > 0 && incorrectSelected === 0) {
        // Partial credit
        pointsEarned = (correctSelected / correctSet.size) * question.points
        feedback = `Partial credit: ${correctSelected}/${correctSet.size} correct answers`
      } else {
        pointsEarned = 0
        feedback = 'Incorrect or incomplete answer'
      }
    } else if (question.type === 'descriptive') {
      // AI Analysis
      setAnalyzing(true)
      try {
        const analysis = await analyzeDescriptiveAnswer(
          question.question,
          question.expectedKeywords || [],
          textAnswer,
          difficulty
        )
        
        pointsEarned = (analysis.score / 100) * question.points
        feedback = analysis.feedback
        setAiFeedback(feedback)
        
      } catch (error) {
        console.error('AI analysis error:', error)
        // Fallback: simple keyword matching
        const keywords = question.expectedKeywords || []
        const found = keywords.filter(kw => textAnswer.toLowerCase().includes(kw.toLowerCase()))
        pointsEarned = (found.length / keywords.length) * question.points
        feedback = `Found ${found.length}/${keywords.length} expected concepts`
        setAiFeedback(feedback)
      } finally {
        setAnalyzing(false)
      }
    }
    
    // Save answer
    const answer: QuizAnswer = {
      question_id: question.id,
      question_type: question.type,
      selected_indices: selectedIndices.length ? selectedIndices : undefined,
      text_answer: textAnswer || undefined,
      is_correct: isCorrect,
      points_earned: pointsEarned,
      ai_feedback: feedback || undefined
    }
    
    setAnswers([...answers, answer])
    setScore(score + pointsEarned)
  }

  function handleNext() {
    if (!quiz) return
    
    if (currentQ + 1 < quiz.questions.length) {
      setCurrentQ(currentQ + 1)
      setAnswered(false)
      setSelectedIndices([])
      setTextAnswer('')
      setAiFeedback('')
    } else {
      // This is the last question, pass current state to finishQuiz
      finishQuiz(answers, score)
    }
  }

  async function finishQuiz(finalAnswers: QuizAnswer[], finalScore: number) {
    if (!user || !quiz) return
    
    setQuizComplete(true)
    const timeSpent = Math.floor((Date.now() - startTime) / 1000)
    const percentage = (finalScore / maxScore) * 100
    
    try {
      console.log('💾 Saving quiz attempt to database...', {
        quiz_id: quiz.id,
        student_id: user.id,
        difficulty,
        answers_count: finalAnswers.length,
        score: finalScore,
        percentage
      })

      // Save attempt to database (quiz_id is nullable if quiz wasn't saved)
      // If quiz wasn't saved, store questions in attempt for review
      const attemptData: any = {
        quiz_id: quiz.id && typeof quiz.id === 'string' && quiz.id.length === 36 ? quiz.id : null,
        student_id: user.id,
        course_id: courseId,
        module_id: moduleId,
        difficulty: difficulty,
        answers: finalAnswers,
        score: finalScore,
        max_score: maxScore,
        percentage: percentage,
        time_spent: timeSpent,
        completed_at: new Date().toISOString()
      }

      // If quiz wasn't saved (null ID), include quiz data for review
      if (!attemptData.quiz_id) {
        attemptData.quiz_data = {
          title: quiz.title,
          questions: quiz.questions,
          difficulty: difficulty
        }
      }

      const { data, error } = await supabase
        .from('enhanced_quiz_attempts')
        .insert(attemptData)
        .select()
      
      if (error) {
        console.error('❌ Error saving quiz attempt:', error)
        throw error
      }

      console.log('✅ Quiz attempt saved successfully!', data)
      
      if (onQuizComplete) {
        onQuizComplete(finalScore, percentage)
      }
    } catch (error) {
      console.error('❌ Quiz completion error:', error)
      alert('Error saving quiz results. Please check console and try again.')
    }
  }

  function handleSingleChoiceSelect(index: number) {
    if (answered) return
    setSelectedIndices([index])
  }

  function handleMultipleChoiceToggle(index: number) {
    if (answered) return
    
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter(i => i !== index))
    } else {
      setSelectedIndices([...selectedIndices, index])
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fl-primary mb-4"></div>
        <p className="text-muted-foreground">Generating {difficulty} quiz...</p>
      </div>
    )
  }

  if (!quiz) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No quiz available</p>
      </div>
    )
  }

  if (quizComplete) {
    const percentage = (score / maxScore) * 100
    const passed = percentage >= 60
    
    return (
      <div className="space-y-6">
        <div className="glass-card p-8 rounded-2xl text-center">
          <div className={`text-6xl font-bold mb-4 ${passed ? 'text-green-500' : 'text-yellow-500'}`}>
            {percentage.toFixed(1)}%
          </div>
          <h3 className="text-2xl font-bold mb-2">
            {passed ? '🎉 Great Job!' : '📚 Keep Learning!'}
          </h3>
          <p className="text-muted-foreground mb-6">
            Score: {score.toFixed(1)} / {maxScore} points
          </p>
          
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => loadOrGenerateQuiz()}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:shadow-glow transition-all font-medium"
            >
              Retake Quiz
            </button>
          </div>
        </div>
        
        {/* Quiz Summary */}
        <div className="glass-card p-6 rounded-xl">
          <h4 className="font-bold mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-fl-primary" />
            Quiz Summary
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-fl-primary">{quiz.questions.length}</div>
              <div className="text-sm text-muted-foreground">Questions</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-green-500">
                {answers.filter(a => a.is_correct).length}
              </div>
              <div className="text-sm text-muted-foreground">Correct</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-fl-primary">{score.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground">Points</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-fl-primary">
                {difficulty.toUpperCase()}
              </div>
              <div className="text-sm text-muted-foreground">Difficulty</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const question = quiz.questions[currentQ]
  const progress = ((currentQ + 1) / quiz.questions.length) * 100

  return (
    <div className="space-y-6">
      <div className="glass-card p-8 rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-sm text-muted-foreground mb-2">
              Question {currentQ + 1} of {quiz.questions.length}
            </div>
            <div className="flex gap-2 flex-wrap">
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
                {question.type === 'single-choice' && <CheckCircle2 className="w-3 h-3" />}
                {question.type === 'multiple-choice' && <CheckSquare className="w-3 h-3" />}
                {question.type === 'descriptive' && <FileText className="w-3 h-3" />}
                {question.type === 'single-choice' ? 'Single Choice' : 
                 question.type === 'multiple-choice' ? 'Multiple Choice' : 'Descriptive'}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-fl-primary/20 text-fl-primary">
                {question.points} {question.points === 1 ? 'point' : 'points'}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Score</div>
            <div className="text-3xl font-bold text-fl-primary">
              {score.toFixed(1)}/{maxScore}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <h3 className="text-xl font-bold mb-6">{question.question}</h3>

        {/* Answer Options - Single Choice */}
        {question.type === 'single-choice' && (
          <div className="space-y-3 mb-6">
            {question.options.map((option, i) => {
              const isCorrect = i === question.correctIndex
              const isSelected = selectedIndices[0] === i
              const showResult = answered

              return (
                <button
                  key={i}
                  onClick={() => handleSingleChoiceSelect(i)}
                  disabled={answered}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    showResult && isCorrect
                      ? 'border-green-500 bg-green-500/10'
                      : showResult && isSelected && !isCorrect
                      ? 'border-red-500 bg-red-500/10'
                      : showResult
                      ? 'border-border bg-muted/30 opacity-60'
                      : isSelected
                      ? 'border-fl-primary bg-fl-primary/10'
                      : 'border-border hover:border-fl-primary hover:bg-fl-primary/5'
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
        )}

        {/* Answer Options - Multiple Choice */}
        {question.type === 'multiple-choice' && (
          <div className="space-y-3 mb-6">
            <p className="text-sm text-muted-foreground mb-3">
              Select all correct answers ({question.minSelections || 1} - {question.maxSelections || question.options.length} required)
            </p>
            {question.options.map((option, i) => {
              const isCorrect = question.correctIndices.includes(i)
              const isSelected = selectedIndices.includes(i)
              const showResult = answered

              return (
                <button
                  key={i}
                  onClick={() => handleMultipleChoiceToggle(i)}
                  disabled={answered}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    showResult && isCorrect && isSelected
                      ? 'border-green-500 bg-green-500/10'
                      : showResult && !isCorrect && isSelected
                      ? 'border-red-500 bg-red-500/10'
                      : showResult && isCorrect && !isSelected
                      ? 'border-yellow-500 bg-yellow-500/10'
                      : showResult
                      ? 'border-border bg-muted/30 opacity-60'
                      : isSelected
                      ? 'border-fl-primary bg-fl-primary/10'
                      : 'border-border hover:border-fl-primary hover:bg-fl-primary/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected ? 'bg-fl-primary border-fl-primary' : 'border-border'
                      }`}>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </div>
                      <span>{option}</span>
                    </div>
                    {showResult && isCorrect && isSelected && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                    {showResult && !isCorrect && isSelected && <XCircle className="w-5 h-5 text-red-500" />}
                    {showResult && isCorrect && !isSelected && <AlertCircle className="w-5 h-5 text-yellow-500" />}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Answer Options - Descriptive */}
        {question.type === 'descriptive' && (
          <div className="mb-6">
            <textarea
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              disabled={answered}
              placeholder="Type your detailed answer here..."
              className="w-full min-h-[200px] p-4 rounded-xl border-2 border-border bg-background focus:border-fl-primary focus:outline-none resize-y"
              maxLength={question.maxWords ? question.maxWords * 6 : 2000}
            />
            <div className="flex justify-between items-center mt-2 text-sm text-muted-foreground">
              <span>
                {textAnswer.split(/\s+/).filter(w => w).length} words
                {question.minWords && ` (min: ${question.minWords})`}
              </span>
              {question.maxWords && (
                <span>Max: {question.maxWords} words</span>
              )}
            </div>
          </div>
        )}

        {/* AI Analysis Loading */}
        {analyzing && (
          <div className="mb-6 p-4 bg-fl-primary/10 rounded-xl border border-fl-primary/20">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-fl-primary"></div>
              <span className="text-sm font-medium text-fl-primary">
                AI is analyzing your answer...
              </span>
            </div>
          </div>
        )}

        {/* Explanation */}
        {answered && !analyzing && (
          <div className="mb-6 p-4 bg-muted/50 rounded-xl border border-border">
            <p className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Explanation:
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              {question.explanation}
            </p>
            
            {aiFeedback && (
              <div className="mt-3 p-3 bg-fl-primary/5 rounded-lg border border-fl-primary/20">
                <p className="text-sm font-semibold mb-1 text-fl-primary flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  AI Feedback:
                </p>
                <p className="text-sm text-foreground">{aiFeedback}</p>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {!answered ? (
          <button
            onClick={handleAnswer}
            disabled={
              (question.type === 'single-choice' && selectedIndices.length === 0) ||
              (question.type === 'multiple-choice' && selectedIndices.length === 0) ||
              (question.type === 'descriptive' && textAnswer.trim().length < (question.minWords || 10) * 5)
            }
            className="w-full py-4 bg-gradient-to-r from-fl-primary to-purple-500 text-white rounded-xl font-medium hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Answer
          </button>
        ) : (
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
