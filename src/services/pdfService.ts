import * as pdfjsLib from 'pdfjs-dist'
import { supabase } from '@/lib/supabase'
import { callGeminiGenerate, GEMINI_GENERATE_MODEL, extractStructuredJson } from '@/services/geminiClient'

// CRITICAL: Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`

interface ProcessedModule {
  moduleNumber: number
  title: string
  summary: string
  content: string
  keyPoints: string[]
}

interface ModuleAIResponse {
  title: string
  summary: string
  content: string
  keyPoints: string[]
}

async function extractTextWithGemini(file: File): Promise<string> {
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured for OCR fallback')
  }

  const base64 = await fileToBase64(file)

  // Add small delay to avoid rate limits
  await new Promise(resolve => setTimeout(resolve, 1000))

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text:
              'You are an OCR expert. Read the attached PDF and return clean, readable text in English. Preserve paragraph structure and headings. Output ONLY the extracted text without additional commentary.'
          },
          {
            inline_data: {
              mime_type: file.type || 'application/pdf',
              data: base64
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192
    }
  }

  const data = await callGeminiGenerate(requestBody, GEMINI_API_KEY)
  const parts = data?.candidates?.[0]?.content?.parts || []
  const text = parts.map((part: any) => part.text || '').join('\n').trim()

  if (!text) {
    throw new Error('Gemini OCR did not return readable text')
  }

  return text
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = (error) => reject(error)
    reader.readAsDataURL(file)
  })
}

