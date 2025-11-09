import { useEffect, useState } from 'react'
import { 
  TrendingUp, TrendingDown, Clock, Target, Award, 
  BookOpen, CheckCircle2, AlertCircle, Sparkles, 
  Activity, Calendar, Brain
} from 'lucide-react'
import { getCourseInsights, type CourseInsights } from '@/services/progressTrackingService'

interface StudentProgressDashboardProps {
  studentId: string
  courseId: string
}

export function StudentProgressDashboard({ studentId, courseId }: StudentProgressDashboardProps) {
  const [insights, setInsights] = useState<CourseInsights | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInsights()
  }, [studentId, courseId])

  async function loadInsights() {
    try {
      setLoading(true)
      const data = await getCourseInsights(studentId, courseId)
      setInsights(data)
    } catch (error) {
      console.error('Error loading progress insights:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="glass-card p-8 rounded-2xl">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fl-primary"></div>
        </div>
      </div>
    )
  }

  if (!insights) {
    return (
      <div className="glass-card p-8 rounded-2xl text-center">
        <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No progress data available yet</p>
        <p className="text-sm text-muted-foreground mt-2">
          Complete some modules and take quizzes to see your analytics
        </p>
      </div>
    )
  }

  const completionPercentage = (insights.completedModules / insights.totalModules) * 100

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Progress */}
        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <BookOpen className="w-8 h-8 text-blue-400" />
            <span className={`text-2xl font-bold ${
              completionPercentage >= 100 ? 'text-green-400' : 
              completionPercentage >= 50 ? 'text-blue-400' : 'text-yellow-400'
            }`}>
              {Math.round(completionPercentage)}%
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-1">Course Progress</p>
          <p className="text-xs text-muted-foreground">
            {insights.completedModules} of {insights.totalModules} modules
          </p>
          <div className="w-full bg-white/10 rounded-full h-2 mt-3">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-fl-primary to-fl-secondary transition-all"
              style={{ width: `${completionPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Average Score */}
        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <Target className="w-8 h-8 text-purple-400" />
            <span className={`text-2xl font-bold ${
              insights.averageScore >= 80 ? 'text-green-400' : 
              insights.averageScore >= 60 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {insights.averageScore}%
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-1">Average Score</p>
          <p className="text-xs text-muted-foreground">
            Across {insights.quizAttempts} quiz attempts
          </p>
        </div>

        {/* Study Time */}
        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <Clock className="w-8 h-8 text-green-400" />
            <span className="text-2xl font-bold text-green-400">
              {Math.floor(insights.totalStudyTime / 60)}h {insights.totalStudyTime % 60}m
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-1">Study Time</p>
          <p className="text-xs text-muted-foreground">
            Total time invested
          </p>
        </div>

        {/* Quiz Count */}
        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <Activity className="w-8 h-8 text-pink-400" />
            <span className="text-2xl font-bold text-pink-400">
              {insights.quizAttempts}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-1">Quiz Attempts</p>
          <p className="text-xs text-muted-foreground">
            Practice makes perfect
          </p>
        </div>
      </div>

      {/* Progress Trend Chart */}
      {insights.progressTrend.length > 0 ? (
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-fl-primary" />
            Performance Trend
          </h3>
          <div className="flex items-end justify-around gap-2 h-48 px-4">
            {insights.progressTrend.map((point, index) => {
              const heightPercent = Math.max(point.score, 5) // Min 5% for visibility
              return (
                <div key={index} className="flex flex-col items-center gap-2 min-w-[40px]">
                  <span className="text-xs font-semibold text-fl-primary mb-1">
                    {Math.round(point.score)}%
                  </span>
                  <div 
                    className="w-full bg-gradient-to-t from-fl-primary to-fl-secondary rounded-lg transition-all hover:opacity-80 hover:scale-105 cursor-pointer"
                    style={{ height: `${(heightPercent / 100) * 160}px`, minHeight: '8px' }}
                    title={`${point.score}% on ${point.date}`}
                  ></div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap mt-1">
                    {point.date.split('/').slice(0, 2).join('/')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-fl-primary" />
            Performance Trend
          </h3>
          <div className="text-center py-8">
            <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">
              Take more quizzes to see your performance trend
            </p>
          </div>
        </div>
      )}

      {/* Strengths and Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-green-400" />
            Your Strengths
          </h3>
          {insights.strengths.length > 0 ? (
            <div className="space-y-3">
              {insights.strengths.map((strength, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{strength.topic}</span>
                    <span className="text-sm font-bold text-green-400">
                      {Math.round(strength.confidence)}%
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div 
                      className="h-full rounded-full bg-green-400 transition-all"
                      style={{ width: `${strength.confidence}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">
                Take more quizzes to identify your strengths
              </p>
            </div>
          )}
        </div>

        {/* Weaknesses */}
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-400" />
            Areas to Improve
          </h3>
          {insights.weaknesses.length > 0 ? (
            <div className="space-y-3">
              {insights.weaknesses.map((weakness, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{weakness.topic}</span>
                    <span className="text-sm font-bold text-orange-400">
                      {Math.round(weakness.needsWork)}%
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div 
                      className="h-full rounded-full bg-orange-400 transition-all"
                      style={{ width: `${weakness.needsWork}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">
                Great job! Keep taking quizzes to maintain your performance
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      {insights.recommendations.length > 0 && (
        <div className="glass-card p-6 rounded-xl border-2 border-fl-primary/30">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-fl-primary" />
            Personalized Recommendations
          </h3>
          <div className="space-y-3">
            {insights.recommendations.map((rec, index) => (
              <div 
                key={index}
                className="flex items-start gap-3 p-4 bg-fl-primary/10 rounded-lg border border-fl-primary/20"
              >
                <div className="w-6 h-6 rounded-full bg-fl-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-fl-primary">{index + 1}</span>
                </div>
                <p className="text-sm flex-1">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 justify-center">
        <button
          onClick={loadInsights}
          className="px-6 py-3 bg-gradient-to-r from-fl-primary to-fl-secondary text-white rounded-lg hover:shadow-glow transition-all flex items-center gap-2"
        >
          <Activity className="w-5 h-5" />
          Refresh Analytics
        </button>
      </div>
    </div>
  )
}
