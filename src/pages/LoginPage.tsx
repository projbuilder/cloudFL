import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/core/auth'
import { Network, Mail, Lock, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const { signIn, resetPassword } = useAuth()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [resetError, setResetError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: signInError } = await signIn(email, password)
    
    if (signInError) {
      setError(signInError.message || 'Invalid email or password')
      setLoading(false)
    } else {
      navigate('/dashboard')
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError('')
    setResetSuccess(false)
    setResetLoading(true)

    const { error } = await resetPassword(resetEmail)
    
    setResetLoading(false)
    
    if (error) {
      setResetError(error.message || 'Failed to send reset email')
    } else {
      setResetSuccess(true)
      setTimeout(() => {
        setShowResetModal(false)
        setResetSuccess(false)
        setResetEmail('')
      }, 3000)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-fl-primary to-fl-secondary rounded-lg flex items-center justify-center">
            <Network className="w-7 h-7 text-white" />
          </div>
          <span className="text-2xl font-bold text-fl-gradient">FL Academy</span>
        </div>

        <div className="glass-card p-8 rounded-2xl">
          <h1 className="text-2xl font-bold text-center mb-2">Welcome Back</h1>
          <p className="text-muted-foreground text-center mb-6">
            Sign in to continue your learning journey
          </p>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-fl-primary"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium">Password</label>
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="text-xs text-fl-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-fl-primary"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-fl-primary to-fl-secondary text-white rounded-lg font-medium hover:shadow-glow transition-all disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/signup" className="text-fl-primary hover:underline font-medium">
              Sign up
            </Link>
          </div>

          <div className="mt-4 text-center text-sm">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md border border-border">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-2">Reset Password</h2>
              <p className="text-muted-foreground mb-6">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              {resetSuccess ? (
                <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-500">
                  ✅ Password reset link sent! Check your email.
                </div>
              ) : (
                <>
                  {resetError && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                      {resetError}
                    </div>
                  )}

                  <form onSubmit={handleResetPassword}>
                    <div className="space-y-2 mb-6">
                      <label htmlFor="reset-email" className="text-sm font-medium">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <input
                          id="reset-email"
                          type="email"
                          placeholder="your@email.com"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-fl-primary"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowResetModal(false)
                          setResetError('')
                          setResetEmail('')
                        }}
                        className="flex-1 px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={resetLoading}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-fl-primary to-fl-secondary text-white rounded-lg hover:shadow-glow transition-all disabled:opacity-50"
                      >
                        {resetLoading ? 'Sending...' : 'Send Reset Link'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