export async function processPDFAndCreateCourse(
  file: File,
  courseId: string,
  onProgress?: (message: string) => void
): Promise<{ success: boolean; modules?: ProcessedModule[]; error?: any }> {
  try {
    console.log('📄 Starting PDF processing...')
    onProgress?.('📄 Uploading PDF to storage...')

    // Step 1: Upload PDF to Supabase Storage
    const fileName = `${Date.now()}_${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('course-materials')
      .upload(fileName, file)

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)
    console.log('✅ PDF uploaded to storage')

    // Step 2: Clear existing course content so fresh upload replaces it
    onProgress?.('🧹 Clearing previous modules and embeddings...')
    await supabase.from('course_embeddings').delete().eq('course_id', courseId)
    await supabase.from('course_modules').delete().eq('course_id', courseId)

    // Step 3: Extract text from PDF
    onProgress?.('📖 Extracting text from PDF...')
    let text = await extractTextFromPDF(file)
    console.log(`✅ Extracted ${text.length} characters from PDF`)

    if (!isReadableText(text)) {
      console.warn('⚠️ Extracted text looks unreadable. Falling back to Gemini OCR...')
      onProgress?.('🧠 Enhancing text with Gemini (OCR)...')
      text = await extractTextWithGemini(file)
      console.log(`✅ Gemini OCR extracted ${text.length} characters from PDF`)
    }

    if (text.length < 100) {
      throw new Error('PDF appears to be empty or unreadable')
    }

    // Step 4: Split into manageable chunks (NotebookLM-style dynamic chunking)
    onProgress?.('✂️ Intelligently splitting content into modules...')
    const chunks = splitIntoChunks(text, 3000) // ~3000 chars per module for better context
    console.log(`✅ Split into ${chunks.length} chunks - PROCESSING ALL (no limit!)`)

    // Step 5: Transform ALL chunks with AI (like NotebookLM - no hardcoded limits!)
    const modulesToProcess = chunks.length // Process ALL chunks dynamically
    const modules: ProcessedModule[] = []

    for (let i = 0; i < modulesToProcess; i++) {
      onProgress?.(`🤖 AI transforming module ${i + 1}/${modulesToProcess} (intelligent analysis)...`)
      console.log(`🤖 Processing module ${i + 1}/${modulesToProcess}...`)

      const module = await transformChunkToModule(chunks[i], i + 1)
      modules.push(module)

      // Step 5: Save to database
      const { data: savedModule, error: saveError } = await supabase
        .from('course_modules')
        .insert({
          course_id: courseId,
          module_number: module.moduleNumber,
          title: module.title,
          summary: module.summary,
          content: module.content,
          key_points: module.keyPoints
        })
        .select()
        .single()

      if (saveError) {
        console.error('Error saving module:', saveError)
        throw saveError
      } else {
        console.log(`✅ Module ${i + 1} saved to database`)

        // Step 6: Generate embeddings for RAG
        onProgress?.(`🔗 Generating embeddings for module ${i + 1}...`)
        await generateEmbedding(courseId, savedModule.id, module.content)
      }
    }

    onProgress?.('🎉 PDF processing complete!')
    console.log('🎉 PDF processing complete!')
    return { success: true, modules }
  } catch (error) {
    console.error('❌ PDF processing error:', error)
    return { success: false, error }
  }
}

async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  let fullText = ''

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items.map((item: any) => item.str).join(' ')
    fullText += pageText + '\n\n'
  }

  return fullText.trim()
}

function splitIntoChunks(text: string, maxChunkSize: number): string[] {
  // Smart chunking by paragraphs
  const paragraphs = text.split(/\n\n+/)
  const chunks: string[] = []
  let currentChunk = ''

  for (const para of paragraphs) {
    if ((currentChunk + para).length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim())
      currentChunk = para
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

function isReadableText(text: string): boolean {
  if (!text) return false
  const sanitized = text.replace(/\s+/g, '')
  if (sanitized.length < 100) return false

  let readable = 0
  for (const char of sanitized) {
    const code = char.charCodeAt(0)
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 591)) {
      readable++
    }
  }

  const ratio = readable / sanitized.length
  console.log(`ℹ️ Readability ratio: ${ratio.toFixed(2)}`)
  return ratio > 0.6
}

async function transformChunkToModule(
  chunk: string,
  moduleNumber: number
): Promise<ProcessedModule> {
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

  if (!GEMINI_API_KEY) {
    throw new Error('❌ GEMINI_API_KEY not found! Check your .env file.')
  }

  const prompt = `You are an expert educational content designer creating comprehensive, visually-rich learning modules for students.

TEXTBOOK CONTENT:
${chunk}

YOUR TASK: Transform this textbook content into a detailed, student-friendly learning module with visual aids.

📝 CONTENT REQUIREMENTS:
- Write 800-1200 words of COMPREHENSIVE content (not brief!)
- Use conversational, engaging tone
- SHORT paragraphs (2-3 sentences max)
- Add markdown headings (##, ###) for structure
- Include concrete examples and real-world applications
- Use analogies to explain complex concepts
- Add image placeholders for visual concepts

🖼️ VISUAL AIDS (CRITICAL):
When concepts benefit from visualization, use Mermaid diagrams for visual representation.

**Use Mermaid Syntax for Diagrams:**

For System Architecture/Block Diagrams:
\`\`\`mermaid
graph TD
    A[Component A] --> B[Component B]
    B --> C[Component C]
\`\`\`

For Process Flows:
\`\`\`mermaid
flowchart LR
    Start --> Process1 --> Decision{Check?}
    Decision -->|Yes| Process2
    Decision -->|No| Process3
\`\`\`

For Network Topology:
\`\`\`mermaid
graph TB
    Client[Client Device] --> Router[Router]
    Router --> Server1[Server 1]
    Router --> Server2[Server 2]
\`\`\`

For Sequence Diagrams:
\`\`\`mermaid
sequenceDiagram
    User->>System: Request
    System->>Database: Query
    Database-->>System: Response
    System-->>User: Display
\`\`\`

**IMPORTANT:** Always use Mermaid diagrams (wrapped in \`\`\`mermaid) instead of image URLs. This ensures diagrams render properly!

🎯 CONTENT STRUCTURE:

## Why This Matters
[3-4 sentences: Real-world relevance and importance]

## Core Concepts
[300-400 words: Detailed explanation of main ideas]
- Break into subsections with ### headings
- Include examples for each concept
- Add image placeholders where helpful

## How It Works
[200-300 words: Step-by-step breakdown]
- Use numbered lists for processes
- Add diagrams for complex flows

## Real-World Applications
[200-300 words: Practical use cases]
- Provide 2-3 concrete examples
- Explain industry applications

## Common Challenges & Solutions
[100-200 words: Pitfalls and best practices]

4. KEY_POINTS: 5-6 specific, actionable takeaways

Return ONLY valid JSON (no code blocks):
{
  "title": "Specific Technical Topic Name",
  "summary": "2-3 sentences explaining what students will learn",
  "content": "COMPREHENSIVE 800-1200 word markdown content with ## headings, paragraphs, images, and examples",
  "keyPoints": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5", "Point 6"]
}`

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096  // Increased for comprehensive content (800-1200 words)
    }
    // Note: gemini-2.5-flash doesn't support responseMimeType/responseSchema
    // We rely on the prompt to enforce JSON format instead
  }

  const maxAttempts = 2
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const data = await callGeminiGenerate(requestBody, GEMINI_API_KEY, {
        model: GEMINI_GENERATE_MODEL
      })

      const parsed = extractStructuredJson(data) as ModuleAIResponse
      
      console.log(`✅ [Gemini][Module ${moduleNumber}][Attempt ${attempt}] Successfully parsed JSON response`)
      console.log(`   Title: ${parsed.title}`)
      console.log(`   Key Points: ${parsed.keyPoints?.length || 0}`)

      // Validate and clean up the title
      let title = parsed.title || `Module ${moduleNumber}`
      const forbiddenTitles = ['introduction', 'overview', 'chapter', 'module', 'section']
      const titleLower = title.toLowerCase()

      if (forbiddenTitles.some((forbidden) => titleLower === forbidden || titleLower.startsWith(forbidden + ' '))) {
        const firstLine = chunk.split('\n')[0].trim()
        if (firstLine.length > 10 && firstLine.length < 100) {
          title = firstLine.substring(0, 80)
        } else {
          title = `Module ${moduleNumber}: ${chunk.substring(0, 50).trim()}...`
        }
      }

      return {
        moduleNumber,
        title: title.trim(),
        summary: parsed.summary || 'Learning module covering key concepts',
        content: parsed.content || chunk,
        keyPoints:
          Array.isArray(parsed.keyPoints) && parsed.keyPoints.length
            ? parsed.keyPoints
            : extractKeyPoints(parsed.content || chunk)
      }
    } catch (error) {
      lastError = error
      console.error(`❌ [Gemini][Module ${moduleNumber}][Attempt ${attempt}]`, error)

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
      }
    }
  }

  console.error('❌ AI transformation error after retries:', lastError)

  // Fallback to basic formatting
  return {
    moduleNumber,
    title: `Module ${moduleNumber}: Introduction`,
    summary: chunk.substring(0, 200) + '...',
    content: chunk,
    keyPoints: extractKeyPoints(chunk)
  }
}

