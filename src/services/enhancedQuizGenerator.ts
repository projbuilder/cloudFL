import { supabase } from '@/lib/supabase'
import {
  callGeminiGenerate,
  GEMINI_GENERATE_MODEL,
  extractStructuredJson
} from '@/services/geminiClient'
import type { EnhancedQuestion, EnhancedQuiz } from '@/types/enhancedQuiz'

/**
 * Enhanced Quiz Generator
 * Generates mixed question types based on difficulty:
 * - Easy: Mostly single-choice (80%) + some multiple-choice (20%)
 * - Medium: Single-choice (50%) + Multiple-choice (30%) + Descriptive (20%)
 * - Hard: Single-choice (30%) + Multiple-choice (30%) + Descriptive (40%)
 */

export async function generateEnhancedQuiz(
  moduleId: string,
  difficulty: 'easy' | 'medium' | 'hard' = 'easy',
  questionCount: number = 5
): Promise<{ success: boolean; quiz?: EnhancedQuiz; error?: any }> {
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

  if (!GEMINI_API_KEY) {
    return { success: false, error: 'Gemini API key not configured' }
  }

  try {
    console.log(`🎯 Generating enhanced ${difficulty} quiz for module ${moduleId}...`)

    // Get module content
    const { data: module, error: moduleError } = await supabase
      .from('course_modules')
      .select('title, content, key_points')
      .eq('id', moduleId)
      .single()

    if (moduleError || !module) {
      throw new Error('Module not found')
    }

    // Calculate question type distribution
    const distribution = getQuestionDistribution(difficulty, questionCount)

    // Generate questions with AI
    const questions = await generateMixedQuestions(
      module.content,
      module.key_points,
      difficulty,
      distribution
    )

    // Calculate total points
    const total_points = questions.reduce((sum, q) => sum + q.points, 0)

    // Save quiz to database
    const { data: quiz, error: saveError } = await supabase
      .from('enhanced_quizzes')
      .insert({
        module_id: moduleId,
        title: `${module.title} - ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Quiz`,
        difficulty: difficulty,
        questions: questions,
        total_points: total_points
      })
      .select()
      .single()

    if (saveError) {
      console.error('❌ Save error:', saveError)
      console.log('⚠️ Quiz not saved to database, but can still be taken')
      // If table doesn't exist or save fails, return quiz anyway with null ID
      return {
        success: true,
        quiz: {
          id: null, // null ID signals quiz wasn't saved
          module_id: moduleId,
          title: `${module.title} - ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Quiz`,
          difficulty,
          questions,
          total_points,
          created_at: new Date().toISOString()
        }
      }
    }

    console.log('✅ Enhanced quiz generated and saved')

    return { success: true, quiz }
  } catch (error) {
    console.error('❌ Enhanced quiz generation error:', error)
    return { success: false, error }
  }
}

function getQuestionDistribution(difficulty: 'easy' | 'medium' | 'hard', total: number) {
  switch (difficulty) {
    case 'easy':
      return {
        singleChoice: Math.ceil(total * 0.8),
        multipleChoice: Math.floor(total * 0.2),
        descriptive: 0
      }
    case 'medium':
      return {
        singleChoice: Math.ceil(total * 0.5),
        multipleChoice: Math.floor(total * 0.3),
        descriptive: Math.floor(total * 0.2)
      }
    case 'hard':
      return {
        singleChoice: Math.ceil(total * 0.3),
        multipleChoice: Math.floor(total * 0.3),
        descriptive: Math.floor(total * 0.4)
      }
  }
}

