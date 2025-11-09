import { useState, useEffect } from 'react'
import { Brain, Hash, BookOpen, Sparkles, CheckSquare, Square } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Module {
  id: string
  module_number: number
  title: string
}

interface QuizCustomizerProps {
  courseId: string
  onStartQuiz: (moduleIds: string[], questionCount: number) => void
}

export function QuizCustomizer({ courseId, onStartQuiz }: QuizCustomizerProps) {
  const [modules, setModules] = useState<Module[]>([])
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set())
  const [questionCount, setQuestionCount] = useState(5)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadModules()
  }, [courseId])

  async function loadModules() {
    try {
      const { data, error } = await supabase
        .from('course_modules')
        .select('id, module_number, title')
        .eq('course_id', courseId)
        .order('module_number', { ascending: true })

      if (error) throw error
      setModules(data || [])
      // Auto-select first module by default
      if (data && data.length > 0) {
        setSelectedModules(new Set([data[0].id]))
      }
    } catch (error) {
      console.error('Error loading modules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStart = () => {
    if (selectedModules.size > 0) {
      onStartQuiz(Array.from(selectedModules), questionCount)
    }
  }

  const toggleModule = (moduleId: string) => {
    const newSelection = new Set(selectedModules)
    if (newSelection.has(moduleId)) {
      newSelection.delete(moduleId)
    } else {
      newSelection.add(moduleId)
    }
    setSelectedModules(newSelection)
  }

  const selectAll = () => {
    setSelectedModules(new Set(modules.map(m => m.id)))
  }

  const clearAll = () => {
    setSelectedModules(new Set())
  }

  if (loading) {
    return (
      <div className="glass-card p-8 rounded-2xl text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fl-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Loading modules...</p>
      </div>
    )
  }

  if (modules.length === 0) {
    return (
      <div className="glass-card p-8 rounded-2xl text-center">
        <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-bold mb-2">No Modules Available</h3>
        <p className="text-muted-foreground">
          Ask your instructor to upload course content first.
        </p>
      </div>
    )
  }

  return (
    <div className="glass-card p-8 rounded-2xl">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Brain className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-2xl font-bold mb-2">Customize Your Quiz</h3>
        <p className="text-muted-foreground">
          Select one or more modules and choose 3-50 questions for your quiz
        </p>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Module Selection */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-fl-primary" />
              Select Modules ({selectedModules.size} selected)
            </label>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs px-3 py-1 bg-fl-primary/20 text-fl-primary rounded hover:bg-fl-primary/30 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={clearAll}
                className="text-xs px-3 py-1 bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto p-1">
            {modules.map((module) => (
              <button
                key={module.id}
                onClick={() => toggleModule(module.id)}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  selectedModules.has(module.id)
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-start gap-2">
                  {selectedModules.has(module.id) ? (
                    <CheckSquare className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Square className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium mb-1">
                      Module {module.module_number}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {module.title}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {selectedModules.size === 0 
              ? 'Select at least one module to generate quiz'
              : selectedModules.size === 1
              ? 'Questions will be from the selected module'
              : `Questions will be distributed across ${selectedModules.size} modules`
            }
          </p>
        </div>

        {/* Question Count */}
        <div>
          <label className="block text-sm font-medium mb-3 flex items-center gap-2">
            <Hash className="w-4 h-4 text-fl-secondary" />
            Number of Questions: <span className="text-fl-secondary font-bold">{questionCount}</span>
          </label>
          <input
            type="range"
            min="3"
            max="50"
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-fl-secondary"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>3 (Quick)</span>
            <span>10 (Short)</span>
            <span>25 (Standard)</span>
            <span>50 (Comprehensive)</span>
          </div>
        </div>

        {/* Difficulty Info */}
        <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-green-400 mb-1">Adaptive Features:</p>
              <ul className="space-y-1 text-green-300/80">
                <li>✓ Questions shuffle each attempt</li>
                <li>✓ Options randomized for fairness</li>
                <li>✓ Difficulty adapts to your performance</li>
                <li>✓ AI-generated with Gemini 2.5</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStart}
          disabled={selectedModules.size === 0}
          className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg flex items-center justify-center gap-2"
        >
          <Brain className="w-5 h-5" />
          {selectedModules.size === 0 
            ? 'Select Modules to Continue'
            : `Generate ${questionCount} Question${questionCount > 1 ? 's' : ''} Quiz`
          }
        </button>
      </div>
    </div>
  )
}
