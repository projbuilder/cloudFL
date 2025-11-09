// Enhanced Quiz Types with Multiple Question Types

export type QuestionType = 'single-choice' | 'multiple-choice' | 'descriptive'

export interface BaseQuestion {
  id: string
  type: QuestionType
  question: string
  explanation: string
  points: number
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface SingleChoiceQuestion extends BaseQuestion {
  type: 'single-choice'
  options: string[]
  correctIndex: number
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple-choice'
  options: string[]
  correctIndices: number[] // Multiple correct answers
  minSelections?: number // Minimum selections required
  maxSelections?: number // Maximum selections allowed
}

export interface DescriptiveQuestion extends BaseQuestion {
  type: 'descriptive'
  expectedKeywords?: string[] // Keywords to look for in answer
  minWords?: number // Minimum word count
  maxWords?: number // Maximum word count
  rubric?: {
    understanding: number // 0-100
    accuracy: number // 0-100
    completeness: number // 0-100
    clarity: number // 0-100
  }
}

export type EnhancedQuestion = SingleChoiceQuestion | MultipleChoiceQuestion | DescriptiveQuestion

export interface EnhancedQuiz {
  id: string
  module_id: string
  title: string
  difficulty: 'easy' | 'medium' | 'hard'
  questions: EnhancedQuestion[]
  total_points: number
  time_limit?: number // seconds
  created_at: string
}

export interface QuizAnswer {
  question_id: string
  question_type: QuestionType
  
  // For single/multiple choice
  selected_indices?: number[]
  
  // For descriptive
  text_answer?: string
  
  // Grading
  is_correct?: boolean
  points_earned: number
  ai_feedback?: string
}

export interface QuizAttempt {
  id: string
  quiz_id: string
  student_id: string
  course_id: string
  module_id: string
  difficulty: 'easy' | 'medium' | 'hard'
  
  answers: QuizAnswer[]
  
  score: number // Total points earned
  max_score: number // Total possible points
  percentage: number // score / max_score * 100
  
  time_spent: number // seconds
  started_at: string
  completed_at: string
  
  // AI Analysis
  strengths?: string[] // Topics student understands well
  weaknesses?: string[] // Topics needing improvement
  recommended_next_difficulty?: 'easy' | 'medium' | 'hard'
  personalized_feedback?: string
}

export interface QuizReview {
  attempt_id: string
  questions: Array<{
    question: EnhancedQuestion
    your_answer: QuizAnswer
    correct_answer: any
    explanation: string
    ai_feedback?: string
  }>
  overall_feedback: string
  strengths: string[]
  areas_for_improvement: string[]
  recommended_resources: string[]
}
