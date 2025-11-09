// Follow this setup guide to integrate the Deno runtime into your Supabase Edge Functions:
// https://supabase.com/docs/guides/functions

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ========================================
// Federated Learning Model Aggregation
// ========================================
// Secure aggregation of model updates from multiple students

interface ModelUpdate {
  studentId: string
  courseId: string
  weights: number[][]
  biases: number[]
  accuracy: number
  privacyBudget: number
  timestamp: number
}

interface GlobalModel {
  courseId: string
  version: number
  weights: number[][]
  biases: number[]
  numContributors: number
  avgAccuracy: number
  deployedAt: string
}

// FedAvg: Federated Averaging Algorithm
function federatedAverage(updates: ModelUpdate[]): {
  weights: number[][]
  biases: number[]
  avgAccuracy: number
} {
  if (updates.length === 0) {
    throw new Error('No updates to aggregate')
  }
  
  const numUpdates = updates.length
  
  // Initialize averaged weights and biases
  const avgWeights: number[][] = updates[0].weights.map(layer => 
    layer.map(() => 0)
  )
  const avgBiases: number[] = updates[0].biases.map(() => 0)
  
  // Sum all weights and biases
  for (const update of updates) {
    for (let i = 0; i < update.weights.length; i++) {
      for (let j = 0; j < update.weights[i].length; j++) {
        avgWeights[i][j] += update.weights[i][j]
      }
    }
    
    for (let i = 0; i < update.biases.length; i++) {
      avgBiases[i] += update.biases[i]
    }
  }
  
  // Divide by number of updates to get average
  for (let i = 0; i < avgWeights.length; i++) {
    for (let j = 0; j < avgWeights[i].length; j++) {
      avgWeights[i][j] /= numUpdates
    }
  }
  
  for (let i = 0; i < avgBiases.length; i++) {
    avgBiases[i] /= numUpdates
  }
  
  // Calculate average accuracy
  const avgAccuracy = updates.reduce((sum, u) => sum + u.accuracy, 0) / numUpdates
  
  return {
    weights: avgWeights,
    biases: avgBiases,
    avgAccuracy
  }
}

// Add additional differential privacy at aggregation level
function addServerSidePrivacy(
  weights: number[][],
  biases: number[],
  epsilon: number = 0.1
): { weights: number[][], biases: number[] } {
  const noisyWeights = weights.map(layer =>
    layer.map(w => w + (Math.random() - 0.5) * epsilon)
  )
  
  const noisyBiases = biases.map(b =>
    b + (Math.random() - 0.5) * epsilon
  )
  
  return { weights: noisyWeights, biases: noisyBiases }
}

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    // Parse request
    const { action, courseId, modelUpdate } = await req.json()

    if (action === 'submit_update') {
      // Student submitting model update
      const { studentId, weights, biases, accuracy, privacyBudget } = modelUpdate

      // Store model update
      const { error: insertError } = await supabase
        .from('fl_model_updates')
        .insert({
          student_id: studentId,
          course_id: courseId,
          model_weights: { weights, biases },
          accuracy,
          privacy_budget_used: privacyBudget,
          training_round: 1, // Will be incremented
          created_at: new Date().toISOString()
        })

      if (insertError) throw insertError

      // Check if we have enough updates to aggregate (e.g., 10 students)
      const { data: recentUpdates, error: fetchError } = await supabase
        .from('fl_model_updates')
        .select('*')
        .eq('course_id', courseId)
        .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // Last hour
        .order('created_at', { ascending: false })
        .limit(10)

      if (fetchError) throw fetchError

      let shouldAggregate = false
      let aggregatedModel = null

      if (recentUpdates && recentUpdates.length >= 10) {
        // Aggregate models
        const updates: ModelUpdate[] = recentUpdates.map(u => ({
          studentId: u.student_id,
          courseId: u.course_id,
          weights: u.model_weights.weights,
          biases: u.model_weights.biases,
          accuracy: u.accuracy,
          privacyBudget: u.privacy_budget_used,
          timestamp: new Date(u.created_at).getTime()
        }))

        const { weights, biases, avgAccuracy } = federatedAverage(updates)
        
        // Add server-side differential privacy
        const { weights: privateWeights, biases: privateBiases } = 
          addServerSidePrivacy(weights, biases)

        // Get current version
        const { data: currentModel } = await supabase
          .from('fl_global_models')
          .select('version')
          .eq('course_id', courseId)
          .order('version', { ascending: false })
          .limit(1)
          .single()

        const newVersion = (currentModel?.version || 0) + 1

        // Store new global model
        const { error: modelError } = await supabase
          .from('fl_global_models')
          .insert({
            course_id: courseId,
            version: newVersion,
            model_weights: { weights: privateWeights, biases: privateBiases },
            num_contributors: updates.length,
            avg_accuracy: avgAccuracy,
            deployed_at: new Date().toISOString()
          })

        if (modelError) throw modelError

        shouldAggregate = true
        aggregatedModel = {
          version: newVersion,
          weights: privateWeights,
          biases: privateBiases,
          accuracy: avgAccuracy
        }

        console.log(`✅ Aggregated model v${newVersion} from ${updates.length} students`)
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Model update received',
          aggregated: shouldAggregate,
          globalModel: aggregatedModel
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          status: 200
        }
      )
    } else if (action === 'get_global_model') {
      // Student requesting latest global model
      const { data: globalModel, error } = await supabase
        .from('fl_global_models')
        .select('*')
        .eq('course_id', courseId)
        .order('version', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        // No global model yet, return null
        return new Response(
          JSON.stringify({
            success: true,
            model: null,
            message: 'No global model available yet'
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            status: 200
          }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          model: {
            version: globalModel.version,
            weights: globalModel.model_weights.weights,
            biases: globalModel.model_weights.biases,
            numContributors: globalModel.num_contributors,
            avgAccuracy: globalModel.avg_accuracy,
            deployedAt: globalModel.deployed_at
          }
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          status: 200
        }
      )
    } else {
      throw new Error('Invalid action')
    }
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        status: 400
      }
    )
  }
})