async function generateMixedQuestions(
  content: string,
  keyPoints: string[],
  difficulty: 'easy' | 'medium' | 'hard',
  distribution: { singleChoice: number; multipleChoice: number; descriptive: number }
): Promise<EnhancedQuestion[]> {
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

  const maxContentLength = 4000
  const contentSnippet = content.substring(0, maxContentLength)

  const totalQuestions = distribution.singleChoice + distribution.multipleChoice + distribution.descriptive

  const prompt = `You are an expert educational assessment designer. Generate a mixed-type quiz with the following distribution:
- ${distribution.singleChoice} Single-Choice questions (4 options, only 1 correct)
- ${distribution.multipleChoice} Multiple-Choice questions (4-6 options, 2-3 correct)
- ${distribution.descriptive} Descriptive questions (requires written answer)

LEARNING CONTENT:
${contentSnippet}

KEY CONCEPTS:
${keyPoints.slice(0, 8).join('\n')}

DIFFICULTY LEVEL: ${difficulty.toUpperCase()}

REQUIREMENTS:
1. Single-Choice Questions:
   - 4 options (A, B, C, D)
   - Only 1 correct answer
   - All options must be plausible
   
2. Multiple-Choice Questions (Medium/Hard):
   - 4-6 options
   - 2-3 correct answers
   - Test deeper understanding
   - Partial credit possible
   
3. Descriptive Questions (Medium/Hard):
   - Open-ended, requires paragraph response
   - Tests deep understanding and ability to explain
   - Include expected keywords and rubric criteria
   - Minimum 50 words, maximum 300 words

POINTS:
- Easy single-choice: 1 point
- Medium single-choice: 2 points
- Hard single-choice: 3 points
- Multiple-choice: 5 points
- Descriptive: 10 points

Return EXACTLY ${totalQuestions} questions in this JSON format:
[
  {
    "id": "q1",
    "type": "single-choice",
    "question": "Your question here?",
    "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
    "correctIndex": 0,
    "explanation": "Why this is correct",
    "points": 1,
    "difficulty": "easy"
  },
  {
    "id": "q2",
    "type": "multiple-choice",
    "question": "Select ALL correct answers about...",
    "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4", "E) Option 5"],
    "correctIndices": [0, 2, 3],
    "explanation": "Explanation for all correct answers",
    "points": 5,
    "difficulty": "medium",
    "minSelections": 2,
    "maxSelections": 4
  },
  {
    "id": "q3",
    "type": "descriptive",
    "question": "Explain in detail...",
    "expectedKeywords": ["keyword1", "keyword2", "concept1"],
    "explanation": "What a good answer should include",
    "points": 10,
    "difficulty": "hard",
    "minWords": 50,
    "maxWords": 300
  }
]

Return ONLY valid JSON array, no markdown, no code blocks.`

  // Estimate tokens needed: Hard quizzes with descriptive questions need more
  const estimatedTokens = Math.max(
    5000, // Minimum
    totalQuestions * 500 + 2000 // Per question + buffer
  )

  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: Math.min(estimatedTokens, 32000), // Increased to 32k for hard quizzes
      topP: 0.95,
      topK: 40
    }
  }

  try {
    const data = await callGeminiGenerate(requestBody, GEMINI_API_KEY, {
      model: GEMINI_GENERATE_MODEL
    })

    const structured = extractStructuredJson(data)
    
    let questions: any[] = []
    
    if (Array.isArray(structured)) {
      questions = structured
    } else if (structured && typeof structured === 'object') {
      questions = (structured as any).questions || (structured as any).items || []
    }

    if (!questions.length) {
      throw new Error('No questions generated')
    }

    console.log(`✅ Generated ${questions.length} mixed-type questions`)

    return questions as EnhancedQuestion[]
  } catch (error) {
    console.error('Question generation error:', error)
    throw error
  }
}

// AI-powered answer analysis for descriptive questions
export async function analyzeDescriptiveAnswer(
  question: string,
  expectedKeywords: string[],
  studentAnswer: string,
  difficulty: 'easy' | 'medium' | 'hard'
): Promise<{
  score: number
  feedback: string
  strengths: string[]
  improvements: string[]
}> {
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

  const prompt = `You are an expert educator analyzing a student's answer.

QUESTION:
${question}

EXPECTED CONCEPTS/KEYWORDS:
${expectedKeywords.join(', ')}

STUDENT'S ANSWER:
${studentAnswer}

DIFFICULTY LEVEL: ${difficulty}

Analyze the answer and provide:
1. Score out of 100 (be fair but rigorous)
2. Specific feedback on what they got right
3. Specific feedback on what they missed
4. Suggestions for improvement

Consider:
- Understanding of core concepts
- Accuracy of information
- Completeness of response
- Clarity of explanation
- Use of appropriate terminology

Return JSON format:
{
  "score": 85,
  "feedback": "Your answer demonstrates good understanding of...",
  "strengths": ["Clear explanation of X", "Correctly identified Y"],
  "improvements": ["Could expand on Z", "Consider mentioning W"]
}`

  try {
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 1000
      }
    }

    const data = await callGeminiGenerate(requestBody, GEMINI_API_KEY, {
      model: GEMINI_GENERATE_MODEL
    })

    const result = extractStructuredJson(data)
    
    return {
      score: result.score || 0,
      feedback: result.feedback || 'Answer received',
      strengths: result.strengths || [],
      improvements: result.improvements || []
    }
  } catch (error) {
    console.error('Answer analysis error:', error)
    // Fallback to keyword matching
    const keywordsFound = expectedKeywords.filter(kw => 
      studentAnswer.toLowerCase().includes(kw.toLowerCase())
    )
    const score = (keywordsFound.length / expectedKeywords.length) * 100

    return {
      score,
      feedback: `Found ${keywordsFound.length}/${expectedKeywords.length} expected concepts.`,
      strengths: keywordsFound.map(kw => `Mentioned: ${kw}`),
      improvements: expectedKeywords
        .filter(kw => !keywordsFound.includes(kw))
        .map(kw => `Could include: ${kw}`)
    }
  }
}
