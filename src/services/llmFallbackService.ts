/**
 * LLM Fallback Service - Phase 2A
 * 
 * Implements intelligent fallback between multiple LLM providers:
 * 1. Gemini (primary) - Fast, good quality, free tier
 * 2. OpenRouter (fallback) - Multiple models, pay-as-you-go
 * 3. Ollama (local) - Free, no rate limits, runs locally
 * 
 * Features:
 * - Exponential backoff on failures
 * - Automatic provider switching
 * - Cost tracking
 * - Performance monitoring
 */

import { callGeminiGenerate, GEMINI_GENERATE_MODEL } from './geminiClient'

// Provider configuration
interface LLMProvider {
  name: string
  priority: number
  enabled: boolean
  maxRetries: number
  initialDelay: number
}

interface LLMRequest {
  prompt: string
  temperature?: number
  maxTokens?: number
  responseSchema?: any
  systemPrompt?: string
}

interface LLMResponse {
  success: boolean
  data?: any
  error?: string
  provider: string
  attemptNumber: number
  latencyMs: number
  cached: boolean
}

// Provider registry
const PROVIDERS: LLMProvider[] = [
  {
    name: 'gemini',
    priority: 1,
    enabled: true,
    maxRetries: 3,
    initialDelay: 1500
  },
  {
    name: 'openrouter',
    priority: 2,
    enabled: !!import.meta.env.VITE_OPENROUTER_API_KEY,
    maxRetries: 2,
    initialDelay: 2000
  },
  {
    name: 'ollama',
    priority: 3,
    enabled: !!import.meta.env.VITE_OLLAMA_BASE_URL,
    maxRetries: 1,
    initialDelay: 0
  }
]

// Usage statistics
let stats = {
  geminiCalls: 0,
  geminiFailures: 0,
  openrouterCalls: 0,
  openrouterFailures: 0,
  ollamaCalls: 0,
  ollamaFailures: 0,
  totalLatencyMs: 0,
  cacheHits: 0
}

/**
 * Main function: Call LLM with automatic fallback
 */
export async function callLLMWithFallback(request: LLMRequest): Promise<LLMResponse> {
  const enabledProviders = PROVIDERS.filter(p => p.enabled).sort((a, b) => a.priority - b.priority)
  
  if (enabledProviders.length === 0) {
    throw new Error('No LLM providers enabled. Check environment variables.')
  }

  let lastError: any = null

  // Try each provider in order of priority
  for (const provider of enabledProviders) {
    try {
      console.log(`🤖 [LLM Fallback] Trying provider: ${provider.name}`)
      
      const response = await callProvider(provider, request)
      
      if (response.success) {
        console.log(`✅ [LLM Fallback] Success with ${provider.name} (${response.latencyMs}ms)`)
        return response
      }
      
      lastError = response.error
    } catch (error) {
      console.warn(`⚠️ [LLM Fallback] ${provider.name} failed:`, error)
      lastError = error
      
      // Continue to next provider
      continue
    }
  }

  // All providers failed
  throw new Error(`All LLM providers failed. Last error: ${lastError}`)
}

/**
 * Call specific provider with retries
 */
