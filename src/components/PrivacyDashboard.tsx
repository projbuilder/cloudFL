import { useState, useEffect } from 'react'
import { Shield, Lock, Activity, TrendingUp, Database, Eye, EyeOff, CheckCircle2, Brain } from 'lucide-react'
import { FLModelTrainer, TrainingProgress } from '@/services/flModelTrainer'
import { supabase } from '@/lib/supabase'

interface PrivacyDashboardProps {
  courseId: string
  studentId: string
  onTrainingStatusChange?: (inProgress: boolean) => void
}

export function PrivacyDashboard({ courseId, studentId, onTrainingStatusChange }: PrivacyDashboardProps) {
  const [trainingStatus, setTrainingStatus] = useState<'idle' | 'training' | 'completed'>('idle')
  const [progress, setProgress] = useState<TrainingProgress | null>(null)
  const [localAccuracy, setLocalAccuracy] = useState(0)
  const [contributionCount, setContributionCount] = useState(0)
  const [privacyBudget, setPrivacyBudget] = useState(1.0)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)

  // Load FL data
  useEffect(() => {
    loadFLData()
  }, [studentId, courseId])

  async function loadFLData() {
    try {
      // Load FL model updates from database
      const { data: updates } = await supabase
        .from('fl_model_updates')
        .select('*')
        .eq('student_id', studentId)
        .eq('course_id', courseId)
        .order('created_at', { ascending: false })

      if (updates && updates.length > 0) {
        setContributionCount(updates.length)
        const latestAccuracy = updates[0].accuracy || 0
        setLocalAccuracy(latestAccuracy)
        const budgetUsed = updates.reduce((sum, u) => sum + (u.privacy_budget_used || 0), 0)
        setPrivacyBudget(Math.max(0, 1.0 - budgetUsed)) // Decrease privacy budget with each contribution
      }
    } catch (error) {
      console.error('Error loading FL data:', error)
    }
  }

  // Notify parent of training status changes
  useEffect(() => {
    if (onTrainingStatusChange) {
      onTrainingStatusChange(trainingStatus === 'training')
    }
  }, [trainingStatus, onTrainingStatusChange])

  return (
    <div className="space-y-6">
      {/* Privacy Header */}
      <div className="glass-card p-6 rounded-xl border-2 border-green-500/30">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-green-500/20 rounded-xl">
            <Shield className="w-8 h-8 text-green-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
              🔒 Your Data is Private
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </h2>
            <p className="text-muted-foreground mb-4">
              This platform uses Federated Learning to protect your privacy. Your quiz answers and learning data never leave your device.
            </p>
            
            {/* Privacy Guarantees */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Lock className="w-4 h-4 text-green-500" />
                <span>Data processed locally in browser</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-green-500" />
                <span>Only model updates shared (not answers)</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Activity className="w-4 h-4 text-green-500" />
                <span>Differential privacy adds noise</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Eye className="w-4 h-4 text-green-500" />
                <span>GDPR & CCPA compliant</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Training Status */}
      {trainingStatus !== 'idle' && (
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-fl-primary" />
            Local Model Training
          </h3>
          
          {progress && (
            <div className="space-y-4">
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">
                    {progress.status === 'initializing' && 'Initializing model...'}
                    {progress.status === 'training' && `Training: Epoch ${progress.epoch}/${progress.totalEpochs}`}
                    {progress.status === 'completed' && '✅ Training Complete!'}
                    {progress.status === 'error' && '❌ Training Error'}
                  </span>
                  <span className="font-semibold text-fl-primary">
                    {Math.round((progress.epoch / progress.totalEpochs) * 100)}%
                  </span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-fl-primary to-fl-secondary transition-all duration-300"
                    style={{ width: `${(progress.epoch / progress.totalEpochs) * 100}%` }}
                  />
                </div>
              </div>

              {/* Metrics */}
              {progress.status === 'training' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Loss</div>
                    <div className="text-xl font-bold">{progress.loss.toFixed(4)}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Accuracy</div>
                    <div className="text-xl font-bold text-green-500">
                      {(progress.accuracy * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}

              {/* Privacy Notice */}
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <Lock className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-400">
                  <strong>Privacy Protected:</strong> Your quiz answers are being used to train a model on YOUR device. 
                  The model learns patterns without your raw answers ever leaving your browser.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 text-fl-primary" />
            <span className="text-3xl font-bold">{(localAccuracy * 100).toFixed(0)}%</span>
          </div>
          <div className="text-sm text-muted-foreground">Local Model Accuracy</div>
          <div className="mt-2 text-xs text-muted-foreground">
            Your personal model's performance
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <Database className="w-8 h-8 text-fl-secondary" />
            <span className="text-3xl font-bold">{contributionCount}</span>
          </div>
          <div className="text-sm text-muted-foreground">Contributions Made</div>
          <div className="mt-2 text-xs text-muted-foreground">
            Times you've helped improve the class model
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <Shield className="w-8 h-8 text-green-500" />
            <span className="text-3xl font-bold">{privacyBudget.toFixed(2)}</span>
          </div>
          <div className="text-sm text-muted-foreground">Privacy Budget</div>
          <div className="mt-2 text-xs text-muted-foreground">
            Higher = more privacy protection
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="glass-card p-6 rounded-xl">
        <button
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="w-full flex items-center justify-between mb-4"
        >
          <h3 className="text-lg font-bold flex items-center gap-2">
            {showTechnicalDetails ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            How Federated Learning Protects Your Privacy
          </h3>
          <span className="text-sm text-muted-foreground">
            {showTechnicalDetails ? 'Hide' : 'Show'} details
          </span>
        </button>

        {showTechnicalDetails && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-fl-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold">1</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Local Training</h4>
                  <p className="text-sm text-muted-foreground">
                    When you complete a quiz, your browser trains a small AI model using your answers. 
                    This happens entirely on your device - nothing is sent to the server yet.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-fl-secondary/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold">2</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Model Updates Only</h4>
                  <p className="text-sm text-muted-foreground">
                    Instead of sending your quiz answers, we only send the model's learned patterns (called "weights"). 
                    These are mathematical numbers that can't be reverse-engineered to reveal your answers.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold">3</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Differential Privacy</h4>
                  <p className="text-sm text-muted-foreground">
                    Before sending, we add carefully calculated random noise to the model updates. 
                    This provides a mathematical guarantee (ε-differential privacy) that your individual data cannot be identified.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold">4</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Secure Aggregation</h4>
                  <p className="text-sm text-muted-foreground">
                    The server combines model updates from many students using averaging. 
                    This creates a "global model" that learns from everyone while protecting each individual's privacy.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold">5</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Download & Benefit</h4>
                  <p className="text-sm text-muted-foreground">
                    You download the improved global model, which gives you better quiz recommendations 
                    and personalized learning - all while your original data stayed private!
                  </p>
                </div>
              </div>
            </div>

            {/* Visual Diagram */}
            <div className="mt-6 p-4 bg-muted/30 rounded-lg">
              <div className="text-center mb-4">
                <h4 className="font-semibold text-sm">Privacy-Preserving Architecture</h4>
              </div>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-fl-primary rounded-lg flex items-center justify-center mb-2">
                    <Database className="w-8 h-8 text-white" />
                  </div>
                  <span className="text-xs">Your Device</span>
                  <span className="text-xs text-green-500">✅ Data Stays Here</span>
                </div>
                
                <div className="flex flex-col items-center">
                  <div className="text-2xl">→</div>
                  <span className="text-xs text-muted-foreground">Model Updates</span>
                </div>
                
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-fl-secondary rounded-lg flex items-center justify-center mb-2">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <span className="text-xs">Server</span>
                  <span className="text-xs text-blue-500">Aggregation Only</span>
                </div>
                
                <div className="flex flex-col items-center">
                  <div className="text-2xl">←</div>
                  <span className="text-xs text-muted-foreground">Global Model</span>
                </div>
                
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-green-500 rounded-lg flex items-center justify-center mb-2">
                    <Brain className="w-8 h-8 text-white" />
                  </div>
                  <span className="text-xs">Your Device</span>
                  <span className="text-xs text-purple-500">Better Learning</span>
                </div>
              </div>
            </div>

            {/* Technical Specs */}
            <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <h4 className="font-semibold text-sm mb-2">Technical Specifications</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Algorithm:</span>{' '}
                  <span className="font-mono">FedAvg</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Privacy:</span>{' '}
                  <span className="font-mono">ε-DP (ε &lt; 1.0)</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Framework:</span>{' '}
                  <span className="font-mono">TensorFlow.js</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Storage:</span>{' '}
                  <span className="font-mono">IndexedDB</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
