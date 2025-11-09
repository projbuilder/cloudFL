import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, Brain, MessageSquare, CheckCircle2, Clock, Target, TrendingUp, Shield, Trophy, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { AITutorSection } from '@/components/demo/AITutorSection'
import { AdaptiveQuizSection } from '@/components/demo/AdaptiveQuizSection'
import { QuizCustomizer } from '@/components/demo/QuizCustomizer'
import { ModuleContentModal } from '@/components/ModuleContentModal'
import { StudentProgressDashboard } from '@/components/StudentProgressDashboard'
import { useAuth } from '@/core/auth'
import { logModuleView, logModuleCompletion, logQuizAttempt } from '@/services/progressTracker'

// Enhanced Quiz System Components
import { SmartQuizSelector } from '@/components/SmartQuizSelector'
import { EnhancedQuizSection } from '@/components/EnhancedQuizSection'
import { QuizHistory } from '@/components/QuizHistory'
import { QuizReview } from '@/components/QuizReview'

// Phase 3B: Federated Learning
import { PrivacyDashboard } from '@/components/PrivacyDashboard'
import { FLModelTrainer } from '@/services/flModelTrainer'

// Phase 4: Gamification & Collaboration
import { GamificationDashboard } from '@/components/GamificationDashboard'
import { DiscussionForum } from '@/components/DiscussionForum'
import { checkAndAwardAchievements } from '@/services/gamificationService'

interface Module {
  id: string
  module_number: number
  title: string
  summary: string
  content: string
  key_points: string[]
}

type ActiveView = 'modules' | 'tutor' | 'quiz' | 'progress' | 'privacy' | 'achievements' | 'discussions'
type QuizView = 'selector' | 'taking' | 'history' | 'review'

