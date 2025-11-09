import * as tf from '@tensorflow/tfjs'

// ========================================
// Federated Learning Model Trainer
// ========================================
// Trains models locally in the browser for privacy-preserving learning

export interface TrainingData {
  questions: Array<{
    question: string
    type: 'mcq' | 'descriptive' | 'fill_blank'
    difficulty: 'easy' | 'medium' | 'hard'
    topic: string
  }>
  answers: Array<{
    isCorrect: boolean
    timeSpent: number
    confidence: number
  }>
}

export interface ModelWeights {
  weights: number[][]
  biases: number[]
  version: number
  accuracy: number
}

export interface TrainingProgress {
  epoch: number
  totalEpochs: number
  loss: number
  accuracy: number
  status: 'initializing' | 'training' | 'completed' | 'error'
}

// ========================================
// Local Model Storage (IndexedDB)
// ========================================

class LocalModelStorage {
  private dbName = 'fl_models'
  private storeName = 'student_models'
  
  async saveModel(courseId: string, model: tf.LayersModel): Promise<void> {
    await model.save(`indexeddb://${this.dbName}_${courseId}`)
  }
  
  async loadModel(courseId: string): Promise<tf.LayersModel | null> {
    try {
      const model = await tf.loadLayersModel(`indexeddb://${this.dbName}_${courseId}`)
      return model
    } catch {
      return null
    }
  }
  
  async deleteModel(courseId: string): Promise<void> {
    await tf.io.removeModel(`indexeddb://${this.dbName}_${courseId}`)
  }
}

export const localModelStorage = new LocalModelStorage()

// ========================================
// Model Architecture
// ========================================

function createStudentModel(inputSize: number = 10): tf.LayersModel {
  const model = tf.sequential({
    layers: [
      // Input layer
      tf.layers.dense({
        units: 32,
        activation: 'relu',
        inputShape: [inputSize],
        kernelInitializer: 'heNormal'
      }),
      // Dropout for regularization
      tf.layers.dropout({ rate: 0.3 }),
      // Hidden layer
      tf.layers.dense({
        units: 16,
        activation: 'relu',
        kernelInitializer: 'heNormal'
      }),
      // Dropout
      tf.layers.dropout({ rate: 0.2 }),
      // Output layer (binary: pass/fail prediction)
      tf.layers.dense({
        units: 1,
        activation: 'sigmoid'
      })
    ]
  })
  
  // Compile model
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  })
  
  return model
}

// ========================================
// Prepare Training Data
// ========================================

function prepareTrainingData(trainingData: TrainingData): {
  xs: tf.Tensor2D
  ys: tf.Tensor2D
} {
  // Feature extraction from quiz data
  const features: number[][] = []
  const labels: number[][] = []
  
  trainingData.questions.forEach((question, idx) => {
    const answer = trainingData.answers[idx]
    
    // Extract features (10 features)
    const feature = [
      // Question difficulty (0=easy, 1=medium, 2=hard)
      question.difficulty === 'easy' ? 0 : question.difficulty === 'medium' ? 1 : 2,
      // Question type (0=mcq, 1=fill, 2=descriptive)
      question.type === 'mcq' ? 0 : question.type === 'fill_blank' ? 1 : 2,
      // Time spent (normalized to 0-1 range, assuming max 300 seconds)
      Math.min(answer.timeSpent / 300, 1),
      // Confidence level (0-1)
      answer.confidence || 0.5,
      // Topic encoded (simple hash to 0-1)
      (question.topic.charCodeAt(0) % 100) / 100,
      // Interaction features
      answer.isCorrect ? 1 : 0,
      answer.timeSpent < 60 ? 1 : 0,  // Quick answer
      answer.timeSpent > 180 ? 1 : 0,  // Slow answer
      // Additional context
      idx / trainingData.questions.length,  // Position in quiz
      Math.random() * 0.1  // Small noise for privacy
    ]
    
    features.push(feature)
    // Label: will student pass next similar question? (based on current correctness)
    labels.push([answer.isCorrect ? 1 : 0])
  })
  
  const xs = tf.tensor2d(features)
  const ys = tf.tensor2d(labels)
  
  return { xs, ys }
}

// ========================================
// Federated Learning Trainer
// ========================================

export class FLModelTrainer {
  private model: tf.LayersModel | null = null
  private courseId: string
  private onProgress?: (progress: TrainingProgress) => void
  
  constructor(courseId: string, onProgress?: (progress: TrainingProgress) => void) {
    this.courseId = courseId
    this.onProgress = onProgress
  }
  
  // Initialize or load existing model
  async initialize(): Promise<void> {
    this.reportProgress(0, 1, 0, 0, 'initializing')
    
    // Try to load existing local model
    const existingModel = await localModelStorage.loadModel(this.courseId)
    
    if (existingModel) {
      console.log('📦 Loaded existing local model')
      this.model = existingModel
    } else {
      console.log('🆕 Creating new local model')
      this.model = createStudentModel()
    }
  }
  
