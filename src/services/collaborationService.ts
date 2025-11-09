/**
 * Collaboration Service - Phase 4D
 * Forums, Study Groups, Shared Notes
 */

import { supabase } from '@/lib/supabase'

// ========================================
// Types
// ========================================

export interface Discussion {
  id: string
  moduleId: string
  authorId: string
  authorEmail?: string
  parentId?: string
  title?: string
  content: string
  isPinned: boolean
  isLocked: boolean
  upvotes: number
  createdAt: string
  updatedAt: string
  replies?: Discussion[]
}

export interface StudyGroup {
  id: string
  courseId: string
  name: string
  description?: string
  createdBy: string
  isPublic: boolean
  maxMembers: number
  memberCount: number
  createdAt: string
}

export interface SharedNote {
  id: string
  moduleId: string
  authorId: string
  authorEmail?: string
  title?: string
  content: string
  isPublic: boolean
  upvotes: number
  createdAt: string
  updatedAt: string
}

// ========================================
// Discussions
// ========================================

export async function getModuleDiscussions(moduleId: string): Promise<Discussion[]> {
  try {
    const { data, error } = await supabase
      .from('module_discussions')
      .select(`
        *,
        users:author_id(email)
      `)
      .eq('module_id', moduleId)
      .is('parent_id', null)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    const discussions = await Promise.all(
      (data || []).map(async (d) => {
        const replies = await getDiscussionReplies(d.id)
        return {
          id: d.id,
          moduleId: d.module_id,
          authorId: d.author_id,
          authorEmail: d.users?.email,
          title: d.title,
          content: d.content,
          isPinned: d.is_pinned,
          isLocked: d.is_locked,
          upvotes: d.upvotes,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
          replies
        }
      })
    )

    return discussions
  } catch (error) {
    console.error('Error fetching discussions:', error)
    return []
  }
}

async function getDiscussionReplies(parentId: string): Promise<Discussion[]> {
  const { data } = await supabase
    .from('module_discussions')
    .select(`*, users:author_id(email)`)
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true })

  return (data || []).map(d => ({
    id: d.id,
    moduleId: d.module_id,
    authorId: d.author_id,
    authorEmail: d.users?.email,
    parentId: d.parent_id,
    content: d.content,
    isPinned: false,
    isLocked: false,
    upvotes: d.upvotes,
    createdAt: d.created_at,
    updatedAt: d.updated_at
  }))
}

export async function createDiscussion(
  moduleId: string,
  authorId: string,
  content: string,
  title?: string,
  parentId?: string
): Promise<Discussion | null> {
  try {
    const { data, error } = await supabase
      .from('module_discussions')
      .insert({
        module_id: moduleId,
        author_id: authorId,
        content,
        title,
        parent_id: parentId
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      moduleId: data.module_id,
      authorId: data.author_id,
      parentId: data.parent_id,
      title: data.title,
      content: data.content,
      isPinned: data.is_pinned,
      isLocked: data.is_locked,
      upvotes: data.upvotes,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    }
  } catch (error) {
    console.error('Error creating discussion:', error)
    return null
  }
}

// ========================================
// Study Groups
// ========================================

export async function getCourseStudyGroups(courseId: string): Promise<StudyGroup[]> {
  try {
    const { data, error } = await supabase
      .from('study_groups')
      .select(`
        *,
        members:study_group_members(count)
      `)
      .eq('course_id', courseId)
      .eq('is_public', true)

    if (error) throw error

    return (data || []).map(g => ({
      id: g.id,
      courseId: g.course_id,
      name: g.name,
      description: g.description,
      createdBy: g.created_by,
      isPublic: g.is_public,
      maxMembers: g.max_members,
      memberCount: g.members[0]?.count || 0,
      createdAt: g.created_at
    }))
  } catch (error) {
    console.error('Error fetching study groups:', error)
    return []
  }
}

export async function createStudyGroup(
  courseId: string,
  name: string,
  description: string,
  createdBy: string,
  isPublic: boolean = true
): Promise<StudyGroup | null> {
  try {
    const { data, error } = await supabase
      .from('study_groups')
      .insert({
        course_id: courseId,
        name,
        description,
        created_by: createdBy,
        is_public: isPublic
      })
      .select()
      .single()

    if (error) throw error

    // Auto-join creator
    await joinStudyGroup(data.id, createdBy, 'owner')

    return {
      id: data.id,
      courseId: data.course_id,
      name: data.name,
      description: data.description,
      createdBy: data.created_by,
      isPublic: data.is_public,
      maxMembers: data.max_members,
      memberCount: 1,
      createdAt: data.created_at
    }
  } catch (error) {
    console.error('Error creating study group:', error)
    return null
  }
}

export async function joinStudyGroup(
  groupId: string,
  studentId: string,
  role: string = 'member'
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('study_group_members')
      .insert({
        group_id: groupId,
        student_id: studentId,
        role
      })

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error joining study group:', error)
    return false
  }
}

// ========================================
// Shared Notes
// ========================================

export async function getModuleNotes(moduleId: string, userId?: string): Promise<SharedNote[]> {
  try {
    let query = supabase
      .from('shared_notes')
      .select(`*, users:author_id(email)`)
      .eq('module_id', moduleId)

    if (!userId) {
      query = query.eq('is_public', true)
    }

    const { data, error } = await query.order('upvotes', { ascending: false })

    if (error) throw error

    return (data || []).map(n => ({
      id: n.id,
      moduleId: n.module_id,
      authorId: n.author_id,
      authorEmail: n.users?.email,
      title: n.title,
      content: n.content,
      isPublic: n.is_public,
      upvotes: n.upvotes,
      createdAt: n.created_at,
      updatedAt: n.updated_at
    }))
  } catch (error) {
    console.error('Error fetching notes:', error)
    return []
  }
}

export async function createSharedNote(
  moduleId: string,
  authorId: string,
  title: string,
  content: string,
  isPublic: boolean = false
): Promise<SharedNote | null> {
  try {
    const { data, error } = await supabase
      .from('shared_notes')
      .insert({
        module_id: moduleId,
        author_id: authorId,
        title,
        content,
        is_public: isPublic
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      moduleId: data.module_id,
      authorId: data.author_id,
      title: data.title,
      content: data.content,
      isPublic: data.is_public,
      upvotes: data.upvotes,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    }
  } catch (error) {
    console.error('Error creating note:', error)
    return null
  }
}
