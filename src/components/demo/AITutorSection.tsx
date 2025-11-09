import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, Sparkles, Database } from 'lucide-react'
import { askAITutor } from '@/services/ragTutorService'

interface AITutorSectionProps {
  courseId: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  sources?: string[]
}

export function AITutorSection({ courseId }: AITutorSectionProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "👋 Hi! I am your AI tutor powered by RAG (Retrieval Augmented Generation). I search your course content using pgvector similarity, retrieve relevant sections, and generate contextual answers with Gemini AI. Try asking me anything about Federated Learning!",
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const suggestedQuestions = [
    'What is Federated Learning?',
    'How does FL preserve privacy?',
    'What are the main challenges in FL?',
    'Explain the FedAvg algorithm'
  ]

  const handleSend = async (questionText?: string) => {
    const question = questionText || input.trim()
    if (!question || loading) return

    const userMessage: Message = {
      role: 'user',
      content: question,
      timestamp: new Date()
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const result = await askAITutor(question, courseId)

      const assistantMessage: Message = {
        role: 'assistant',
        content: result.answer || 'Sorry, I could not generate a response.',
        sources: result.sources,
        timestamp: new Date()
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Tutor error:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="space-y-6">
      {/* Chat Card */}
      <div className="glass-card rounded-2xl overflow-hidden flex flex-col" style={{ height: '600px' }}>
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold">AI Tutor (RAG-Powered)</h3>
              <p className="text-xs opacity-90">Using pgvector similarity search + Gemini Pro</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-6 h-6 text-white" />
                </div>
              )}

              <div className={`max-w-[75%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                <div
                  className={`px-4 py-3 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>

                {/* Sources (for assistant messages) */}
                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Database className="w-3 h-3" />
                    <span>Retrieved from {msg.sources.length} source(s) via pgvector</span>
                  </div>
                )}

                <span className="text-xs text-muted-foreground mt-1 block">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {msg.role === 'user' && (
                <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div className="bg-muted px-4 py-3 rounded-2xl">
                <div className="flex gap-1 items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <span className="ml-2 text-xs text-muted-foreground">Searching knowledge base...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Questions */}
        {messages.length <= 1 && (
          <div className="px-6 pb-4">
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              Try asking:
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q)}
                  disabled={loading}
                  className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg text-xs transition-colors disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border p-4 bg-background">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask anything about Federated Learning..."
              disabled={loading}
              className="flex-1 px-4 py-3 bg-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
            <Database className="w-3 h-3" />
            Powered by pgvector similarity search + Gemini Pro API
          </p>
        </div>
      </div>

      {/* Info Card */}
      <div className="glass-card p-6 rounded-xl bg-blue-500/5 border border-blue-500/20">
        <h4 className="font-bold mb-3 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-500" />
          How RAG Works Here:
        </h4>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="text-blue-500 font-bold">1.</span>
            <p>Your question is converted to a 768-dim embedding vector (Gemini embedding-001)</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-500 font-bold">2.</span>
            <p>pgvector searches Supabase for similar content using cosine similarity</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-500 font-bold">3.</span>
            <p>Retrieved context is sent to Gemini Pro with your question</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-500 font-bold">4.</span>
            <p>Gemini generates contextual answer based on YOUR course content</p>
          </div>
        </div>
      </div>
    </div>
  )
}
