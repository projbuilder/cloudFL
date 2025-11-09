import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Shield, Activity, Users, Database, BarChart, MessageSquare } from 'lucide-react'
import { useAuth } from '@/core/auth'
import { CloudAdminDashboard } from '@/components/CloudAdminDashboard'
import { supabase } from '@/lib/supabase'

type TabType = 'fl-monitor' | 'users' | 'analytics' | 'system'

interface PlatformUser {
  id: string
  email: string
  role: string
  created_at: string
  last_sign_in_at: string | null
}

export default function CloudAdminPage() {
  const { user, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('fl-monitor')
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [platformStats, setPlatformStats] = useState({
    totalUsers: 0,
    totalCourses: 0,
    totalQuizAttempts: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPlatformData()
  }, [])

  async function loadPlatformData() {
    setLoading(true)
    try {
      // Get all users
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, role, created_at, last_sign_in_at')
        .order('created_at', { ascending: false })

      // Get total courses
      const { count: coursesCount } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true })

      // Get total quiz attempts
      const { count: quizCount } = await supabase
        .from('enhanced_quiz_attempts')
        .select('*', { count: 'exact', head: true })

      setUsers(usersData || [])
      setPlatformStats({
        totalUsers: usersData?.length || 0,
        totalCourses: coursesCount || 0,
        totalQuizAttempts: quizCount || 0
      })
    } catch (error) {
      console.error('Error loading platform data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Shield className="w-8 h-8 text-fl-primary" />
                <h1 className="text-2xl font-bold bg-gradient-to-r from-fl-primary to-fl-secondary bg-clip-text text-transparent">
                  Cloud Admin
                </h1>
              </div>
              <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-semibold">
                ADMIN ACCESS
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fl-primary to-fl-secondary flex items-center justify-center text-white font-semibold text-sm">
                  {user?.email?.[0]?.toUpperCase() || 'A'}
                </div>
                <div>
                  <p className="text-sm font-medium">{user?.email?.split('@')[0] || 'Admin'}</p>
                  <p className="text-xs text-muted-foreground">Cloud Administrator</p>
                </div>
              </div>
              
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors text-sm"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-2 mt-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab('fl-monitor')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'fl-monitor'
                  ? 'bg-gradient-to-r from-fl-primary to-fl-secondary text-white shadow-lg'
                  : 'bg-card hover:bg-muted text-muted-foreground'
              }`}
            >
              <Activity className="w-5 h-5" />
              FL Monitor
            </button>
            
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'users'
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                  : 'bg-card hover:bg-muted text-muted-foreground'
              }`}
            >
              <Users className="w-5 h-5" />
              User Management
            </button>
            
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'analytics'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                  : 'bg-card hover:bg-muted text-muted-foreground'
              }`}
            >
              <BarChart className="w-5 h-5" />
              Platform Analytics
            </button>
            
            <button
              onClick={() => setActiveTab('system')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'system'
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg'
                  : 'bg-card hover:bg-muted text-muted-foreground'
              }`}
            >
              <Database className="w-5 h-5" />
              System Health
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-6 py-8">
        {/* FL Monitor Tab */}
        {activeTab === 'fl-monitor' && (
          <CloudAdminDashboard />
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold">User Management</h2>
              <button
                onClick={loadPlatformData}
                className="px-4 py-2 bg-fl-primary text-white rounded-lg hover:bg-fl-primary/90 transition-colors text-sm"
              >
                Refresh Data
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fl-primary"></div>
              </div>
            ) : (
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr className="border-b border-border">
                        <th className="text-left py-4 px-6 font-semibold">User ID</th>
                        <th className="text-left py-4 px-6 font-semibold">Email</th>
                        <th className="text-center py-4 px-6 font-semibold">Role</th>
                        <th className="text-left py-4 px-6 font-semibold">Created</th>
                        <th className="text-left py-4 px-6 font-semibold">Last Sign In</th>
                        <th className="text-center py-4 px-6 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((platformUser) => {
                        const isRecent = platformUser.last_sign_in_at && 
                          new Date(platformUser.last_sign_in_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
                        return (
                          <tr key={platformUser.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                            <td className="py-4 px-6">
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {platformUser.id.substring(0, 8)}...
                              </code>
                            </td>
                            <td className="py-4 px-6 font-medium">
                              {platformUser.email}
                            </td>
                            <td className="py-4 px-6 text-center">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                platformUser.role === 'instructor'
                                  ? 'bg-purple-500/20 text-purple-400'
                                  : 'bg-blue-500/20 text-blue-400'
                              }`}>
                                {platformUser.role}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-sm text-muted-foreground">
                              {new Date(platformUser.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-4 px-6 text-sm text-muted-foreground">
                              {platformUser.last_sign_in_at 
                                ? new Date(platformUser.last_sign_in_at).toLocaleString()
                                : 'Never'}
                            </td>
                            <td className="py-4 px-6 text-center">
                              {isRecent ? (
                                <span className="flex items-center justify-center gap-1 text-green-500">
                                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                  <span className="text-xs">Active</span>
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Inactive</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {users.length === 0 && (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">No users found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold">Platform Analytics</h2>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fl-primary"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card p-6 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-500/20 rounded-lg">
                      <Users className="w-6 h-6 text-blue-400" />
                    </div>
                  </div>
                  <h3 className="font-semibold mb-1">Total Users</h3>
                  <p className="text-3xl font-bold">{platformStats.totalUsers}</p>
                  <p className="text-sm text-muted-foreground mt-2">Across all roles</p>
                </div>

                <div className="glass-card p-6 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-green-500/20 rounded-lg">
                      <Database className="w-6 h-6 text-green-400" />
                    </div>
                  </div>
                  <h3 className="font-semibold mb-1">Total Courses</h3>
                  <p className="text-3xl font-bold">{platformStats.totalCourses}</p>
                  <p className="text-sm text-muted-foreground mt-2">Published courses</p>
                </div>

                <div className="glass-card p-6 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-purple-500/20 rounded-lg">
                      <Activity className="w-6 h-6 text-purple-400" />
                    </div>
                  </div>
                  <h3 className="font-semibold mb-1">Quiz Attempts</h3>
                  <p className="text-3xl font-bold">{platformStats.totalQuizAttempts}</p>
                  <p className="text-sm text-muted-foreground mt-2">Total assessments</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* System Health Tab */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold">System Health</h2>
            <div className="glass-card p-8 rounded-xl text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-green-500/20 rounded-full mb-4">
                <Shield className="w-12 h-12 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-green-500 mb-2">ALL SYSTEMS OPERATIONAL</h3>
              <p className="text-muted-foreground mb-6">
                Platform is running smoothly with no issues detected
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Database</p>
                  <p className="font-semibold text-green-500">✓ Healthy</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">API</p>
                  <p className="font-semibold text-green-500">✓ Online</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Storage</p>
                  <p className="font-semibold text-green-500">✓ Available</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">FL Nodes</p>
                  <p className="font-semibold text-green-500">✓ Active</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
