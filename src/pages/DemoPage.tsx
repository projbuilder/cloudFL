import { useState } from 'react'
import { Upload, Bot, Brain, Activity, FileText, Sparkles, CheckCircle2 } from 'lucide-react'
import { PDFUploadSection } from '@/components/demo/PDFUploadSection'
import { AITutorSection } from '@/components/demo/AITutorSection'
import { AdaptiveQuizSection } from '@/components/demo/AdaptiveQuizSection'
import { FLVisualization } from '@/components/demo/FLVisualization'

type Section = 'upload' | 'tutor' | 'quiz' | 'fl'

export default function DemoPage() {
  const [activeSection, setActiveSection] = useState<Section>('upload')
  const [courseId] = useState('a1b2c3d4-e5f6-7890-abcd-ef1234567890') // Demo course UUID
  const [modulesCreated, setModulesCreated] = useState(false)
  const [firstModuleId, setFirstModuleId] = useState<string | null>(null)

  const sections = [
    { id: 'upload' as Section, name: 'PDF → Course', icon: Upload, color: 'from-purple-500 to-pink-500' },
    { id: 'tutor' as Section, name: 'AI Tutor (RAG)', icon: Bot, color: 'from-blue-500 to-cyan-500' },
    { id: 'quiz' as Section, name: 'Adaptive Quiz', icon: Brain, color: 'from-green-500 to-emerald-500' },
    { id: 'fl' as Section, name: 'FL Simulation', icon: Activity, color: 'from-orange-500 to-red-500' }
  ]

  const handlePDFSuccess = (moduleId: string) => {
    setModulesCreated(true)
    setFirstModuleId(moduleId)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <Sparkles className="w-7 h-7 text-fl-primary" />
                FL E-Learning Platform Demo
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gemini AI + Supabase + pgvector + TensorFlow.js
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${modulesCreated ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
              <span className="text-muted-foreground">
                {modulesCreated ? 'Modules Ready' : 'Upload PDF First'}
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            {sections.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.id
              const isDisabled =
                (section.id === 'tutor' && !modulesCreated) ||
                (section.id === 'quiz' && !firstModuleId)

              return (
                <button
                  key={section.id}
                  onClick={() => !isDisabled && setActiveSection(section.id)}
                  disabled={isDisabled}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap
                    ${
                      isActive
                        ? `bg-gradient-to-r ${section.color} text-white shadow-lg`
                        : isDisabled
                        ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                        : 'bg-muted hover:bg-muted/80 text-foreground'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {section.name}
                  {isDisabled && section.id !== 'fl' && (
                    <span className="text-xs opacity-75">(Upload first)</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Feature Info Banner */}
        <div className="glass-card p-6 rounded-2xl mb-8 border-2 border-fl-primary/20">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-fl-primary to-fl-secondary rounded-xl flex items-center justify-center flex-shrink-0">
              {sections.find((s) => s.id === activeSection)?.icon &&
                (() => {
                  const Icon = sections.find((s) => s.id === activeSection)!.icon
                  return <Icon className="w-6 h-6 text-white" />
                })()}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-2">
                {activeSection === 'upload' && 'PDF to Course Transformation'}
                {activeSection === 'tutor' && 'RAG-Powered AI Tutor'}
                {activeSection === 'quiz' && 'Adaptive Quiz Generation'}
                {activeSection === 'fl' && 'Federated Learning Visualization'}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {activeSection === 'upload' &&
                  '🚀 Upload a real PDF textbook and watch Gemini AI transform it into structured learning modules. Real PDF.js extraction → Gemini analysis → Supabase storage → pgvector embeddings. NO FAKE DATA!'}
                {activeSection === 'tutor' &&
                  '🤖 Ask questions and get contextual answers using Retrieval Augmented Generation (RAG). Your questions are embedded → pgvector similarity search → relevant content retrieved → Gemini generates answer. REAL VECTOR SEARCH!'}
                {activeSection === 'quiz' &&
                  '🧠 AI generates quizzes from module content and adapts difficulty based on your performance. Gemini creates real questions → tracks your score → adjusts difficulty automatically. REAL ADAPTATION!'}
                {activeSection === 'fl' &&
                  '📊 Watch a real-time simulation of Federated Learning with multiple device nodes training locally. Client-side TensorFlow.js → privacy-preserving aggregation → visual demonstration. REAL FL CONCEPTS!'}
              </p>
            </div>
          </div>
        </div>

        {/* Section Content */}
        {activeSection === 'upload' && (
          <PDFUploadSection courseId={courseId} onSuccess={handlePDFSuccess} />
        )}
        {activeSection === 'tutor' && <AITutorSection courseId={courseId} />}
        {activeSection === 'quiz' && firstModuleId && <AdaptiveQuizSection moduleId={firstModuleId} />}
        {activeSection === 'fl' && <FLVisualization />}
      </div>

      {/* Footer Stats */}
      <div className="border-t border-border bg-card/30 backdrop-blur-sm mt-12">
        <div className="container mx-auto px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-fl-primary">100%</div>
              <div className="text-xs text-muted-foreground">Real AI Integration</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-fl-secondary">pgvector</div>
              <div className="text-xs text-muted-foreground">RAG with Vector Search</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-fl-accent">Gemini</div>
              <div className="text-xs text-muted-foreground">Pro AI Model</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">Production</div>
              <div className="text-xs text-muted-foreground">Ready Architecture</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