function extractKeyPoints(text: string): string[] {
  // Simple extraction of first sentences as key points
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20)
  return sentences.slice(0, 3).map((s) => s.trim())
}

async function generateEmbedding(courseId: string, moduleId: string, content: string) {
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
  const maxRetries = 3
  let delay = 2000

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Add delay to avoid rate limiting (increases with each retry)
      await new Promise(resolve => setTimeout(resolve, delay))
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'models/embedding-001',
            content: { parts: [{ text: content.substring(0, 2000) }] }
          })
        }
      )

      if (!response.ok) {
        // If rate limited, retry with exponential backoff
        if (response.status === 429 && attempt < maxRetries) {
          console.warn(`⚠️ Rate limited (429), retrying in ${delay * 2}ms... (attempt ${attempt}/${maxRetries})`)
          delay *= 2
          continue
        }
        throw new Error(`Embedding API error: ${response.status}`)
      }

      const data = await response.json()
      const embedding = data.embedding.values

      // Store in Supabase with pgvector
      await supabase.from('course_embeddings').insert({
        course_id: courseId,
        module_id: moduleId,
        content: content.substring(0, 1000), // Store first 1000 chars
        embedding: embedding
      })

      console.log('✅ Embedding generated and stored')
      return // Success, exit function
    } catch (error) {
      if (attempt === maxRetries) {
        console.error('⚠️ Embedding error after retries (non-fatal):', error)
        // Don't throw - embeddings are optional for basic functionality
      }
    }
  }
}
