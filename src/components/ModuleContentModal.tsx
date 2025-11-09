import { X, CheckCircle2, BookOpen, Clock } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import 'highlight.js/styles/github-dark.css'

// Initialize Mermaid
mermaid.initialize({
  startOnLoad: true,
  theme: 'dark',
  securityLevel: 'loose',
  themeVariables: {
    primaryColor: '#667eea',
    primaryTextColor: '#fff',
    primaryBorderColor: '#764ba2',
    lineColor: '#667eea',
    secondaryColor: '#764ba2',
    tertiaryColor: '#f093fb'
  }
})

// Format dense module content for better readability
function formatModuleContent(content: string): string {
  if (!content) return ''
  
  let formatted = content
  
  // Convert bullet points (•) to markdown list items
  formatted = formatted.replace(/\s*•\s*/g, '\n- ')
  
  // Convert numbered lists (1., 2., etc) to markdown
  formatted = formatted.replace(/(\d+)\.\s+/g, '\n$1. ')
  
  // Split very long paragraphs (> 400 chars) into smaller ones
  formatted = formatted.split('\n').map(para => {
    if (para.length > 400 && !para.startsWith('-') && !para.startsWith('#')) {
      // Split at sentence boundaries
      const sentences = para.match(/[^.!?]+[.!?]+/g) || [para]
      const chunks: string[] = []
      let currentChunk = ''
      
      sentences.forEach(sentence => {
        if (currentChunk.length + sentence.length > 300) {
          if (currentChunk) chunks.push(currentChunk.trim())
          currentChunk = sentence
        } else {
          currentChunk += sentence
        }
      })
      if (currentChunk) chunks.push(currentChunk.trim())
      
      return chunks.join('\n\n')
    }
    return para
  }).join('\n')
  
  // Add spacing between paragraphs
  formatted = formatted.replace(/\n{3,}/g, '\n\n')
  
  // Detect section titles (look for patterns like "Title:" or capitalized lines)
  formatted = formatted.split('\n').map(line => {
    // If line ends with colon and is relatively short, make it a heading
    if (line.trim().match(/^[A-Z][^:]{5,50}:$/) && !line.startsWith('-')) {
      return `\n## ${line.trim().replace(/:$/, '')}\n`
    }
    // If line is all caps and short, make it a heading
    if (line.trim().match(/^[A-Z\s]{10,50}$/) && !line.startsWith('-')) {
      return `\n## ${line.trim()}\n`
    }
    return line
  }).join('\n')
  
  // Clean up extra whitespace
  formatted = formatted.trim()
  
  return formatted
}

interface Module {
  id: string
  module_number: number
  title: string
  summary: string
  content: string
  key_points: string[]
  estimated_duration?: number
}

interface ModuleContentModalProps {
  module: Module | null
  isCompleted: boolean
  progress: number
  onClose: () => void
  onMarkComplete: () => void
}

