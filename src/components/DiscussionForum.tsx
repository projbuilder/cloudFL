import React, { useState, useEffect } from 'react'
import { MessageSquare, Send, ThumbsUp, Reply, Pin, Lock } from 'lucide-react'
import { getModuleDiscussions, createDiscussion, Discussion } from '@/services/collaborationService'
import { supabase } from '@/lib/supabase'

interface DiscussionForumProps {
  moduleId: string
}

export function DiscussionForum({ moduleId }: DiscussionForumProps) {
  const [discussions, setDiscussions] = useState<Discussion[]>([])
  const [newPost, setNewPost] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDiscussions()
  }, [moduleId])

  async function loadDiscussions() {
    setLoading(true)
    const data = await getModuleDiscussions(moduleId)
    setDiscussions(data)
    setLoading(false)
  }

  async function handleSubmit() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !newPost.trim()) return

    await createDiscussion(
      moduleId,
      user.id,
      newPost,
      replyTo ? undefined : newTitle,
      replyTo || undefined
    )

    setNewPost('')
    setNewTitle('')
    setReplyTo(null)
    loadDiscussions()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fl-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* New Post */}
      <div className="glass-card p-4 rounded-xl">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-fl-primary" />
          {replyTo ? 'Reply to Discussion' : 'Start a Discussion'}
        </h3>
        
        {!replyTo && (
          <input
            type="text"
            placeholder="Discussion title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full px-4 py-2 bg-background border border-border rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-fl-primary"
          />
        )}
        
        <textarea
          placeholder="Share your thoughts..."
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-fl-primary"
        />
        
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleSubmit}
            disabled={!newPost.trim()}
            className="px-4 py-2 bg-gradient-to-r from-fl-primary to-fl-secondary text-white rounded-lg hover:shadow-glow transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Post
          </button>
          
          {replyTo && (
            <button
              onClick={() => setReplyTo(null)}
              className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80"
            >
              Cancel Reply
            </button>
          )}
        </div>
      </div>

      {/* Discussions */}
      <div className="space-y-3">
        {discussions.map((discussion) => (
          <div key={discussion.id} className="glass-card p-4 rounded-xl">
            {/* Main Post */}
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fl-primary to-fl-secondary flex items-center justify-center text-white font-semibold">
                  {discussion.authorEmail?.[0]?.toUpperCase() || 'U'}
                </div>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{discussion.authorEmail?.split('@')[0] || 'User'}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(discussion.createdAt).toLocaleDateString()}
                  </span>
                  {discussion.isPinned && (
                    <Pin className="w-4 h-4 text-yellow-500" />
                  )}
                  {discussion.isLocked && (
                    <Lock className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                
                {discussion.title && (
                  <h4 className="font-semibold mb-2">{discussion.title}</h4>
                )}
                
                <p className="text-sm mb-3">{discussion.content}</p>
                
                <div className="flex items-center gap-4 text-sm">
                  <button className="flex items-center gap-1 text-muted-foreground hover:text-fl-primary transition-colors">
                    <ThumbsUp className="w-4 h-4" />
                    <span>{discussion.upvotes}</span>
                  </button>
                  
                  {!discussion.isLocked && (
                    <button
                      onClick={() => setReplyTo(discussion.id)}
                      className="flex items-center gap-1 text-muted-foreground hover:text-fl-primary transition-colors"
                    >
                      <Reply className="w-4 h-4" />
                      Reply
                    </button>
                  )}
                  
                  {discussion.replies && discussion.replies.length > 0 && (
                    <span className="text-muted-foreground">
                      {discussion.replies.length} {discussion.replies.length === 1 ? 'reply' : 'replies'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Replies */}
            {discussion.replies && discussion.replies.length > 0 && (
              <div className="ml-12 mt-4 space-y-3 border-l-2 border-border pl-4">
                {discussion.replies.map((reply) => (
                  <div key={reply.id} className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-semibold">
                        {reply.authorEmail?.[0]?.toUpperCase() || 'U'}
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold">{reply.authorEmail?.split('@')[0] || 'User'}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(reply.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm">{reply.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {discussions.length === 0 && (
          <div className="glass-card p-8 rounded-xl text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">No discussions yet. Start the conversation!</p>
          </div>
        )}
      </div>
    </div>
  )
}