async function callProvider(provider: LLMProvider, request: LLMRequest): Promise<LLMResponse> {
  const startTime = Date.now()
  let delay = provider.initialDelay

  for (let attempt = 1; attempt <= provider.maxRetries; attempt++) {
    try {
      // Add delay before retry (not on first attempt)
      if (attempt > 1) {
        console.log(`⏳ [${provider.name}] Retry ${attempt}/${provider.maxRetries} in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        delay *= 2 // Exponential backoff
      }

      let data: any

      switch (provider.name) {
        case 'gemini':
          stats.geminiCalls++
          data = await callGemini(request)
          break
        
        case 'openrouter':
          stats.openrouterCalls++
          data = await callOpenRouter(request)
          break
        
        case 'ollama':
          stats.ollamaCalls++
          data = await callOllama(request)
          break
        
        default:
          throw new Error(`Unknown provider: ${provider.name}`)
      }

      const latencyMs = Date.now() - startTime
      stats.totalLatencyMs += latencyMs

      return {
        success: true,
        data,
        provider: provider.name,
        attemptNumber: attempt,
        latencyMs,
        cached: false
      }
    } catch (error: any) {
      // Check if it's a rate limit error
      const isRateLimit = error.message?.includes('429') || error.message?.includes('rate limit')
      
      if (isRateLimit && attempt < provider.maxRetries) {
        console.warn(`⏱️ [${provider.name}] Rate limited, will retry...`)
        continue
      }

      // If last attempt, record failure and throw
      if (attempt === provider.maxRetries) {
        switch (provider.name) {
          case 'gemini':
            stats.geminiFailures++
            break
          case 'openrouter':
            stats.openrouterFailures++
            break
          case 'ollama':
            stats.ollamaFailures++
            break
        }
        
        throw error
      }
    }
  }

  throw new Error(`Provider ${provider.name} exhausted all retries`)
}

/**
 * Gemini provider implementation
 */
async function callGemini(request: LLMRequest): Promise<any> {
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
  
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured')
  }

  const requestBody: any = {
    contents: [{
      parts: [{ text: request.prompt }]
    }],
    generationConfig: {
      temperature: request.temperature ?? 0.7,
      maxOutputTokens: request.maxTokens ?? 2048
    }
  }

  // Note: gemini-2.5-flash doesn't support responseMimeType/responseSchema
  // We rely on the prompt to enforce JSON format instead
  // If a schema is needed, it should be described in the prompt

  const data = await callGeminiGenerate(requestBody, GEMINI_API_KEY, {
    model: GEMINI_GENERATE_MODEL,
    retries: 1 // We handle retries at the fallback level
  })

  return data
}

/**
 * OpenRouter provider implementation
 */
async function callOpenRouter(request: LLMRequest): Promise<any> {
  const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY
  const OPENROUTER_MODEL = import.meta.env.VITE_OPENROUTER_MODEL || 'anthropic/claude-3-haiku'
  
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured')
  }

  const messages: any[] = []
  
  if (request.systemPrompt) {
    messages.push({
      role: 'system',
      content: request.systemPrompt
    })
  }
  
  messages.push({
    role: 'user',
    content: request.prompt
  })

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'FL E-Learning Platform'
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 2048
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  
  // Convert OpenRouter response format to match Gemini
  return {
    candidates: [{
      content: {
        parts: [{
          text: data.choices[0].message.content
        }]
      }
    }]
  }
}

/**
 * Ollama provider implementation (local)
 */
async function callOllama(request: LLMRequest): Promise<any> {
  const OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434'
  const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'llama2'
  
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: request.prompt,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens ?? 2048
      }
    })
  })

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}. Is Ollama running?`)
  }

  const data = await response.json()
  
  // Convert Ollama response format to match Gemini
  return {
    candidates: [{
      content: {
        parts: [{
          text: data.response
        }]
      }
    }]
  }
}

/**
 * Get usage statistics
 */
export function getLLMStats() {
  const totalCalls = stats.geminiCalls + stats.openrouterCalls + stats.ollamaCalls
  const totalFailures = stats.geminiFailures + stats.openrouterFailures + stats.ollamaFailures
  const avgLatency = totalCalls > 0 ? Math.round(stats.totalLatencyMs / totalCalls) : 0
  const successRate = totalCalls > 0 ? ((totalCalls - totalFailures) / totalCalls * 100).toFixed(1) : '0.0'

  return {
    ...stats,
    totalCalls,
    totalFailures,
    avgLatencyMs: avgLatency,
    successRate: `${successRate}%`,
    providers: PROVIDERS.filter(p => p.enabled).map(p => p.name)
  }
}

/**
 * Reset statistics
 */
export function resetLLMStats() {
  stats = {
    geminiCalls: 0,
    geminiFailures: 0,
    openrouterCalls: 0,
    openrouterFailures: 0,
    ollamaCalls: 0,
    ollamaFailures: 0,
    totalLatencyMs: 0,
    cacheHits: 0
  }
}
