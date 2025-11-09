import { useState } from 'react'
import { CheckCircle2, XCircle, AlertCircle, Database, HardDrive, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function SetupCheck() {
  const [checking, setChecking] = useState(false)
  const [results, setResults] = useState<any>(null)

  const checkSetup = async () => {
    setChecking(true)
    const checks = {
      geminiKey: false,
      supabaseConnection: false,
      coursesTable: false,
      modulesTable: false,
      storage: false,
      demoCourse: false
    }

    try {
      // 1. Check Gemini API Key
      checks.geminiKey = !!import.meta.env.VITE_GEMINI_API_KEY

      // 2. Check Supabase connection
      const { error: connError } = await supabase.from('courses').select('count').limit(1)
      checks.supabaseConnection = !connError

      // 3. Check courses table
      const { data: courses, error: coursesError } = await supabase.from('courses').select('id').limit(1)
      checks.coursesTable = !coursesError

      // 4. Check course_modules table
      const { data: modules, error: modulesError } = await supabase.from('course_modules').select('id').limit(1)
      checks.modulesTable = !modulesError

      // 5. Check storage bucket
      const { data: storageFiles, error: storageError } = await supabase.storage.from('course-materials').list('', {
        limit: 1
      })
      checks.storage = !storageError

      // 6. Check if demo course exists
      const { data: demoCourse } = await supabase
        .from('courses')
        .select('id')
        .eq('id', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
        .single()
      checks.demoCourse = !!demoCourse
    } catch (error) {
      console.error('Setup check error:', error)
    }

    setResults(checks)
    setChecking(false)
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Database className="w-10 h-10 text-fl-primary" />
            Setup Verification
          </h1>
          <p className="text-muted-foreground">Check if your Supabase and Gemini setup is complete</p>
        </div>

        <div className="glass-card p-8 rounded-2xl mb-6">
          <button
            onClick={checkSetup}
            disabled={checking}
            className="w-full px-6 py-4 bg-gradient-to-r from-fl-primary to-fl-secondary text-white rounded-xl font-medium hover:shadow-glow transition-all disabled:opacity-50"
          >
            {checking ? 'Checking...' : 'Run Setup Check'}
          </button>
        </div>

        {results && (
          <div className="space-y-4">
            <SetupItem
              label="Gemini API Key"
              status={results.geminiKey}
              description="Required for AI features"
              fix="Check your .env file has VITE_GEMINI_API_KEY"
            />
            <SetupItem
              label="Supabase Connection"
              status={results.supabaseConnection}
              description="Database connectivity"
              fix="Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env"
            />
            <SetupItem
              label="Courses Table"
              status={results.coursesTable}
              description="Required for course storage"
              fix="Run database-schema.sql in Supabase SQL Editor"
            />
            <SetupItem
              label="Course Modules Table"
              status={results.modulesTable}
              description="Required for module storage"
              fix="Run database-schema.sql in Supabase SQL Editor"
            />
            <SetupItem
              label="Storage Bucket"
              status={results.storage}
              description="Required for PDF uploads"
              fix='Create "course-materials" bucket in Supabase Storage (make it PUBLIC)'
            />
            <SetupItem
              label="Demo Course"
              status={results.demoCourse}
              description="Sample course for testing"
              fix="Run database-schema.sql in Supabase SQL Editor"
            />

            {Object.values(results).every((v) => v) ? (
              <div className="glass-card p-6 rounded-xl bg-green-500/10 border-2 border-green-500/20">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                  <div>
                    <h3 className="text-xl font-bold text-green-500">All Setup Complete!</h3>
                    <p className="text-sm text-muted-foreground">Your platform is ready to use</p>
                  </div>
                </div>
                <a
                  href="/demo"
                  className="inline-block mt-4 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  Go to Demo →
                </a>
              </div>
            ) : (
              <div className="glass-card p-6 rounded-xl bg-red-500/10 border-2 border-red-500/20">
                <div className="flex items-center gap-3 mb-3">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                  <div>
                    <h3 className="text-xl font-bold text-red-500">Setup Incomplete</h3>
                    <p className="text-sm text-muted-foreground">Follow the fixes above to complete setup</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 glass-card p-6 rounded-xl bg-blue-500/5 border border-blue-500/20">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" />
            Quick Setup Guide:
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-semibold text-blue-500 mb-1">Step 1: Run SQL</p>
              <p className="text-muted-foreground">
                Go to Supabase Dashboard → SQL Editor → New Query → Copy all from database-schema.sql → RUN
              </p>
            </div>
            <div>
              <p className="font-semibold text-blue-500 mb-1">Step 2: Create Storage</p>
              <p className="text-muted-foreground">
                Go to Storage → New Bucket → Name: "course-materials" → Toggle PUBLIC ON → Create
              </p>
            </div>
            <div>
              <p className="font-semibold text-blue-500 mb-1">Step 3: Verify</p>
              <p className="text-muted-foreground">Run this setup check again - all items should be green!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SetupItem({
  label,
  status,
  description,
  fix
}: {
  label: string
  status: boolean
  description: string
  fix: string
}) {
  return (
    <div className="glass-card p-4 rounded-xl flex items-start gap-4">
      <div className="flex-shrink-0">
        {status ? (
          <CheckCircle2 className="w-6 h-6 text-green-500" />
        ) : (
          <XCircle className="w-6 h-6 text-red-500" />
        )}
      </div>
      <div className="flex-1">
        <h4 className="font-bold mb-1">{label}</h4>
        <p className="text-sm text-muted-foreground mb-2">{description}</p>
        {!status && (
          <div className="bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
            <p className="text-xs text-red-400">
              <strong>Fix:</strong> {fix}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