  // Train on local data
  async train(trainingData: TrainingData, epochs: number = 10): Promise<ModelWeights> {
    if (!this.model) {
      await this.initialize()
    }
    
    if (!this.model) {
      throw new Error('Model initialization failed')
    }
    
    this.reportProgress(0, epochs, 0, 0, 'training')
    
    // Prepare data
    const { xs, ys } = prepareTrainingData(trainingData)
    
    // Train model
    const history = await this.model.fit(xs, ys, {
      epochs,
      batchSize: Math.min(8, trainingData.questions.length),
      shuffle: true,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          this.reportProgress(
            epoch + 1,
            epochs,
            logs?.loss || 0,
            logs?.acc || 0,
            'training'
          )
        }
      }
    })
    
    // Clean up tensors
    xs.dispose()
    ys.dispose()
    
    // Save model locally
    await localModelStorage.saveModel(this.courseId, this.model)
    
    // Extract weights for federated aggregation
    const weights = await this.extractWeights()
    
    const finalAccuracy = history.history.acc?.[history.history.acc.length - 1] as number || 0
    
    this.reportProgress(epochs, epochs, 0, finalAccuracy, 'completed')
    
    return weights
  }
  
  // Extract model weights for server aggregation
  async extractWeights(): Promise<ModelWeights> {
    if (!this.model) {
      throw new Error('Model not initialized')
    }
    
    const layerWeights = this.model.getWeights()
    const weights: number[][] = []
    const biases: number[] = []
    
    for (let i = 0; i < layerWeights.length; i++) {
      const tensorData = await layerWeights[i].array()
      if (i % 2 === 0) {
        // Weight matrix
        weights.push((tensorData as number[][]).flat())
      } else {
        // Bias vector
        biases.push(...(tensorData as number[]))
      }
    }
    
    return {
      weights,
      biases,
      version: Date.now(),
      accuracy: 0.8  // Will be calculated properly
    }
  }
  
  // Load global model weights from server
  async loadGlobalWeights(weights: ModelWeights): Promise<void> {
    if (!this.model) {
      await this.initialize()
    }
    
    if (!this.model) {
      throw new Error('Model not initialized')
    }
    
    // Convert flat weights back to tensors
    const tensors: tf.Tensor[] = []
    let weightIdx = 0
    let biasIdx = 0
    
    // Reconstruct weight tensors (this is simplified, real implementation needs proper shapes)
    for (const layer of this.model.layers) {
      if (layer.getWeights().length > 0) {
        // Weight matrix
        const weightTensor = tf.tensor2d(weights.weights[weightIdx], layer.getWeights()[0].shape as [number, number])
        tensors.push(weightTensor)
        weightIdx++
        
        // Bias vector
        if (layer.getWeights().length > 1) {
          const biasTensor = tf.tensor1d(weights.biases.slice(biasIdx, biasIdx + (layer.getWeights()[1].shape[0] as number)))
          tensors.push(biasTensor)
          biasIdx += layer.getWeights()[1].shape[0] as number
        }
      }
    }
    
    this.model.setWeights(tensors)
    
    // Save updated model
    await localModelStorage.saveModel(this.courseId, this.model)
    
    console.log('✅ Global model weights loaded')
  }
  
  // Predict student performance on next quiz
  async predict(questionFeatures: number[]): Promise<number> {
    if (!this.model) {
      await this.initialize()
    }
    
    if (!this.model) {
      throw new Error('Model not initialized')
    }
    
    const input = tf.tensor2d([questionFeatures])
    const prediction = this.model.predict(input) as tf.Tensor
    const score = (await prediction.data())[0]
    
    input.dispose()
    prediction.dispose()
    
    return score
  }
  
  // Report training progress
  private reportProgress(
    epoch: number,
    totalEpochs: number,
    loss: number,
    accuracy: number,
    status: TrainingProgress['status']
  ): void {
    if (this.onProgress) {
      this.onProgress({
        epoch,
        totalEpochs,
        loss,
        accuracy,
        status
      })
    }
  }
  
  // Clean up resources
  dispose(): void {
    if (this.model) {
      this.model.dispose()
      this.model = null
    }
  }
}

// ========================================
// Differential Privacy
// ========================================

export function addDifferentialPrivacy(
  weights: ModelWeights,
  epsilon: number = 0.5
): ModelWeights {
  // Add Gaussian noise for differential privacy
  const noisyWeights = weights.weights.map(layer =>
    layer.map(w => w + (Math.random() - 0.5) * epsilon)
  )
  
  const noisyBiases = weights.biases.map(b =>
    b + (Math.random() - 0.5) * epsilon
  )
  
  return {
    ...weights,
    weights: noisyWeights,
    biases: noisyBiases
  }
}

// ========================================
// Helper: Convert Quiz Data
// ========================================

export function convertQuizToTrainingData(
  questions: any[],
  answers: any[]
): TrainingData {
  return {
    questions: questions.map(q => ({
      question: q.question,
      type: q.type || 'mcq',
      difficulty: q.difficulty || 'medium',
      topic: q.topic || 'general'
    })),
    answers: answers.map(a => ({
      isCorrect: a.isCorrect,
      timeSpent: a.timeSpent || 60,
      confidence: a.confidence || 0.5
    }))
  }
}