export default function StudentCourseViewPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [course, setCourse] = useState<any>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<ActiveView>('modules')
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([])
  const [modalModule, setModalModule] = useState<Module | null>(null)
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [quizQuestionCount, setQuizQuestionCount] = useState(5)
  const [showQuizCustomizer, setShowQuizCustomizer] = useState(true)
  
  // Enhanced Quiz System State
  const [quizView, setQuizView] = useState<QuizView>('selector')
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy')
  const [reviewAttemptId, setReviewAttemptId] = useState<string | null>(null)
  const [currentQuizModuleId, setCurrentQuizModuleId] = useState<string | null>(null)

  // Phase 3B: Federated Learning State
  const [flTrainer, setFlTrainer] = useState<FLModelTrainer | null>(null)
  const [flTrainingInProgress, setFlTrainingInProgress] = useState(false)

  useEffect(() => {
    loadCourseData()
  }, [courseId])

  async function loadCourseData() {
    if (!courseId || !user) return

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

      // Load student progress
      const { data: progressData } = await supabase
        .from('student_progress')
        .select('module_id, progress_percentage, completed_at')
        .eq('course_id', courseId)
        .eq('student_id', user.id)

      if (progressData) {
        const progressMap: Record<string, number> = {}
        progressData.forEach(p => {
          progressMap[p.module_id] = p.completed_at ? 100 : (p.progress_percentage || 0)
        })
        setProgress(progressMap)
      }
    } catch (error) {
      console.error('Error loading course data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function markModuleComplete(moduleId: string) {
    if (!user || !courseId) return

    try {
      // Log completion with progress tracker
      await logModuleCompletion(user.id, courseId, moduleId, 100)
      setProgress(prev => ({ ...prev, [moduleId]: 100 }))
    } catch (error) {
      console.error('Error updating progress:', error)
    }
  }

  async function handleQuizComplete(moduleIds: string[], score: number) {
    // Update progress based on quiz performance for all selected modules
    if (!user || !courseId || moduleIds.length === 0) return

    try {
      // Update progress for each module
      for (const moduleId of moduleIds) {
        const progressPercent = Math.max(progress[moduleId] || 0, score)
        
        // Log quiz completion with progress tracker
        await logModuleCompletion(user.id, courseId, moduleId, progressPercent)
        setProgress(prev => ({ ...prev, [moduleId]: progressPercent }))
      }
      
      // 🔒 PHASE 4A: Trigger Federated Learning training after quiz
      console.log('🚀 Starting FL training after quiz completion...')
      setFlTrainingInProgress(true)
      
      // Get recent quiz attempt for FL training
      const { data: recentAttempt } = await supabase
        .from('enhanced_quiz_attempts')
        .select('*')
        .eq('student_id', user.id)
        .eq('course_id', courseId)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (recentAttempt) {
        console.log('✅ Quiz data loaded for FL training')
        
        // Initialize FL trainer if needed
        if (!flTrainer) {
          const trainer = new FLModelTrainer(courseId, (progress) => {
            console.log(`📊 FL Training: ${progress.epoch}/${progress.totalEpochs} epochs, Acc: ${(progress.accuracy * 100).toFixed(1)}%`)
          })
          await trainer.initialize()
          setFlTrainer(trainer)
          console.log('✅ FL Model initialized')
        }
        
        // Convert quiz attempt to training data format
        const trainingData = {
          questions: recentAttempt.answers.map((ans: any, idx: number) => ({
            question: `Question ${idx + 1}`,
            type: ans.question_type || 'mcq',
            difficulty: recentAttempt.difficulty || 'easy',
            topic: `module_${recentAttempt.module_id}`
          })),
          answers: recentAttempt.answers.map((ans: any) => ({
            isCorrect: ans.is_correct || false,
            timeSpent: 30, // Default time
            confidence: ans.is_correct ? 0.9 : 0.3
          }))
        }
        
        // Start training in background (non-blocking)
        setTimeout(async () => {
          try {
            if (flTrainer) {
              const modelWeights = await flTrainer.train(trainingData, 10)
              console.log('✅ FL Training complete!')
              
              // Save FL update to database
              const { error: flError } = await supabase
                .from('fl_model_updates')
                .insert({
                  student_id: user.id,
                  course_id: courseId,
                  model_weights: modelWeights,
                  accuracy: modelWeights.accuracy * 100,
                  training_round: 1,
                  privacy_budget_used: 0.5,
                  created_at: new Date().toISOString()
                })
              
              if (flError) {
                console.error('❌ Error saving FL update:', flError)
              } else {
                console.log('✅ FL update saved to database')
              }
              
              // Check and award achievements after quiz completion
              console.log('🏆 Checking for new achievements...')
              const newAchievements = await checkAndAwardAchievements(user.id, courseId)
              if (newAchievements.length > 0) {
                console.log(`🎉 Unlocked ${newAchievements.length} new achievement(s)!`)
                newAchievements.forEach(ach => {
                  console.log(`   ✨ ${ach.achievement?.icon} ${ach.achievement?.name}`)
                })
              }
            }
          } catch (error) {
            console.error('❌ FL Training error:', error)
          } finally {
            setFlTrainingInProgress(false)
          }
        }, 1000)
      }
    } catch (error) {
      console.error('Error updating progress after quiz:', error)
      setFlTrainingInProgress(false)
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
          <Link to="/dashboard/student" className="text-fl-primary hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const completedModules = Object.values(progress).filter(p => p >= 100).length
  const avgProgress = modules.length > 0
    ? Math.round(Object.values(progress).reduce((sum, p) => sum + p, 0) / modules.length)
    : 0

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/dashboard/student')}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{course.title}</h1>
              <p className="text-sm text-muted-foreground">{course.description}</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-fl-primary" />
                <span>{completedModules}/{modules.length} Complete</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-fl-secondary" />
                <span>{avgProgress}% Progress</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveView('modules')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                activeView === 'modules'
                  ? 'bg-gradient-to-r from-fl-primary to-fl-secondary text-white shadow-lg'
                  : 'bg-muted hover:bg-muted/80 text-foreground'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Modules
            </button>
            <button
              onClick={() => setActiveView('tutor')}
              disabled={modules.length === 0}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                activeView === 'tutor'
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                  : modules.length === 0
                  ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                  : 'bg-muted hover:bg-muted/80 text-foreground'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              AI Tutor
            </button>
            <button
              onClick={() => {
                if (modules.length > 0) {
                  if (!currentQuizModuleId) {
                    setCurrentQuizModuleId(modules[0].id)
                  }
                  setQuizView('selector')
                }
                setActiveView('quiz')
              }}
              disabled={modules.length === 0}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                activeView === 'quiz'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                  : modules.length === 0
                  ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                  : 'bg-muted hover:bg-muted/80 text-foreground'
              }`}
            >
              <Brain className="w-4 h-4" />
              Adaptive Quiz
            </button>
            <button
              onClick={() => setActiveView('progress')}
              disabled={modules.length === 0}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                activeView === 'progress'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                  : modules.length === 0
                  ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                  : 'bg-muted hover:bg-muted/80 text-foreground'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              My Progress
            </button>
            <button
              onClick={() => setActiveView('privacy')}
              disabled={modules.length === 0}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all relative ${
                activeView === 'privacy'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg'
                  : modules.length === 0
                  ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                  : 'bg-muted hover:bg-muted/80 text-foreground'
              }`}
            >
              <Shield className="w-4 h-4" />
              Privacy & FL
              {flTrainingInProgress && (
                <span className="absolute top-0 right-0 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setActiveView('achievements')}
              disabled={modules.length === 0}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                activeView === 'achievements'
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg'
                  : modules.length === 0
                  ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                  : 'bg-muted hover:bg-muted/80 text-foreground'
              }`}
            >
              <Trophy className="w-4 h-4" />
              Achievements
            </button>
            <button
              onClick={() => setActiveView('discussions')}
              disabled={modules.length === 0}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                activeView === 'discussions'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                  : modules.length === 0
                  ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                  : 'bg-muted hover:bg-muted/80 text-foreground'
              }`}
            >
              <Users className="w-4 h-4" />
              Discussions
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Modules View */}
        {activeView === 'modules' && (
          <div>
            {modules.length === 0 ? (
              <div className="glass-card p-12 rounded-xl text-center">
                <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">No Modules Available</h3>
                <p className="text-muted-foreground">
                  The instructor hasn't added any modules yet. Check back soon!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {modules.map((module) => {
                  const moduleProgress = progress[module.id] || 0
                  const isCompleted = moduleProgress >= 100

                  return (
                    <div key={module.id} className="glass-card rounded-xl overflow-hidden border border-border hover:border-fl-primary/50 transition-all">
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="px-3 py-1 bg-fl-primary/20 text-fl-primary rounded-full text-sm font-semibold">
                                Module {module.module_number}
                              </span>
                              {isCompleted && (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                              )}
                              <h3 className="text-lg font-bold">{module.title}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">{module.summary}</p>
                            <div className="flex flex-wrap gap-2 mb-3">
                              {module.key_points.slice(0, 3).map((point, idx) => (
                                <span key={idx} className="px-2 py-1 bg-muted text-xs rounded">
                                  ✓ {point.substring(0, 40)}{point.length > 40 ? '...' : ''}
                                </span>
                              ))}
                            </div>
                            {/* Progress Bar */}
                            <div className="mb-2">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-muted-foreground">Your Progress</span>
                                <span className="font-semibold">{moduleProgress}%</span>
                              </div>
                              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-fl-primary to-fl-secondary transition-all duration-300"
                                  style={{ width: `${moduleProgress}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setModalModule(module)
                              if (user && courseId) {
                                // Log module view
                                logModuleView(user.id, courseId, module.id)
                              }
                            }}
                            className="px-4 py-2 bg-fl-primary text-white rounded-lg hover:bg-fl-primary/90 transition-colors text-sm flex items-center gap-2"
                          >
                            <BookOpen className="w-4 h-4" />
                            Study Content
                          </button>
                          <button
                            onClick={() => {
                              setSelectedModuleIds([module.id])
                              setActiveView('quiz')
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg transition-all text-sm flex items-center gap-2"
                          >
                            <Brain className="w-4 h-4" />
                            Take Quiz
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* AI Tutor View */}
        {activeView === 'tutor' && (
          <AITutorSection courseId={courseId!} />
        )}

        {/* Enhanced Quiz View */}
        {activeView === 'quiz' && courseId && user && (
          <div>
            {/* Quiz Sub-Navigation */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setQuizView('selector')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  quizView === 'selector'
                    ? 'bg-fl-primary text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                📝 Take Quiz
              </button>
              <button
                onClick={() => setQuizView('history')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  quizView === 'history'
                    ? 'bg-fl-primary text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                📜 Quiz History
              </button>
            </div>

            {/* Quiz Selector View */}
            {quizView === 'selector' && currentQuizModuleId && (
              <div>
                <div className="mb-4">
                  <label className="text-sm font-semibold mb-2 block">Select Module:</label>
                  <select
                    value={currentQuizModuleId}
                    onChange={(e) => setCurrentQuizModuleId(e.target.value)}
                    className="w-full md:w-auto px-4 py-2 bg-muted border border-border rounded-lg"
                  >
                    {modules.map((module) => (
                      <option key={module.id} value={module.id}>
                        Module {module.module_number}: {module.title}
                      </option>
                    ))}
                  </select>
                </div>
                
                <SmartQuizSelector
                  courseId={courseId}
                  moduleId={currentQuizModuleId}
                  onSelectDifficulty={(difficulty) => {
                    setSelectedDifficulty(difficulty)
                    setQuizView('taking')
                  }}
                />
              </div>
            )}

            {/* Quiz Taking View */}
            {quizView === 'taking' && currentQuizModuleId && (
              <div>
                <div className="mb-4">
                  <button
                    onClick={() => setQuizView('selector')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ← Back to quiz selection
                  </button>
                </div>
                
                <EnhancedQuizSection
                  moduleId={currentQuizModuleId}
                  courseId={courseId}
                  difficulty={selectedDifficulty}
                  onQuizComplete={(score, percentage) => {
                    handleQuizComplete([currentQuizModuleId], percentage)
                    // Auto-switch to history after 2 seconds
                    setTimeout(() => setQuizView('history'), 2000)
                  }}
                />
              </div>
            )}

            {/* Quiz History View */}
            {quizView === 'history' && (
              <div>
                <QuizHistory
                  courseId={courseId}
                  onReview={(attemptId) => {
                    setReviewAttemptId(attemptId)
                    setQuizView('review')
                  }}
                  onRetake={(moduleId, difficulty) => {
                    setCurrentQuizModuleId(moduleId)
                    setSelectedDifficulty(difficulty)
                    setQuizView('taking')
                  }}
                />
              </div>
            )}

            {/* Quiz Review View */}
            {quizView === 'review' && reviewAttemptId && (
              <div>
                <QuizReview
                  attemptId={reviewAttemptId}
                  onBack={() => setQuizView('history')}
                />
              </div>
            )}
          </div>
        )}

        {/* Progress View */}
        {activeView === 'progress' && user && courseId && (
          <StudentProgressDashboard 
            studentId={user.id}
            courseId={courseId}
          />
        )}

        {/* Privacy & Federated Learning View */}
        {activeView === 'privacy' && user && courseId && (
          <PrivacyDashboard
            studentId={user.id}
            courseId={courseId}
            onTrainingStatusChange={(inProgress) => setFlTrainingInProgress(inProgress)}
          />
        )}

        {/* Achievements View - Phase 4F */}
        {activeView === 'achievements' && user && courseId && (
          <GamificationDashboard
            studentId={user.id}
            courseId={courseId}
          />
        )}

        {/* Discussions View - Phase 4D */}
        {activeView === 'discussions' && modules.length > 0 && (
          <div>
            <div className="mb-4">
              <label className="text-sm font-semibold mb-2 block">Select Module for Discussions:</label>
              <select
                value={currentQuizModuleId || modules[0].id}
                onChange={(e) => setCurrentQuizModuleId(e.target.value)}
                className="w-full md:w-auto px-4 py-2 bg-muted border border-border rounded-lg"
              >
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    Module {module.module_number}: {module.title}
                  </option>
                ))}
              </select>
            </div>
            <DiscussionForum moduleId={currentQuizModuleId || modules[0].id} />
          </div>
        )}
      </div>

      {/* Module Content Modal */}
      <ModuleContentModal
        module={modalModule}
        isCompleted={modalModule ? (progress[modalModule.id] || 0) >= 100 : false}
        progress={modalModule ? progress[modalModule.id] || 0 : 0}
        onClose={() => setModalModule(null)}
        onMarkComplete={() => {
          if (modalModule) {
            markModuleComplete(modalModule.id)
          }
        }}
      />
    </div>
  )
}
