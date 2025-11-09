const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-2.5-flash'
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

interface GenerateOptions {
  model?: string
  retries?: number
  initialDelayMs?: number
}

interface GeminiRequestBody {
  contents: Array<{
    parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }>
  }>
  generationConfig?: Record<string, unknown>
  safetySettings?: Record<string, unknown>
  responseMimeType?: string
  responseSchema?: Record<string, unknown>
}

export async function callGeminiGenerate(
  body: GeminiRequestBody,
  apiKey: string,
  options: GenerateOptions = {}
): Promise<any> {
  if (!apiKey) {
    throw new Error('Gemini API key not configured')
  }

  const model = options.model ?? DEFAULT_MODEL
  const retries = options.retries ?? 3
  let delay = options.initialDelayMs ?? 1500

  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(`${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (response.ok) {
      return response.json()
    }

    const errorData = await response.json().catch(() => ({}))
    const isRetryable = RETRYABLE_STATUS.has(response.status)

    if (isRetryable && attempt < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, delay))
      delay *= 2
      continue
    }

    throw new Error(`Gemini API error: ${response.status} - ${JSON.stringify(errorData)}`)
  }

  throw new Error('Gemini generate request failed after retries')
}

export const GEMINI_GENERATE_MODEL = DEFAULT_MODEL
export const GEMINI_EMBEDDING_MODEL = 'embedding-001'

export function extractJsonPayload(rawText: string): string {
  if (!rawText) {
    throw new Error('Gemini returned empty response')
  }

  const trimmed = rawText.trim()

  // Directly strip leading code fence lines like ```json
  if (trimmed.startsWith('```')) {
    const withoutFence = trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    if (withoutFence) {
      return withoutFence
    }
  }

  // Handle markdown code fences ```json ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim()
  }

  // Attempt to find the first JSON object
  const objectMatch = trimmed.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    return objectMatch[0].trim()
  }

  // Or JSON array
  const arrayMatch = trimmed.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    return arrayMatch[0].trim()
  }

  return trimmed
}

export function extractStructuredJson(response: any): any {
  if (!response?.candidates?.[0]?.content?.parts) {
    console.error('❌ Gemini response structure:', JSON.stringify(response, null, 2))
    throw new Error('Gemini response missing expected structure')
  }

  const parts = response.candidates[0].content.parts

  for (const part of parts) {
    // Handle structured output (preferred)
    if (part?.structuredOutput) {
      return part.structuredOutput
    }

    // Try parsing inline JSON from Gemini response
    if (part?.inlineData?.jsonPayload) {
      return part.inlineData.jsonPayload
    }

    // If response is expected to be JSON but comes as text
    if (part?.functionCall?.args) {
      return part.functionCall.args
    }

    // Handle text responses (most common with responseMimeType: 'application/json')
    if (typeof part?.text === 'string' && part.text.trim()) {
      try {
        const text = part.text.trim()
        
        // If it starts with { or [, try parsing directly
        if (text.startsWith('{') || text.startsWith('[')) {
          return JSON.parse(text)
        }
        
        // Otherwise use the extraction helper
        const extracted = extractJsonPayload(text)
        const parsed = JSON.parse(extracted)
        return parsed
      } catch (error) {
        console.warn('⚠️ Failed to parse JSON from part:', part.text?.substring(0, 200))
        // Continue scanning other parts
        continue
      }
    }
  }

  console.error('❌ All parts failed. Full response:', JSON.stringify(response, null, 2))
  throw new Error('Gemini response did not contain structured JSON payload')
}
