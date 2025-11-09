import { useState, useEffect } from 'react'
import { 
  BarChart3, Users, BookOpen, TrendingUp, Clock, Award, 
  AlertCircle, Target, Brain, Activity, ChevronDown, ChevronUp
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'

interface CourseAnalytics {
  courseId: string
  courseTitle: string
  totalStudents: number
  activeStudents: number
  avgProgress: number
  avgQuizScore: number
  completionRate: number
  totalQuizAttempts: number
  avgStudyTime: number
}

interface StudentPerformance {
  studentId: string
  studentName: string
  progress: number
  quizScore: number
  studyTime: number
  completedModules: number
  totalModules: number
  lastActivity: string
  atRisk: boolean
}

export function InstructorAnalyticsDashboard({ instructorId }: { instructorId: string }) {
  const [loading, setLoading] = useState(true)
  const [coursesAnalytics, setCoursesAnalytics] = useState<CourseAnalytics[]>([])
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)
  const [studentsPerformance, setStudentsPerformance] = useState<StudentPerformance[]>([])
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d')
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null)

  useEffect(() => {
    loadAnalytics()
  }, [instructorId, timeRange])

  useEffect(() => {
    if (selectedCourse) {
      loadStudentPerformance(selectedCourse)
    }
  }, [selectedCourse])

  async function loadAnalytics() {
    setLoading(true)
    try {
      // Get all instructor's courses
      const { data: courses } = await supabase
        .from('courses')
        .select('id, title')
        .eq('instructor_id', instructorId)

      if (!courses || courses.length === 0) {
        setCoursesAnalytics([])
        setLoading(false)
        return
      }

      // Get analytics for each course
      const analyticsPromises = courses.map(async (course) => {
        // Get enrollments
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('student_id, status')
          .eq('course_id', course.id)

        const totalStudents = enrollments?.length || 0
        const activeStudents = enrollments?.filter(e => e.status === 'active').length || 0

        // Get total modules for the course
        const { data: modules } = await supabase
          .from('course_modules')
          .select('id')
          .eq('course_id', course.id)
        
        const totalModules = modules?.length || 0

        // Get student progress
        const { data: progressData } = await supabase
          .from('student_progress')
          .select('progress_percentage, time_spent_minutes, completed_at')
          .eq('course_id', course.id)

        // Calculate avg progress as (completed modules / total modules) * 100 per student
        const completedModules = progressData?.filter(p => p.completed_at).length || 0
        const avgProgress = totalModules > 0 && enrollments && enrollments.length > 0
          ? (completedModules / (totalModules * enrollments.length)) * 100
          : 0
        
        console.log(`📊 Course "${course.title}" (ID: ${course.id.substring(0,8)}...)`)
        console.log(`   - Total modules: ${totalModules}`)
        console.log(`   - Enrolled students: ${enrollments?.length || 0}`)
        console.log(`   - Completed modules: ${completedModules}`)
        console.log(`   - Progress entries: ${progressData?.length || 0}`)
        console.log(`   - Entries with completed_at:`, progressData?.filter(p => p.completed_at).map(p => ({ 
          completed_at: p.completed_at,
          progress: p.progress_percentage 
        })))
        console.log(`   - Calculated avgProgress: ${avgProgress.toFixed(2)}%`)

        const avgStudyTime = progressData && progressData.length > 0
          ? progressData.reduce((sum, p) => sum + (p.time_spent_minutes || 0), 0) / progressData.length
          : 0

        const completionRate = totalModules > 0
          ? (completedModules / totalModules) * 100
          : 0

        // Get quiz attempts from enhanced_quiz_attempts
        const { data: quizData, error: quizError } = await supabase
          .from('enhanced_quiz_attempts')
          .select('percentage')
          .eq('course_id', course.id)

        if (quizError) {
          console.error('Error fetching quiz data for course', course.id, quizError)
        }
        
        console.log(`📊 Course "${course.title}": ${quizData?.length || 0} quiz attempts found`)
        if (quizData && quizData.length > 0) {
          console.log('Quiz percentages:', quizData.map(q => q.percentage))
        }

        const avgQuizScore = quizData && quizData.length > 0
          ? quizData.reduce((sum, q) => sum + q.percentage, 0) / quizData.length
          : 0
          
        console.log(`Average quiz score for "${course.title}": ${avgQuizScore}%`)

        return {
          courseId: course.id,
          courseTitle: course.title,
          totalStudents,
          activeStudents,
          avgProgress: Math.round(avgProgress * 10) / 10,
          avgQuizScore: Math.round(avgQuizScore * 10) / 10,
          completionRate: Math.round(completionRate * 10) / 10,
          totalQuizAttempts: quizData?.length || 0,
          avgStudyTime: Math.round(avgStudyTime)
        }
      })

      const analytics = await Promise.all(analyticsPromises)
      setCoursesAnalytics(analytics)
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadStudentPerformance(courseId: string) {
    try {
      // Get course modules count
      const { data: modules } = await supabase
        .from('course_modules')
        .select('id')
        .eq('course_id', courseId)

      const totalModules = modules?.length || 0

      // Get enrolled students
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('course_id', courseId)

      if (enrollError) {
        console.error('Error fetching enrollments:', enrollError)
      }

      if (!enrollments || enrollments.length === 0) {
        setStudentsPerformance([])
        return
      }

      // Get performance for each student
      const performancePromises = enrollments.map(async (enrollment: any) => {
        const studentId = enrollment.student_id
        
        // Get student email separately
        const { data: userData } = await supabase
          .from('users')
          .select('email')
          .eq('id', studentId)
          .single()

        // Get progress
        const { data: progressData } = await supabase
          .from('student_progress')
          .select('progress_percentage, time_spent_minutes, completed_at, last_accessed_at')
          .eq('course_id', courseId)
          .eq('student_id', studentId)

        // Calculate progress as (completed modules / total modules) * 100
        const completedModules = progressData?.filter(p => p.completed_at).length || 0
        const avgProgress = totalModules > 0
          ? (completedModules / totalModules) * 100
          : 0
        
        console.log(`👤 Student ${userData?.email}: ${completedModules}/${totalModules} modules = ${avgProgress.toFixed(2)}% progress`)

        const studyTime = progressData?.reduce((sum, p) => sum + (p.time_spent_minutes || 0), 0) || 0
        const lastActivity = progressData?.[0]?.last_accessed_at || new Date().toISOString()

        // Get quiz performance from enhanced_quiz_attempts
        const { data: quizData, error: studentQuizError } = await supabase
          .from('enhanced_quiz_attempts')
          .select('percentage')
          .eq('course_id', courseId)
          .eq('student_id', studentId)

        if (studentQuizError) {
          console.error('Error fetching student quiz data:', studentQuizError)
        }

        const avgQuizScore = quizData && quizData.length > 0
          ? quizData.reduce((sum, q) => sum + q.percentage, 0) / quizData.length
          : 0

        // Determine if at risk (low progress or low quiz scores)
        const atRisk = avgProgress < 30 || avgQuizScore < 50

        return {
          studentId,
          studentName: userData?.email?.split('@')[0] || 'Student',
          progress: Math.round(avgProgress * 10) / 10,
          quizScore: Math.round(avgQuizScore * 10) / 10,
          studyTime: Math.round(studyTime),
          completedModules,
          totalModules,
          lastActivity: new Date(lastActivity).toLocaleDateString(),
          atRisk
        }
      })

      const performance = await Promise.all(performancePromises)
      // Sort by at-risk first, then by progress
      performance.sort((a, b) => {
        if (a.atRisk && !b.atRisk) return -1
        if (!a.atRisk && b.atRisk) return 1
        return b.progress - a.progress
      })

      setStudentsPerformance(performance)
    } catch (error) {
      console.error('Error loading student performance:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fl-primary"></div>
      </div>
    )
  }

  if (coursesAnalytics.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Analytics Yet</h3>
        <p className="text-muted-foreground">
          Create your first course to see analytics here!
        </p>
      </div>
    )
  }

  // Calculate overall stats
  const totalStudents = coursesAnalytics.reduce((sum, c) => sum + c.totalStudents, 0)
  const totalQuizAttempts = coursesAnalytics.reduce((sum, c) => sum + c.totalQuizAttempts, 0)
  const avgOverallProgress = coursesAnalytics.reduce((sum, c) => sum + c.avgProgress, 0) / coursesAnalytics.length
  const avgOverallQuizScore = coursesAnalytics.reduce((sum, c) => sum + c.avgQuizScore, 0) / coursesAnalytics.length

  const COLORS = ['#667eea', '#764ba2', '#f093fb', '#4facfe']

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-fl-primary" />
            <span className="text-2xl font-bold">{totalStudents}</span>
          </div>
          <p className="text-sm text-muted-foreground">Total Students</p>
        </div>

        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <BookOpen className="w-8 h-8 text-fl-secondary" />
            <span className="text-2xl font-bold">{coursesAnalytics.length}</span>
          </div>
          <p className="text-sm text-muted-foreground">Active Courses</p>
        </div>

        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 text-green-500" />
            <span className="text-2xl font-bold">{Math.round(avgOverallProgress)}%</span>
          </div>
          <p className="text-sm text-muted-foreground">Avg Progress</p>
        </div>

        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <Award className="w-8 h-8 text-yellow-500" />
            <span className="text-2xl font-bold">{Math.round(avgOverallQuizScore)}%</span>
          </div>
          <p className="text-sm text-muted-foreground">Avg Quiz Score</p>
        </div>
      </div>

      {/* Course Performance Table */}
      <div className="glass-card p-6 rounded-xl">
        <h3 className="text-xl font-bold mb-4">Course Performance</h3>
        <div className="space-y-3">
          {coursesAnalytics.map((course) => (
            <div key={course.courseId} className="border border-border rounded-lg">
              <button
                onClick={() => {
                  setSelectedCourse(course.courseId)
                  setExpandedCourse(
                    expandedCourse === course.courseId ? null : course.courseId
                  )
                }}
                className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-lg"
              >
                <div className="flex-1 text-left">
                  <h4 className="font-semibold">{course.courseTitle}</h4>
                  <code className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    ID: {course.courseId.substring(0, 8)}...
                  </code>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {course.totalStudents} students
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      {course.avgProgress}% progress
                    </span>
                    <span className="flex items-center gap-1">
                      <Brain className="w-4 h-4" />
                      {course.totalQuizAttempts} quiz attempts
                    </span>
                  </div>
                </div>
                {expandedCourse === course.courseId ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>

              {expandedCourse === course.courseId && selectedCourse === course.courseId && (
                <div className="p-4 border-t border-border">
                  <h5 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Student Performance
                  </h5>
                  {studentsPerformance.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No student data yet</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-3">Student</th>
                            <th className="text-left py-2 px-3">Progress</th>
                            <th className="text-left py-2 px-3">Modules</th>
                            <th className="text-left py-2 px-3">Quiz Score</th>
                            <th className="text-left py-2 px-3">Study Time</th>
                            <th className="text-left py-2 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentsPerformance.map((student) => (
                            <tr key={student.studentId} className="border-b border-border/50">
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-2">
                                  {student.atRisk && (
                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                  )}
                                  {student.studentName}
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-fl-primary transition-all"
                                      style={{ width: `${student.progress}%` }}
                                    />
                                  </div>
                                  <span className="text-xs">{student.progress}%</span>
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                {student.completedModules}/{student.totalModules}
                              </td>
                              <td className="py-2 px-3">
                                <span className={`${
                                  student.quizScore >= 80 ? 'text-green-500' :
                                  student.quizScore >= 60 ? 'text-yellow-500' :
                                  'text-red-500'
                                }`}>
                                  {student.quizScore}%
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                {Math.floor(student.studyTime / 60)}h {student.studyTime % 60}m
                              </td>
                              <td className="py-2 px-3">
                                {student.atRisk ? (
                                  <span className="px-2 py-1 bg-red-500/20 text-red-500 rounded text-xs">
                                    At Risk
                                  </span>
                                ) : student.progress >= 80 ? (
                                  <span className="px-2 py-1 bg-green-500/20 text-green-500 rounded text-xs">
                                    Excellent
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 bg-blue-500/20 text-blue-500 rounded text-xs">
                                    Active
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* At-Risk Students Alert */}
      {studentsPerformance.some(s => s.atRisk) && (
        <div className="glass-card p-6 rounded-xl border-l-4 border-red-500">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-lg mb-2">At-Risk Students Detected</h3>
              <p className="text-muted-foreground mb-3">
                {studentsPerformance.filter(s => s.atRisk).length} students need attention
              </p>
              <div className="space-y-2">
                {studentsPerformance.filter(s => s.atRisk).slice(0, 3).map((student) => (
                  <div key={student.studentId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="font-medium">{student.studentName}</span>
                    <span className="text-sm text-red-500">
                      {student.progress}% progress, {student.quizScore}% quiz score
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
