import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, Upload, Sparkles, Brain, MessageSquare, Trash2, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PDFUploadSection } from '@/components/demo/PDFUploadSection'

interface Module {
  id: string
  module_number: number
  title: string
  summary: string
  content: string
  key_points: string[]
  created_at: string
}

export default function CourseManagePage() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const [course, setCourse] = useState<any>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploader, setShowUploader] = useState(false)
  const [expandedModule, setExpandedModule] = useState<string | null>(null)

  useEffect(() => {
    loadCourseData()
  }, [courseId])

  async function loadCourseData() {
    if (!courseId) return

    setLoading(true)
    try {
      // Load course details
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single()

      if (courseError) throw courseError
      setCourse(courseData)

      // Load modules
      const { data: modulesData, error: modulesError } = await supabase
        .from('course_modules')
        .select('*')
        .eq('course_id', courseId)
        .order('module_number', { ascending: true })

      if (modulesError) throw modulesError
      setModules(modulesData || [])
    } catch (error) {
      console.error('Error loading course data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleModulesCreated() {
    setShowUploader(false)
    await loadCourseData()
  }

  async function handleDeleteModule(moduleId: string) {
    if (!confirm('Delete this module? This cannot be undone.')) return

    try {
      const { error } = await supabase
        .from('course_modules')
        .delete()
        .eq('id', moduleId)

      if (error) throw error
      await loadCourseData()
    } catch (error) {
      console.error('Error deleting module:', error)
      alert('Failed to delete module')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fl-primary"></div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Course Not Found</h2>
          <Link to="/dashboard/instructor" className="text-fl-primary hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/dashboard/instructor')}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{course.title}</h1>
              <p className="text-sm text-muted-foreground">{course.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${modules.length > 0 ? 'bg-green-500' : 'bg-muted'}`} />
              <span className="text-sm text-muted-foreground">
                {modules.length} {modules.length === 1 ? 'Module' : 'Modules'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Upload Section */}
        {!showUploader && (
          <div className="mb-8">
            <div className="glass-card p-6 rounded-2xl border-2 border-fl-primary/20">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">AI-Powered Module Generation</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload a PDF textbook and let Gemini AI automatically create structured learning modules with summaries, key points, and embeddings for RAG.
                  </p>
                  <button
                    onClick={() => setShowUploader(true)}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-glow transition-all inline-flex items-center gap-2"
                  >
                    <Upload className="w-5 h-5" />
                    {modules.length === 0 ? 'Upload First PDF' : 'Add More Modules'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PDF Upload Component */}
        {showUploader && (
          <div className="mb-8">
            <button
              onClick={() => setShowUploader(false)}
              className="mb-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to modules
            </button>
            <PDFUploadSection 
              courseId={courseId!} 
              onSuccess={handleModulesCreated}
            />
          </div>
        )}

        {/* Modules List */}
        {!showUploader && modules.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <BookOpen className="w-6 h-6" />
              Course Modules
            </h2>
            <div className="space-y-4">
              {modules.map((module) => (
                <div key={module.id} className="glass-card rounded-xl overflow-hidden border border-border hover:border-fl-primary/50 transition-all">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="px-3 py-1 bg-fl-primary/20 text-fl-primary rounded-full text-sm font-semibold">
                            Module {module.module_number}
                          </span>
                          <h3 className="text-lg font-bold">{module.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{module.summary}</p>
                        <div className="flex flex-wrap gap-2">
                          {module.key_points.slice(0, 3).map((point, idx) => (
                            <span key={idx} className="px-2 py-1 bg-muted text-xs rounded">
                              ✓ {point.substring(0, 40)}{point.length > 40 ? '...' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setExpandedModule(expandedModule === module.id ? null : module.id)}
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                          title="View full content"
                        >
                          <BookOpen className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteModule(module.id)}
                          className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                          title="Delete module"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {expandedModule === module.id && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <h4 className="font-semibold mb-2">Full Content:</h4>
                        <div className="prose prose-sm max-w-none text-muted-foreground">
                          {module.content.split('\n').map((para, idx) => (
                            <p key={idx} className="mb-2">{para}</p>
                          ))}
                        </div>
                        <div className="mt-4">
                          <h4 className="font-semibold mb-2">All Key Points:</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {module.key_points.map((point, idx) => (
                              <li key={idx} className="text-sm text-muted-foreground">{point}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!showUploader && modules.length === 0 && (
          <div className="glass-card p-12 rounded-xl text-center">
            <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">No Modules Yet</h3>
            <p className="text-muted-foreground mb-6">
              Upload a PDF textbook to automatically generate course modules
            </p>
            <button
              onClick={() => setShowUploader(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-glow transition-all inline-flex items-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Upload PDF Now
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
