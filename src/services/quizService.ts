import { supabase } from '@/lib/supabase'
import {
  callGeminiGenerate,
  GEMINI_GENERATE_MODEL,
  extractStructuredJson,
  extractJsonPayload
} from '@/services/geminiClient'

interface QuizQuestion {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

// Ollama fallback function
async function callOllamaGenerate(prompt: string, questionCount: number): Promise<any> {
  const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434'
  const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'llama3.2:3b'
  
  console.log(`📡 Calling Ollama at ${OLLAMA_URL} with model ${OLLAMA_MODEL}`)
  
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: prompt + '\n\nReturn ONLY the JSON array, no other text:',
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: questionCount * 300, // Estimate tokens needed
      }
    })
  })
  
  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.statusText}`)
  }
  
  const result = await response.json()
  
  // Ollama returns { response: "..." }
  // Parse the JSON from the response text
  const responseText = result.response || ''
  
  // Try to extract JSON array from response
  const start = responseText.indexOf('[')
  const end = responseText.lastIndexOf(']')
  
  if (start === -1 || end === -1) {
    throw new Error('Ollama response does not contain valid JSON array')
  }
  
  const jsonStr = responseText.slice(start, end + 1)
  const questions = JSON.parse(jsonStr)
  
  // Return in Gemini-compatible format
  return {
    candidates: [{
      content: {
        parts: [{ text: JSON.stringify(questions) }]
      }
    }]
  }
}

export async function generateQuizForModule(
  moduleId: string,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  questionCount: number = 5
): Promise<{ success: boolean; quiz?: any; error?: any }> {
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

  if (!GEMINI_API_KEY) {
    return { success: false, error: 'Gemini API key not configured. Check .env file.' }
  }

  try {
    console.log(`🎯 Generating ${difficulty} quiz for module ${moduleId}...`)

    // Get module content
    const { data: module, error: moduleError } = await supabase
      .from('course_modules')
      .select('title, content, key_points')
      .eq('id', moduleId)
      .single()

    if (moduleError || !module) {
      throw new Error('Module not found')
    }

    // Generate quiz with AI
    const questions = await generateQuestionsWithAI(module.content, module.key_points, difficulty, questionCount)

    // Save quiz to database
    const { data: quiz, error: saveError } = await supabase
      .from('quizzes')
      .insert({
        module_id: moduleId,
        title: `${module.title} - ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Quiz`,
        difficulty: difficulty,
        questions: questions
      })
      .select()
      .single()

    if (saveError) {
      throw saveError
    }

    console.log('✅ Quiz generated and saved')

    return { success: true, quiz }
  } catch (error) {
    console.error('❌ Quiz generation error:', error)
    return { success: false, error }
  }
}

async function generateQuestionsWithAI(
  content: string,
  keyPoints: string[],
  difficulty: 'easy' | 'medium' | 'hard',
  questionCount: number = 5
): Promise<QuizQuestion[]> {
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

  const difficultyInstructions = {
    easy: 'Focus on basic recall and definitions. Questions should be straightforward with obvious correct answers.',
    medium: 'Require understanding and application. Include scenario-based questions that test comprehension.',
    hard: 'Require analysis, synthesis, and critical thinking. Include complex scenarios and edge cases.'
  }

  // Use more content but intelligently truncate
  const maxContentLength = questionCount <= 5 ? 2500 : questionCount <= 10 ? 4000 : 6000
  const contentSnippet = content.substring(0, maxContentLength)
  
  const prompt = `You are an expert educational assessment designer. Create a quiz based on this learning content.

LEARNING CONTENT:
${contentSnippet}

KEY CONCEPTS TO COVER:
${keyPoints.slice(0, 8).join('\n')}

DIFFICULTY LEVEL: ${difficulty.toUpperCase()}
${difficultyInstructions[difficulty]}

🎯 CRITICAL REQUIREMENT: Generate EXACTLY ${questionCount} questions. NOT ${questionCount - 1}, NOT ${questionCount + 1}, but EXACTLY ${questionCount} questions.
The array MUST contain ${questionCount} complete question objects.

REQUIREMENTS FOR EACH QUESTION:
- Must have exactly 4 options (A, B, C, D)
- Only one option is correct
- All options must be plausible (avoid obvious distractors)
- Include a brief explanation for the correct answer
- Questions should test real understanding, not just memorization
- Vary question types: definitions, applications, scenarios, comparisons

