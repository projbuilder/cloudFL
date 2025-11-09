import { supabase } from '@/lib/supabase'

// ========================================
// Enhanced Quiz Types
// ========================================

export type QuestionType = 'mcq' | 'descriptive' | 'fill_blank'
export type DifficultyLevel = 'easy' | 'medium' | 'hard'

export interface EnhancedQuestion {
  id: string
  type: QuestionType
  difficulty: DifficultyLevel
  question: string
  hint?: string  // Only for easy questions
  options?: string[]  // For MCQ
  correctAnswer: string | number  // Index for MCQ, text for others
  explanation: string
  points: number
  topic: string
}

export interface QuizAttempt {
  questionId: string
  studentAnswer: string | number
  isCorrect: boolean
  pointsEarned: number
  timeSpent: number
}

export interface DescriptiveAnswer {
  questionId: string
  question: string
  studentAnswer: string
  correctAnswer: string
  isCorrect: boolean
  feedback: string
  score: number  // 0-100
}

// ========================================
// Generate Enhanced Quiz
// ========================================

export async function generateEnhancedQuiz(
  moduleId: string,
  difficulty: DifficultyLevel,
  questionCount: number = 10
): Promise<EnhancedQuestion[]> {
  // Get module content for quiz generation
  const { data: module } = await supabase
    .from('course_modules')
    .select('content, title')
    .eq('id', moduleId)
    .single()

  if (!module) throw new Error('Module not found')

  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not found')

  // Define question distribution based on difficulty
  const questionMix = getQuestionMix(difficulty, questionCount)

  const prompt = `You are an expert quiz designer creating a ${difficulty.toUpperCase()} difficulty quiz.

MODULE CONTENT:
${module.content}

QUIZ REQUIREMENTS:
- Total Questions: ${questionCount}
- Difficulty: ${difficulty.toUpperCase()}
- Question Mix: ${JSON.stringify(questionMix)}

🎯 DIFFICULTY GUIDELINES:

**EASY (First-time students):**
- MCQ only (all questions are multiple choice)
- Each question includes a helpful hint
- Questions test basic understanding
- Clear, straightforward options
- Example: "What is X? (Hint: Think about how Y works)"

**MEDIUM (Intermediate students):**
- 60% MCQ (no hints)
- 20% Fill in the Blank
- 20% Descriptive (short answer)
- Tests application and analysis
- More complex scenarios

**HARD (Advanced students):**
- 30% MCQ (complex scenarios)
- 20% Fill in the Blank
- 50% Descriptive (detailed explanation required)
- Tests deep understanding and critical thinking
- Real-world problem solving

📝 QUESTION TYPES:

1. **MCQ (Multiple Choice):**
{
  "type": "mcq",
  "question": "What is...?",
  "hint": "Only for easy difficulty",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": 1,
  "explanation": "Why this is correct",
  "points": 5
}

2. **Descriptive (AI-graded):**
{
  "type": "descriptive",
  "question": "Explain how...?",
  "correctAnswer": "Expected answer with key points",
  "explanation": "What a good answer should include",
  "points": 10
}

3. **Fill in the Blank:**
{
  "type": "fill_blank",
  "question": "The process of ____ involves multiple steps.",
  "correctAnswer": "expected word or phrase",
  "explanation": "Why this is correct",
  "points": 7
}

🎯 CRITICAL REQUIREMENTS:
- Generate EXACTLY ${questionCount} questions
- Follow the difficulty guidelines strictly
- Include topics from different parts of the module
- Points: Easy MCQ=5, Medium=7, Hard Descriptive=10
- All questions must have explanations
- Easy questions MUST have hints

Return ONLY valid JSON array (no code blocks):
[
  {
    "id": "q1",
    "type": "mcq",
    "difficulty": "${difficulty}",
    "question": "...",
    "hint": "...",
    "options": ["...", "...", "...", "..."],
    "correctAnswer": 0,
    "explanation": "...",
    "points": 5,
    "topic": "Main concept from module"
  }
]`

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: Math.max(3000, questionCount * 400)
    }
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }
  )

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const data = await response.json()
  const text = data.candidates[0]?.content?.parts[0]?.text || ''

  // Parse JSON response
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('Invalid quiz response format')

  const questions: EnhancedQuestion[] = JSON.parse(jsonMatch[0])
  
  // Validate and return
  if (questions.length !== questionCount) {
    console.warn(`Expected ${questionCount} questions, got ${questions.length}`)
  }

  return questions.slice(0, questionCount)
}

