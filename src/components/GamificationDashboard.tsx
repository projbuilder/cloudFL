import { useState, useEffect } from 'react'
import {
  Trophy, Star, Flame, Award, Target, TrendingUp, 
  Users, Zap, Crown, Medal, Lock
} from 'lucide-react'
import {
  getStudentXP,
  getAllAchievements,
  getStudentAchievements,
  getCourseLeaderboard,
  getRarityColor,
  getRarityBg,
  type StudentXP,
  type Achievement,
  type StudentAchievement,
  type LeaderboardEntry
} from '@/services/gamificationService'

interface GamificationDashboardProps {
  studentId: string
  courseId: string
}

export function GamificationDashboard({ studentId, courseId }: GamificationDashboardProps) {
  const [xpData, setXpData] = useState<StudentXP | null>(null)
  const [allAchievements, setAllAchievements] = useState<Achievement[]>([])
  const [earnedAchievements, setEarnedAchievements] = useState<StudentAchievement[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'achievements' | 'leaderboard'>('achievements')

  useEffect(() => {
    loadGamificationData()
  }, [studentId, courseId])

  async function loadGamificationData() {
    setLoading(true)
    try {
      const [xp, achievements, earned, board] = await Promise.all([
        getStudentXP(studentId, courseId),
        getAllAchievements(),
        getStudentAchievements(studentId, courseId),
        getCourseLeaderboard(courseId, 10)
      ])

      setXpData(xp)
      setAllAchievements(achievements)
      setEarnedAchievements(earned)
      setLeaderboard(board)
    } catch (error) {
      console.error('Error loading gamification data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fl-primary"></div>
      </div>
    )
  }

  const earnedIds = new Set(earnedAchievements.map(e => e.achievementId))
  const xpProgress = xpData ? ((xpData.totalXp % ((xpData.level * xpData.level) * 100)) / ((xpData.level * xpData.level) * 100)) * 100 : 0

  return (
    <div className="space-y-6">
      {/* XP and Level Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Level Card */}
        <div className="glass-card p-6 rounded-xl bg-gradient-to-br from-fl-primary/10 to-fl-secondary/10 border-2 border-fl-primary/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-fl-primary/20 rounded-xl">
                <Star className="w-8 h-8 text-fl-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Your Level</p>
                <p className="text-3xl font-bold">{xpData?.level || 1}</p>
              </div>
            </div>
            <Trophy className="w-12 h-12 text-fl-primary/30" />
          </div>
          
          {/* XP Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">XP Progress</span>
              <span className="font-semibold">{xpData?.totalXp || 0} XP</span>
            </div>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-fl-primary to-fl-secondary transition-all duration-500"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {xpData?.xpToNextLevel || 100} XP to level {(xpData?.level || 1) + 1}
            </p>
          </div>
        </div>

        {/* Streak Card */}
        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-orange-500/20 rounded-xl">
              <Flame className="w-8 h-8 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Streak</p>
              <p className="text-3xl font-bold">{xpData?.currentStreakDays || 0} Days</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Longest Streak</span>
            <span className="font-semibold flex items-center gap-1">
              <Zap className="w-4 h-4 text-yellow-500" />
              {xpData?.longestStreakDays || 0} Days
            </span>
          </div>
        </div>

        {/* Achievements Card */}
        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-yellow-500/20 rounded-xl">
              <Award className="w-8 h-8 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Achievements</p>
              <p className="text-3xl font-bold">{earnedAchievements.length}</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Available</span>
            <span className="font-semibold">{allAchievements.length}</span>
          </div>
          <div className="mt-2 w-full h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-yellow-500"
              style={{ width: `${(earnedAchievements.length / allAchievements.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('achievements')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            activeTab === 'achievements'
              ? 'border-fl-primary text-fl-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Achievements
          </div>
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            activeTab === 'leaderboard'
              ? 'border-fl-primary text-fl-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Leaderboard
          </div>
        </button>
      </div>

      {/* Achievements Tab */}
      {activeTab === 'achievements' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allAchievements.map(achievement => {
              const earned = earnedIds.has(achievement.id)
              const earnedData = earnedAchievements.find(e => e.achievementId === achievement.id)
              
              return (
                <div
                  key={achievement.id}
                  className={`glass-card p-6 rounded-xl transition-all ${
                    earned
                      ? `${getRarityBg(achievement.rarity)} border-2 ${getRarityColor(achievement.rarity).replace('text-', 'border-')}`
                      : 'opacity-50 grayscale'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-4xl">{achievement.icon}</div>
                    {earned ? (
                      <Medal className={`w-6 h-6 ${getRarityColor(achievement.rarity)}`} />
                    ) : (
                      <Lock className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  
                  <h3 className="font-bold mb-1">{achievement.name}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{achievement.description}</p>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className={`px-2 py-1 rounded ${getRarityBg(achievement.rarity)} ${getRarityColor(achievement.rarity)} font-medium`}>
                      {achievement.rarity.toUpperCase()}
                    </span>
                    <span className="text-muted-foreground">+{achievement.xpReward} XP</span>
                  </div>
                  
                  {earned && earnedData && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Earned {new Date(earnedData.earnedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Crown className="w-6 h-6 text-yellow-500" />
            Course Leaderboard
          </h3>
          
          <div className="space-y-3">
            {leaderboard.map((entry, index) => {
              const isCurrentUser = entry.studentId === studentId
              const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null
              
              return (
                <div
                  key={entry.studentId}
                  className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
                    isCurrentUser
                      ? 'bg-fl-primary/10 border-2 border-fl-primary/30'
                      : 'bg-muted/30 hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted font-bold">
                    {medal || `#${entry.rank}`}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">
                        {isCurrentUser ? 'You' : entry.email.split('@')[0]}
                      </p>
                      {isCurrentUser && (
                        <Target className="w-4 h-4 text-fl-primary" />
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        Level {entry.level}
                      </span>
                      {entry.currentStreakDays > 0 && (
                        <span className="flex items-center gap-1">
                          <Flame className="w-3 h-3 text-orange-500" />
                          {entry.currentStreakDays}d streak
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        {entry.badgeCount} badges
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-xl font-bold text-fl-primary">{entry.totalXp}</p>
                    <p className="text-xs text-muted-foreground">XP</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
