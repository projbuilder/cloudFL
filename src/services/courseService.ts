import { supabase } from '@/core/auth'

export interface Course {
  id: string // UUID
  title: string
  description: string | null
  instructor_id: string
  category?: string | null
  difficulty_level?: number | null
  is_published?: boolean | null
  metadata?: any
  thumbnail_url?: string
  level?: 'Beginner' | 'Intermediate' | 'Advanced'
  duration?: string
  students_count?: number
  tags?: string[]
  created_at: string
  updated_at?: string
}

export interface Module {
  id: string // UUID
  course_id: string // UUID
  module_number: number
  title: string
  content?: string
  key_points?: string[]
  estimated_duration?: number
  video_url?: string
  created_at: string
  updated_at?: string
}

export interface Enrollment {
  id: string // UUID
  student_id: string // UUID
  course_id: string // UUID
  enrolled_at: string
  status?: 'active' | 'completed' | 'dropped'
}

export interface Progress {
  id: string // UUID
  student_id: string // UUID
  course_id: string // UUID
  progress_percentage: number
  last_accessed_at: string | null
  performance_metrics?: any
  created_at: string
  updated_at: string
}

export const courseService = {
  // Get all published courses (for students)
  async getAllCourses(): Promise<Course[]> {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  // Get course by ID
  async getCourseById(id: string): Promise<Course | null> {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  // Get courses by instructor
  async getCoursesByInstructor(instructorId: string): Promise<Course[]> {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('instructor_id', instructorId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  // Create course
  async createCourse(course: Partial<Course>): Promise<Course> {
    const { data, error } = await supabase
      .from('courses')
      .insert(course)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Update course
  async updateCourse(id: string, updates: Partial<Course>): Promise<Course> {
    const { data, error } = await supabase
      .from('courses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Delete course
  async deleteCourse(id: string): Promise<void> {
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  },

  // Get modules for a course
  async getModules(courseId: string): Promise<Module[]> {
    const { data, error } = await supabase
      .from('course_modules')
      .select('*')
      .eq('course_id', courseId)
      .order('module_number', { ascending: true })
    
    if (error) throw error
    return data || []
  },

  // Create module
  async createModule(module: Partial<Module>): Promise<Module> {
    const { data, error } = await supabase
      .from('course_modules')
      .insert(module)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Enroll in course
  async enrollInCourse(userId: string, courseId: string): Promise<Enrollment> {
    const { data, error } = await supabase
      .from('enrollments')
      .insert({
        student_id: userId,
        course_id: courseId,
        status: 'active'
      })
      .select()
      .single()
    
    if (error) {
      console.error('Enrollment error:', error)
      throw error
    }
    
    return data
  },

  // Get user enrollments
  async getUserEnrollments(userId: string): Promise<(Enrollment & { course: Course })[]> {
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        *,
        course:courses(*)
      `)
      .eq('student_id', userId)
      .order('enrolled_at', { ascending: false })
    
    if (error) {
      console.error('Get enrollments error:', error)
      throw error
    }
    return data || []
  },

  // Get/Update progress
  async getProgress(userId: string, courseId: string): Promise<Progress[]> {
    const { data, error } = await supabase
      .from('student_progress')
      .select('*')
      .eq('student_id', userId)
      .eq('course_id', courseId)
    
    if (error) throw error
    return data || []
  },

  async updateProgress(
    userId: string,
    courseId: string,
    progressPercent: number
  ): Promise<Progress> {
    const { data, error} = await supabase
      .from('student_progress')
      .upsert({
        student_id: userId,
        course_id: courseId,
        progress_percentage: progressPercent,
        last_accessed_at: new Date().toISOString()
      }, {
        onConflict: 'student_id,course_id'
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Get course analytics (for instructors)
  async getCourseAnalytics(courseId: string) {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id')
      .eq('course_id', courseId)
    
    const { data: avgProgress } = await supabase
      .from('student_progress')
      .select('progress_percentage')
      .eq('course_id', courseId)
    
    const totalStudents = enrollments?.length || 0
    const avgCompletion = avgProgress?.length
      ? avgProgress.reduce((sum, p) => sum + p.progress_percentage, 0) / avgProgress.length
      : 0
    
    return {
      totalStudents,
      avgCompletion,
      activeModules: avgProgress?.length || 0
    }
  }
}
