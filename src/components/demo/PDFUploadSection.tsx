import { useState, useEffect } from 'react'
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, Sparkles, ChevronDown, ChevronUp, BookOpen } from 'lucide-react'
import { processPDFAndCreateCourse } from '@/services/pdfService'

interface PDFUploadSectionProps {
  courseId: string
  onSuccess: (firstModuleId: string) => void
}

export function PDFUploadSection({ courseId, onSuccess }: PDFUploadSectionProps) {
  // Load existing modules on mount
  useEffect(() => {
    loadExistingModules()
  }, [])

  const loadExistingModules = async () => {
    setLoadingModules(true)
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data, error } = await supabase
        .from('course_modules')
        .select('*')
        .eq('course_id', courseId)
        .order('module_number', { ascending: true })

      if (!error && data && data.length > 0) {
        setModules(data)
        setSuccess(true)
        onSuccess(data[0].id)
      }
    } catch (err) {
      console.error('Error loading modules:', err)
    } finally {
      setLoadingModules(false)
    }
  }
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [modules, setModules] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [expandedModule, setExpandedModule] = useState<number | null>(null)
  const [loadingModules, setLoadingModules] = useState(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile)
      setError(null)
      setSuccess(false)
      setModules([])
    } else {
      setError('Please select a PDF file')
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setError(null)
    setProgress('Starting upload...')

    try {
      const result = await processPDFAndCreateCourse(file, courseId, (msg) => setProgress(msg))

      if (result.success && result.modules) {
        setSuccess(true)
        setProgress('✅ Complete!')
        // Reload modules from database to get full data including IDs
        await loadExistingModules()
      } else {
        setError(result.error?.message || 'Processing failed')
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Card */}
      <div className="glass-card p-8 rounded-2xl">
        <div className="text-center mb-6">
          <Upload className="w-16 h-16 text-fl-primary mx-auto mb-4" />
          <h3 className="text-2xl font-bold mb-2">Upload PDF Textbook</h3>
          <p className="text-muted-foreground">
            Real AI will analyze your PDF and create structured learning modules
          </p>
        </div>

        {/* File Input */}
        <label className="block">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
            id="pdf-upload"
          />
          <div
            className={`
              border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
              ${file ? 'border-fl-primary bg-fl-primary/5' : 'border-border hover:border-fl-primary/50'}
              ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {file ? (
              <div className="flex items-center justify-center gap-4">
                <FileText className="w-12 h-12 text-fl-primary" />
                <div className="text-left">
                  <p className="font-semibold text-lg">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
            ) : (
              <div>
                <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Drop PDF here or click to browse</p>
                <p className="text-sm text-muted-foreground">Educational textbooks work best</p>
              </div>
            )}
          </div>
        </label>

        {/* Upload Button */}
        {file && !success && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full mt-6 px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Transform with AI
              </>
            )}
          </button>
        )}

        {/* Progress */}
        {uploading && (
          <div className="mt-6 p-4 bg-muted rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 animate-spin text-fl-primary" />
              <span className="font-medium">{progress}</span>
            </div>
            <div className="w-full h-2 bg-background rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-fl-primary to-fl-secondary animate-pulse w-3/4"></div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-500 mb-1">Error</p>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-green-500 mb-1">Success!</p>
              <p className="text-sm text-green-400">PDF processed and modules created</p>
            </div>
          </div>
        )}
      </div>

      {/* Generated Modules */}
      {modules.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
            AI-Generated Modules ({modules.length})
          </h3>

          {modules.map((module, i) => {
            const isExpanded = expandedModule === i
            const moduleNum = module.module_number || module.moduleNumber || i + 1
            return (
              <div key={i} className="glass-card rounded-xl overflow-hidden hover:shadow-glow transition-all">
                {/* Module Header - Always Visible */}
                <div 
                  className="p-6 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedModule(isExpanded ? null : i)}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold">{moduleNum}</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-lg mb-2 flex items-center gap-2">
                        {module.title}
                        <span className="text-xs bg-fl-primary/10 text-fl-primary px-2 py-1 rounded-full">
                          Click to {isExpanded ? 'collapse' : 'expand'}
                        </span>
                      </h4>
                      <p className="text-sm text-muted-foreground">{module.summary}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-fl-primary flex-shrink-0" />
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-6 pb-6 border-t border-border animate-in slide-in-from-top-2">
                    {/* Full Content */}
                    <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <BookOpen className="w-4 h-4 text-fl-primary" />
                        <h5 className="font-semibold text-sm text-fl-primary">Full Module Content:</h5>
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{module.content}</p>
                      </div>
                    </div>

                    {/* Key Takeaways */}
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-fl-primary uppercase tracking-wide mb-3">Key Takeaways:</p>
                      <div className="grid gap-2">
                        {(module.key_points || module.keyPoints || []).map((point: string, j: number) => (
                          <div key={j} className="flex items-start gap-2 p-3 bg-fl-primary/5 border border-fl-primary/10 rounded-lg">
                            <CheckCircle2 className="w-4 h-4 text-fl-primary flex-shrink-0 mt-0.5" />
                            <span className="text-sm">{point}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <div className="text-center p-4 bg-muted/50 rounded-xl">
            <p className="text-sm text-muted-foreground">
              ✨ These modules were created by <strong>real Gemini AI</strong> analysis of your PDF
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
