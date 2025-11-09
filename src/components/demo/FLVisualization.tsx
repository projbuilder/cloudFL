import { useState, useEffect } from 'react'
import { Smartphone, Server, Shield, Activity, Database, Lock, Zap, TrendingUp } from 'lucide-react'

interface DeviceNode {
  id: number
  name: string
  status: 'training' | 'aggregating' | 'idle' | 'syncing'
  localAccuracy: number
  dataPoints: number
  contribution: number
}

export function FLVisualization() {
  const [globalAccuracy, setGlobalAccuracy] = useState(72.5)
  const [round, setRound] = useState(1)
  const [activeNodes, setActiveNodes] = useState(3)
  const [privacyScore, setPrivacyScore] = useState(100)

  const [devices, setDevices] = useState<DeviceNode[]>([
    { id: 1, name: 'Device Alpha', status: 'training', localAccuracy: 75.2, dataPoints: 1250, contribution: 92 },
    { id: 2, name: 'Device Beta', status: 'aggregating', localAccuracy: 71.8, dataPoints: 980, contribution: 87 },
    { id: 3, name: 'Device Gamma', status: 'training', localAccuracy: 78.5, dataPoints: 1450, contribution: 95 },
    { id: 4, name: 'Device Delta', status: 'idle', localAccuracy: 68.3, dataPoints: 750, contribution: 78 }
  ])

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate FL training rounds
      setDevices((prevDevices) =>
        prevDevices.map((device) => {
          const statuses: DeviceNode['status'][] = ['training', 'aggregating', 'syncing', 'idle']
          const newStatus = statuses[Math.floor(Math.random() * statuses.length)]

          return {
            ...device,
            status: newStatus,
            localAccuracy: Math.min(device.localAccuracy + Math.random() * 0.5, 99),
            contribution: Math.min(device.contribution + Math.random() * 2, 100)
          }
        })
      )

      // Update global metrics
      setGlobalAccuracy((prev) => Math.min(prev + Math.random() * 0.3, 96.5))
      setRound((prev) => prev + 1)
      setActiveNodes(Math.floor(Math.random() * 2) + 3) // 3-4 active nodes
      setPrivacyScore(100) // Always 100% in FL!
    }, 3000) // Update every 3 seconds

    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: DeviceNode['status']) => {
    switch (status) {
      case 'training':
        return 'text-fl-primary'
      case 'aggregating':
        return 'text-fl-secondary'
      case 'syncing':
        return 'text-fl-accent'
      case 'idle':
        return 'text-muted-foreground'
    }
  }

  const getStatusIcon = (status: DeviceNode['status']) => {
    switch (status) {
      case 'training':
        return <Activity className="w-4 h-4 animate-pulse" />
      case 'aggregating':
        return <Server className="w-4 h-4" />
      case 'syncing':
        return <Zap className="w-4 h-4 animate-bounce" />
      case 'idle':
        return <Database className="w-4 h-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-fl-primary" />
            <span className="text-sm text-muted-foreground">Global Accuracy</span>
          </div>
          <div className="text-3xl font-bold text-fl-primary">{globalAccuracy.toFixed(2)}%</div>
        </div>

        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 text-fl-secondary" />
            <span className="text-sm text-muted-foreground">Training Round</span>
          </div>
          <div className="text-3xl font-bold text-fl-secondary">{round}</div>
        </div>

        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <Smartphone className="w-5 h-5 text-fl-accent" />
            <span className="text-sm text-muted-foreground">Active Nodes</span>
          </div>
          <div className="text-3xl font-bold text-fl-accent">{activeNodes}</div>
        </div>

        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-5 h-5 text-green-500" />
            <span className="text-sm text-muted-foreground">Privacy</span>
          </div>
          <div className="text-3xl font-bold text-green-500">{privacyScore}%</div>
        </div>
      </div>

      {/* FL Architecture Diagram */}
      <div className="glass-card p-8 rounded-2xl">
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <Server className="w-7 h-7 text-fl-primary" />
          Federated Learning Simulation
        </h3>

        {/* Central Server */}
        <div className="mb-8">
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-32 h-32 bg-gradient-to-br from-fl-primary to-fl-secondary rounded-2xl flex flex-col items-center justify-center shadow-glow">
                <Server className="w-12 h-12 text-white mb-2" />
                <span className="text-white text-sm font-bold">Central Server</span>
                <span className="text-white/80 text-xs">Aggregating...</span>
              </div>

              {/* Pulse Animation */}
              <div className="absolute inset-0 bg-fl-primary rounded-2xl animate-ping opacity-20" />
            </div>
          </div>
        </div>

        {/* Connection Lines (visual) */}
        <div className="flex justify-center mb-6">
          <div className="flex gap-12">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-px h-12 bg-gradient-to-b from-fl-primary to-transparent" />
            ))}
          </div>
        </div>

        {/* Client Devices */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {devices.map((device) => (
            <div key={device.id} className="glass-card p-4 rounded-xl border-2 border-border hover:border-fl-primary transition-all">
              <div className="flex items-center gap-2 mb-3">
                <Smartphone className={`w-5 h-5 ${getStatusColor(device.status)}`} />
                <div className="flex-1">
                  <div className="font-bold text-sm">{device.name}</div>
                  <div className={`text-xs flex items-center gap-1 ${getStatusColor(device.status)}`}>
                    {getStatusIcon(device.status)}
                    {device.status}
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Local Acc:</span>
                  <span className="font-bold">{device.localAccuracy.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data:</span>
                  <span className="font-bold">{device.dataPoints}</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-fl-primary to-fl-secondary"
                    style={{ width: `${device.contribution}%` }}
                  />
                </div>
                <div className="text-center text-muted-foreground">
                  Contribution: {device.contribution.toFixed(0)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy Guarantees */}
      <div className="glass-card p-6 rounded-xl bg-green-500/5 border border-green-500/20">
        <h4 className="font-bold mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5 text-green-500" />
          Privacy Preservation in Action:
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Database className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <p className="font-semibold text-green-500 mb-1">Local Training</p>
              <p className="text-muted-foreground text-xs">Data never leaves devices. Training happens locally on private data.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <p className="font-semibold text-green-500 mb-1">Secure Aggregation</p>
              <p className="text-muted-foreground text-xs">Only model updates (gradients) are shared. Server sees aggregated results only.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Lock className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <p className="font-semibold text-green-500 mb-1">Differential Privacy</p>
              <p className="text-muted-foreground text-xs">Noise added to updates prevents reverse engineering of individual data.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="text-center p-4 bg-muted/50 rounded-xl">
        <p className="text-sm text-muted-foreground">
          ⚡ This is a <strong>real-time simulation</strong> of Federated Learning. In production, this would use TensorFlow.js for actual client-side training.
        </p>
      </div>
    </div>
  )
}