⚠️ IMPORTANT: Return EXACTLY ${questionCount} questions in valid JSON array format.
Return ONLY valid JSON array (no markdown, no code blocks, no additional text):
[
  {
    "question": "Your question here?",
    "options": ["A) First option", "B) Second option", "C) Third option", "D) Fourth option"],
    "correctIndex": 0,
    "explanation": "Brief explanation why this is correct"
  }
  // ... repeat for all ${questionCount} questions
]`

  // Calculate tokens needed: ~250 tokens per question (question + 4 options + explanation)
  const estimatedTokens = Math.max(3000, questionCount * 300 + 1000)
  
  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: Math.min(estimatedTokens, 16000), // Increased to 16k
      topP: 0.95,
      topK: 40
    }
    // Note: gemini-2.5-flash doesn't support responseMimeType/responseSchema
    // We rely on the prompt to enforce JSON format instead
  }

  let data
  let attemptedOllama = false
  
  try {
    data = await callGeminiGenerate(requestBody, GEMINI_API_KEY, {
      model: GEMINI_GENERATE_MODEL
    })
  } catch (geminiError) {
    console.warn('⚠️ Gemini failed, attempting Ollama fallback...', geminiError)
    
    // Try Ollama fallback
    try {
      data = await callOllamaGenerate(prompt, questionCount)
      attemptedOllama = true
      console.log('✅ Ollama fallback succeeded')
    } catch (ollamaError) {
      console.error('❌ Both Gemini and Ollama failed', { geminiError, ollamaError })
      throw new Error('Both AI providers failed. Please try again with fewer questions.')
    }
  }

  let structured: unknown

  try {
    structured = extractStructuredJson(data)
  } catch (structuredError) {
    console.warn('[Gemini][Quiz] Structured parse failed, attempting text fallback', structuredError)

    const rawText = data?.candidates
      ?.flatMap((candidate: any) => candidate?.content?.parts ?? [])
      .map((part: any) => part?.text ?? '')
      .join('\n')

    if (rawText && rawText.trim()) {
      const cleaned = rawText.trim()

      console.info('[Gemini][Quiz] Raw text fallback preview:', cleaned.slice(0, 500))

      const normalizeJson = (input: string) =>
        input
          .replace(/[\u2018\u2019]/g, "'")
          .replace(/[\u201C\u201D]/g, '"')
          .replace(/,(\s*[}\]])/g, '$1')
          .replace(/\\n/g, ' ')
          .replace(/\\t/g, ' ')
          .replace(/\r/g, '')
          .replace(/\n+/g, ' ')
          .replace(/\t+/g, ' ')
          .replace(/\u0000/g, '')
          .replace(/\s+\]/g, (match) => match.trim())
          .trim()

      try {
        const extracted = extractJsonPayload(cleaned)
        structured = JSON.parse(normalizeJson(extracted))
      } catch (fallbackError) {
        console.warn('[Gemini][Quiz] extractJsonPayload parse failed, trying bracket slice')

        const start = cleaned.indexOf('[')
        const end = cleaned.lastIndexOf(']')

        if (start !== -1 && end !== -1 && end > start) {
          const slice = cleaned.slice(start, end + 1)
          try {
            structured = JSON.parse(normalizeJson(slice))
          } catch (sliceError) {
            console.error('[Gemini][Quiz] Bracket slice parse failed, attempting heuristic parser', {
              rawPreview: cleaned.slice(0, 400)
            })

            const heuristicQuestions: QuizQuestion[] = []
            const questionBlocks = cleaned.match(/\{\s*"question":[\s\S]*?\}/g) || []

            for (const block of questionBlocks) {
              const questionMatch = block.match(/"question":\s*"([\s\S]*?)"\s*,\s*"options"/)
              const optionsMatch = block.match(/"options":\s*\[([\s\S]*?)\]\s*,\s*"correctIndex"/)
              const correctMatch = block.match(/"correctIndex":\s*(\d+)/)
              const explanationMatch = block.match(/"explanation":\s*"([\s\S]*?)"\s*\}?$/)

              if (!questionMatch || !optionsMatch || !correctMatch) {
                continue
              }

              const optionTexts = Array.from(optionsMatch[1].matchAll(/"([\s\S]*?)"/g)).map((m) =>
                m[1].replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').trim()
              )

              heuristicQuestions.push({
                question: questionMatch[1].replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').trim(),
                options: optionTexts,
                correctIndex: Number.parseInt(correctMatch[1], 10),
                explanation: explanationMatch
                  ? explanationMatch[1].replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').trim()
                  : ''
              })
            }

            if (heuristicQuestions.length) {
              structured = heuristicQuestions
            } else {
              throw structuredError
            }
          }
        } else {
          console.error('[Gemini][Quiz] No array slice found in fallback text', {
            rawPreview: cleaned.slice(0, 400)
          })
          throw structuredError
        }
      }
    } else {
      throw structuredError
    }
  }

  const toQuestionsArray = (payload: unknown): QuizQuestion[] => {
    if (Array.isArray(payload)) {
      return payload as QuizQuestion[]
    }

    if (payload && typeof payload === 'object') {
      const maybe =
        (payload as any).questions ||
        (payload as any).items ||
        (payload as any).quiz ||
        (payload as any).data

      if (Array.isArray(maybe)) {
        return maybe as QuizQuestion[]
      }
    }

    return []
  }

  let questions = toQuestionsArray(structured)

  if (!questions.length) {
    console.error('[Gemini][Quiz] Unable to coerce quiz payload into question array', structured)
    throw new Error('Gemini quiz response did not contain questions')
  }

  console.info('[Gemini][Quiz] Parsed questions count:', questions.length, '| Requested:', questionCount)

  // Validate we got the requested number of questions
  if (questions.length < questionCount) {
    console.warn(`⚠️ [Gemini][Quiz] Generated ${questions.length} questions but ${questionCount} were requested`)
    console.warn(`⚠️ This may happen if the content is insufficient or token limit was reached`)
    
    // If we're way short (less than 50%), try Ollama fallback
    if (questions.length < questionCount * 0.5 && !attemptedOllama) {
      console.log('🔄 Trying Ollama due to insufficient questions from Gemini...')
      try {
        const ollamaData = await callOllamaGenerate(prompt, questionCount)
        const ollamaQuestions = toQuestionsArray(extractStructuredJson(ollamaData))
        if (ollamaQuestions.length >= questionCount * 0.5) {
          questions = ollamaQuestions
          console.log('✅ Ollama provided sufficient questions')
        } else {
          throw new Error(`Only generated ${questions.length}/${questionCount} questions - insufficient content or token limit`)
        }
      } catch (ollamaError) {
        throw new Error(`Only generated ${questions.length}/${questionCount} questions - insufficient content or token limit`)
      }
    } else if (questions.length < questionCount * 0.5) {
      throw new Error(`Only generated ${questions.length}/${questionCount} questions - insufficient content or token limit`)
    }
  }

  // Take exactly the requested number (or all if we got fewer)
  questions = questions.slice(0, questionCount)

  // Shuffle options for each question (IMPORTANT: Options randomized each attempt!)
  const shuffledQuestions = questions.map(q => {
    const optionsWithIndices = q.options.map((opt, idx) => ({ opt, idx }))
    
    // Fisher-Yates shuffle
    for (let i = optionsWithIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [optionsWithIndices[i], optionsWithIndices[j]] = [optionsWithIndices[j], optionsWithIndices[i]]
    }
    
    // Find new position of correct answer
    const newCorrectIndex = optionsWithIndices.findIndex(item => item.idx === q.correctIndex)
    
    return {
      ...q,
      options: optionsWithIndices.map(item => item.opt),
      correctIndex: newCorrectIndex
    }
  })

  console.info('[Gemini][Quiz] ✅ Options shuffled for fairness!')

  return shuffledQuestions
}

export async function recordQuizAttempt(
  quizId: string,
  answers: number[],
  timeSpent: number
): Promise<{ score: number; newDifficulty: string; feedback: string }> {
  // Get quiz data
  const { data: quiz } = await supabase.from('quizzes').select('questions, difficulty').eq('id', quizId).single()

  if (!quiz) {
    throw new Error('Quiz not found')
  }

  const questions = quiz.questions as QuizQuestion[]
  let correct = 0

  answers.forEach((answer, i) => {
    if (answer === questions[i].correctIndex) {
      correct++
    }
  })

  const score = correct / questions.length

  // Save attempt to database
  await supabase.from('quiz_attempts').insert({
    quiz_id: quizId,
    score: score,
    answers: answers,
    time_spent: timeSpent,
    difficulty_adjusted_to: null
  })

  // Adaptive difficulty adjustment logic
  let newDifficulty = quiz.difficulty
  let feedback = ''

  if (score >= 0.9 && quiz.difficulty !== 'hard') {
    // Excellent performance - increase difficulty
    newDifficulty = quiz.difficulty === 'easy' ? 'medium' : 'hard'
    feedback = `Outstanding! 🌟 You scored ${(score * 100).toFixed(0)}%. Moving to ${newDifficulty} difficulty for more challenge.`
  } else if (score >= 0.7) {
    // Good performance - maintain difficulty
    feedback = `Great job! 👏 You scored ${(score * 100).toFixed(0)}%. Keep practicing at this level.`
  } else if (score >= 0.5) {
    // Average performance - maintain or slightly adjust
    feedback = `Good effort! 💪 You scored ${(score * 100).toFixed(0)}%. Review the material and try again.`
  } else if (score < 0.5 && quiz.difficulty !== 'easy') {
    // Poor performance - decrease difficulty
    newDifficulty = quiz.difficulty === 'hard' ? 'medium' : 'easy'
    feedback = `Don't worry! 📚 You scored ${(score * 100).toFixed(0)}%. Moving to ${newDifficulty} difficulty to build stronger foundations.`
  } else {
    // Poor performance at easy level
    feedback = `Keep learning! 📖 You scored ${(score * 100).toFixed(0)}%. Review the content and practice more.`
  }

  return { score, newDifficulty, feedback }
}

export async function getQuizzesByModule(moduleId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('module_id', moduleId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching quizzes:', error)
    return []
  }

  return data || []
}
