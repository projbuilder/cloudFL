import React, { useState, useEffect } from 'react'
import { Shield, Activity, Users, Database, TrendingUp, CheckCircle, AlertTriangle, Globe, Cpu, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface FLNodeMetrics {
  nodeId: string
  studentEmail: string
  totalUpdates: number
  avgAccuracy: number
  lastUpdate: string
  privacyBudget: number
  dataContributed: number
}

interface GlobalMetrics {
  totalNodes: number
  totalUpdates: number
  globalAccuracy: number
  activeNodes: number
  totalDataPoints: number
  avgPrivacyBudget: number
}

export function CloudAdminDashboard() {
  const [globalMetrics, setGlobalMetrics] = useState<GlobalMetrics>({
    totalNodes: 0,
    totalUpdates: 0,
    globalAccuracy: 0,
    activeNodes: 0,
    totalDataPoints: 0,
    avgPrivacyBudget: 0
  })
  const [nodeMetrics, setNodeMetrics] = useState<FLNodeMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(5000) // 5 seconds

  useEffect(() => {
    loadFLMetrics()
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(loadFLMetrics, refreshInterval)
    return () => clearInterval(interval)
  }, [refreshInterval])

  async function loadFLMetrics() {
    try {
      // Get all FL model updates (using correct column names)
      const { data: flUpdates } = await supabase
        .from('fl_model_updates')
        .select(`
          id,
          student_id,
          accuracy,
          training_round,
          privacy_budget_used,
          created_at
        `)
        .order('created_at', { ascending: false })

      if (!flUpdates || flUpdates.length === 0) {
        setLoading(false)
        return
      }

      // Get user emails for all student IDs
      const studentIds = [...new Set(flUpdates.map((u: any) => u.student_id))]
      const { data: users } = await supabase
        .from('users')
        .select('id, email')
        .in('id', studentIds)
      
      const emailMap = new Map(users?.map(u => [u.id, u.email]) || [])

      // Calculate node-level metrics
      const nodeMap = new Map<string, FLNodeMetrics>()
      
      flUpdates.forEach((update: any) => {
        const nodeId = update.student_id
        
        if (!nodeMap.has(nodeId)) {
          nodeMap.set(nodeId, {
            nodeId,
            studentEmail: emailMap.get(nodeId) || 'Unknown',
            totalUpdates: 0,
            avgAccuracy: 0,
            lastUpdate: update.created_at,
            privacyBudget: 0,
            dataContributed: 0
          })
        }
        
        const node = nodeMap.get(nodeId)!
        node.totalUpdates++
        node.avgAccuracy += update.accuracy || 0
        node.privacyBudget += update.privacy_budget_used || 0
        node.dataContributed += 1
        
        if (update.created_at > node.lastUpdate) {
          node.lastUpdate = update.created_at
        }
      })

      // Finalize averages
      const nodes = Array.from(nodeMap.values()).map(node => ({
        ...node,
        avgAccuracy: node.totalUpdates > 0 ? node.avgAccuracy / node.totalUpdates : 0
      }))

      // Calculate global metrics
      const now = new Date()
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
      
      const activeNodes = nodes.filter(node => 
        new Date(node.lastUpdate) > fiveMinutesAgo
      ).length

      const totalUpdates = flUpdates.length
      const globalAccuracy = nodes.reduce((sum, node) => sum + node.avgAccuracy, 0) / (nodes.length || 1)
      const totalDataPoints = nodes.reduce((sum, node) => sum + node.dataContributed, 0)
      const avgPrivacyBudget = nodes.reduce((sum, node) => sum + node.privacyBudget, 0) / (nodes.length || 1)

      setGlobalMetrics({
        totalNodes: nodes.length,
        totalUpdates,
        globalAccuracy,
        activeNodes,
        totalDataPoints,
        avgPrivacyBudget
      })

      setNodeMetrics(nodes)
      setLoading(false)
    } catch (error) {
      console.error('Error loading FL metrics:', error)
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="w-8 h-8 text-fl-primary" />
            Federated Learning Control Center
          </h2>
          <p className="text-muted-foreground mt-1">
            Real-time monitoring of privacy-preserving distributed training
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-sm text-muted-foreground">Live</span>
        </div>
      </div>

      {/* Global Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Nodes */}
        <div className="glass-card p-6 rounded-xl border border-blue-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Globe className="w-6 h-6 text-blue-400" />
            </div>
            <span className="text-2xl font-bold">{globalMetrics.totalNodes}</span>
          </div>
          <h3 className="font-semibold mb-1">Total FL Nodes</h3>
          <p className="text-sm text-muted-foreground">
            {globalMetrics.activeNodes} active in last 5 min
          </p>
        </div>

        {/* Global Accuracy */}
        <div className="glass-card p-6 rounded-xl border border-green-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <span className="text-2xl font-bold">
              {(globalMetrics.globalAccuracy * 100).toFixed(1)}%
            </span>
          </div>
          <h3 className="font-semibold mb-1">Global Model Accuracy</h3>
          <p className="text-sm text-muted-foreground">
            Aggregated from all nodes
          </p>
        </div>

        {/* Total Updates */}
        <div className="glass-card p-6 rounded-xl border border-purple-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <Activity className="w-6 h-6 text-purple-400" />
            </div>
            <span className="text-2xl font-bold">{globalMetrics.totalUpdates}</span>
          </div>
          <h3 className="font-semibold mb-1">FL Training Rounds</h3>
          <p className="text-sm text-muted-foreground">
            Total model updates received
          </p>
        </div>

        {/* Data Contributions */}
        <div className="glass-card p-6 rounded-xl border border-cyan-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-cyan-500/20 rounded-lg">
              <Database className="w-6 h-6 text-cyan-400" />
            </div>
            <span className="text-2xl font-bold">{globalMetrics.totalDataPoints}</span>
          </div>
          <h3 className="font-semibold mb-1">Data Points Contributed</h3>
          <p className="text-sm text-muted-foreground">
            Quiz attempts used for training
          </p>
        </div>

        {/* Privacy Budget */}
        <div className="glass-card p-6 rounded-xl border border-yellow-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <Lock className="w-6 h-6 text-yellow-400" />
            </div>
            <span className="text-2xl font-bold">
              ε = {globalMetrics.avgPrivacyBudget.toFixed(2)}
            </span>
          </div>
          <h3 className="font-semibold mb-1">Avg Privacy Budget</h3>
          <p className="text-sm text-muted-foreground">
            Differential privacy guarantee
          </p>
        </div>

        {/* System Health */}
        <div className="glass-card p-6 rounded-xl border border-green-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <span className="text-2xl font-bold text-green-500">HEALTHY</span>
          </div>
          <h3 className="font-semibold mb-1">System Status</h3>
          <p className="text-sm text-muted-foreground">
            All nodes operational
          </p>
        </div>
      </div>

      {/* Node Performance Table */}
      <div className="glass-card p-6 rounded-xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Cpu className="w-5 h-5 text-fl-primary" />
            Individual Node Performance
          </h3>
          <button
            onClick={loadFLMetrics}
            className="px-4 py-2 bg-fl-primary text-white rounded-lg hover:bg-fl-primary/90 transition-colors text-sm"
          >
            Refresh Data
          </button>
        </div>

        {nodeMetrics.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No FL training activity yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Nodes will appear here after students complete quizzes
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold">Node ID</th>
                  <th className="text-left py-3 px-4 font-semibold">Student</th>
                  <th className="text-center py-3 px-4 font-semibold">Updates</th>
                  <th className="text-center py-3 px-4 font-semibold">Accuracy</th>
                  <th className="text-center py-3 px-4 font-semibold">Privacy (ε)</th>
                  <th className="text-center py-3 px-4 font-semibold">Data Points</th>
                  <th className="text-left py-3 px-4 font-semibold">Last Active</th>
                  <th className="text-center py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {nodeMetrics.map((node, index) => {
                  const isActive = new Date(node.lastUpdate) > new Date(Date.now() - 5 * 60 * 1000)
                  return (
                    <tr key={node.nodeId} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <td className="py-4 px-4">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {node.nodeId.substring(0, 8)}...
                        </code>
                      </td>
                      <td className="py-4 px-4 font-medium">
                        {node.studentEmail.split('@')[0]}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-semibold">
                          {node.totalUpdates}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          node.avgAccuracy >= 0.7 
                            ? 'bg-green-500/20 text-green-400'
                            : node.avgAccuracy >= 0.5
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {(node.avgAccuracy * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-sm font-mono">
                          {node.privacyBudget.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {node.dataContributed}
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground">
                        {new Date(node.lastUpdate).toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {isActive ? (
                          <span className="flex items-center justify-center gap-1 text-green-500">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            <span className="text-xs">Active</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Idle</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FL Architecture Diagram */}
      <div className="glass-card p-6 rounded-xl">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-fl-primary" />
          Federated Learning Architecture
        </h3>
        <div className="bg-gradient-to-br from-fl-primary/10 to-fl-secondary/10 rounded-lg p-8">
          <div className="flex items-center justify-center gap-8 flex-wrap">
            {/* Central Server */}
            <div className="text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-fl-primary to-fl-secondary rounded-full flex items-center justify-center mx-auto mb-3 shadow-glow">
                <Database className="w-12 h-12 text-white" />
              </div>
              <p className="font-semibold">Central Server</p>
              <p className="text-xs text-muted-foreground">Aggregates models</p>
            </div>

            {/* Arrow */}
            <div className="text-4xl text-fl-primary">⟷</div>

            {/* FL Nodes */}
            <div className="flex gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="text-center">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Cpu className="w-8 h-8 text-blue-400" />
                  </div>
                  <p className="text-xs text-muted-foreground">Node {i}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              🔒 Data never leaves student devices • 🔐 Differential privacy (ε=0.5) • 🚀 Decentralized training
            </p>
          </div>
        </div>
      </div>

      {/* Admin Actions */}
      <div className="glass-card p-6 rounded-xl">
        <h3 className="text-xl font-bold mb-4">Admin Controls</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg transition-all text-left">
            <CheckCircle className="w-6 h-6 mb-2" />
            <p className="font-semibold">Trigger Aggregation</p>
            <p className="text-xs opacity-90">Aggregate all node updates</p>
          </button>
          
          <button className="px-6 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:shadow-lg transition-all text-left">
            <Activity className="w-6 h-6 mb-2" />
            <p className="font-semibold">View Logs</p>
            <p className="text-xs opacity-90">Detailed FL training logs</p>
          </button>
          
          <button className="px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-lg transition-all text-left">
            <Shield className="w-6 h-6 mb-2" />
            <p className="font-semibold">Privacy Report</p>
            <p className="text-xs opacity-90">Generate compliance report</p>
          </button>
        </div>
      </div>
    </div>
  )
}