// Component to render Mermaid diagrams
function MermaidDiagram({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [id] = useState(() => `mermaid-${Date.now()}-${Math.floor(Math.random() * 10000)}`)
  
  useEffect(() => {
    if (ref.current && chart) {
      try {
        // Clear previous content
        ref.current.innerHTML = ''
        
        // Render mermaid diagram
        mermaid.render(id, chart).then(({ svg }) => {
          if (ref.current) {
            ref.current.innerHTML = svg
          }
        }).catch((error) => {
          console.error('Mermaid rendering error:', error)
          // Fallback: show raw text
          if (ref.current) {
            ref.current.innerHTML = `<pre class="text-xs text-muted-foreground">${chart}</pre>`
          }
        })
      } catch (error) {
        console.error('Mermaid rendering error:', error)
      }
    }
  }, [chart, id])
  
  return (
    <div 
      ref={ref} 
      className="mermaid-diagram my-6 p-4 bg-muted/30 rounded-lg overflow-x-auto"
    />
  )
}

export function ModuleContentModal({
  module,
  isCompleted,
  progress,
  onClose,
  onMarkComplete
}: ModuleContentModalProps) {
  if (!module) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-5xl my-8 border border-border">
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-6 rounded-t-2xl z-10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 bg-fl-primary/20 text-fl-primary rounded-full text-sm font-semibold">
                  Module {module.module_number}
                </span>
                {isCompleted && (
                  <div className="flex items-center gap-1 text-green-500">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Completed</span>
                  </div>
                )}
                {module.estimated_duration && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">{module.estimated_duration} min</span>
                  </div>
                )}
              </div>
              <h2 className="text-2xl font-bold mb-2">{module.title}</h2>
              <p className="text-muted-foreground">{module.summary}</p>
              
              {/* Progress */}
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Your Progress</span>
                  <span className="font-semibold text-fl-primary">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-fl-primary to-fl-secondary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="ml-4 p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6 max-h-[60vh] overflow-y-auto">
          {/* Module Content with Markdown */}
          <div className="prose prose-invert prose-lg max-w-none mb-8">
            <ReactMarkdown
              rehypePlugins={[rehypeHighlight]}
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ node, ...props }) => <h1 className="text-3xl font-bold mb-6 mt-8 text-fl-primary" {...props} />,
                h2: ({ node, ...props }) => <h2 className="text-2xl font-bold mb-4 mt-8 text-fl-secondary" {...props} />,
                h3: ({ node, ...props }) => <h3 className="text-xl font-semibold mb-3 mt-6" {...props} />,
                p: ({ node, ...props }) => <p className="mb-5 leading-relaxed text-foreground text-base" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc list-outside ml-6 mb-6 space-y-3" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal list-outside ml-6 mb-6 space-y-3" {...props} />,
                li: ({ node, ...props }) => <li className="text-foreground leading-relaxed" {...props} />,
                code: ({ node, inline, className, children, ...props }: any) => {
                  const match = /language-(\w+)/.exec(className || '')
                  const language = match ? match[1] : ''
                  const value = String(children).replace(/\n$/, '')
                  
                  // Render Mermaid diagrams
                  if (language === 'mermaid') {
                    return <MermaidDiagram chart={value} />
                  }
                  
                  return inline ? (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-fl-primary" {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className="block bg-muted p-4 rounded-lg overflow-x-auto text-sm" {...props}>
                      {children}
                    </code>
                  )
                },
                blockquote: ({ node, ...props }) => (
                  <blockquote className="border-l-4 border-fl-primary pl-4 italic my-4 text-muted-foreground" {...props} />
                ),
                a: ({ node, ...props }) => (
                  <a className="text-fl-primary hover:underline" {...props} />
                ),
                table: ({ node, ...props }) => (
                  <div className="overflow-x-auto my-4">
                    <table className="min-w-full border border-border" {...props} />
                  </div>
                ),
                th: ({ node, ...props }) => (
                  <th className="border border-border bg-muted px-4 py-2 font-semibold" {...props} />
                ),
                td: ({ node, ...props }) => (
                  <td className="border border-border px-4 py-2" {...props} />
                ),
              }}
            >
              {formatModuleContent(module.content)}
            </ReactMarkdown>
          </div>

          {/* Key Takeaways Section */}
          {module.key_points && module.key_points.length > 0 && (
            <div className="bg-gradient-to-br from-fl-primary/10 to-fl-secondary/10 border border-fl-primary/20 rounded-xl p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-fl-primary" />
                <h3 className="text-xl font-bold">Key Takeaways</h3>
              </div>
              <ul className="space-y-3">
                {module.key_points.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border px-8 py-4 rounded-b-2xl flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-muted hover:bg-muted/80 rounded-lg transition-colors font-medium"
          >
            Close
          </button>
          
          {!isCompleted && (
            <button
              onClick={() => {
                onMarkComplete()
                onClose()
              }}
              className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg transition-all font-medium flex items-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              Mark as Complete
            </button>
          )}
          
          {isCompleted && (
            <div className="flex items-center gap-2 text-green-500">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Module Completed!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