// ========================================
// Question Mix Strategy
// ========================================

function getQuestionMix(difficulty: DifficultyLevel, total: number) {
  switch (difficulty) {
    case 'easy':
      return {
        mcq: total,
        descriptive: 0,
        fill_blank: 0
      }
    case 'medium':
      return {
        mcq: Math.floor(total * 0.6),
        fill_blank: Math.floor(total * 0.2),
        descriptive: Math.ceil(total * 0.2)
      }
    case 'hard':
      return {
        mcq: Math.floor(total * 0.3),
        fill_blank: Math.floor(total * 0.2),
        descriptive: Math.ceil(total * 0.5)
      }
  }
}

// ========================================
// Grade Descriptive Answer with AI
// ========================================

export async function gradeDescriptiveAnswer(
  question: string,
  correctAnswer: string,
  studentAnswer: string,
  maxPoints: number = 10
): Promise<DescriptiveAnswer> {
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not found')

  const prompt = `You are an expert educator grading a student's descriptive answer.

QUESTION:
${question}

EXPECTED ANSWER (Key Points):
${correctAnswer}

STUDENT'S ANSWER:
${studentAnswer}

GRADING CRITERIA:
- Accuracy (40%): Correct facts and concepts
- Completeness (30%): Covers key points
- Clarity (20%): Well-explained and structured
- Examples (10%): Provides relevant examples

GRADING SCALE:
- 90-100: Excellent - Comprehensive, accurate, well-explained
- 75-89: Good - Mostly correct with minor gaps
- 60-74: Satisfactory - Basic understanding shown
- 40-59: Needs Improvement - Significant gaps
- 0-39: Unsatisfactory - Major misunderstandings

Return ONLY valid JSON:
{
  "isCorrect": true/false,
  "score": 0-100,
  "feedback": "Detailed feedback explaining the score, what was good, and what could be improved"
}`

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.3,  // Lower temperature for consistent grading
      maxOutputTokens: 500
    }
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }
  )

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const data = await response.json()
  const text = data.candidates[0]?.content?.parts[0]?.text || ''

  // Parse JSON response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    // Fallback if AI doesn't return JSON
    const scoreMatch = text.match(/(\d+)/)
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 50
    return {
      questionId: '',
      question,
      studentAnswer,
      correctAnswer,
      isCorrect: score >= 60,
      score,
      feedback: text || 'Unable to grade answer automatically.'
    }
  }

  const grading = JSON.parse(jsonMatch[0])
  
  return {
    questionId: '',
    question,
    studentAnswer,
    correctAnswer,
    isCorrect: grading.isCorrect || grading.score >= 60,
    score: grading.score,
    feedback: grading.feedback
  }
}

// ========================================
// Calculate Quiz Results
// ========================================

export function calculateQuizResults(
  questions: EnhancedQuestion[],
  answers: QuizAttempt[]
): {
  score: number
  totalPoints: number
  percentage: number
  correctCount: number
  totalQuestions: number
  passingGrade: boolean
} {
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0)
  const earnedPoints = answers.reduce((sum, a) => sum + a.pointsEarned, 0)
  const correctCount = answers.filter(a => a.isCorrect).length
  
  const percentage = (earnedPoints / totalPoints) * 100
  
  return {
    score: earnedPoints,
    totalPoints,
    percentage: Math.round(percentage * 10) / 10,
    correctCount,
    totalQuestions: questions.length,
    passingGrade: percentage >= 60
  }
}

// ========================================
// Recommend Next Difficulty
// ========================================

export function recommendNextDifficulty(
  currentDifficulty: DifficultyLevel,
  percentage: number,
  attemptCount: number
): DifficultyLevel {
  // First attempt should always start easy
  if (attemptCount === 0) return 'easy'
  
  // Upgrade if scoring well
  if (percentage >= 85) {
    if (currentDifficulty === 'easy') return 'medium'
    if (currentDifficulty === 'medium') return 'hard'
  }
  
  // Downgrade if struggling
  if (percentage < 60) {
    if (currentDifficulty === 'hard') return 'medium'
    if (currentDifficulty === 'medium') return 'easy'
  }
  
  // Stay at current level
  return currentDifficulty
}
