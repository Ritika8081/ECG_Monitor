// src/providers/ModelProvider.tsx
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as tf from '@tensorflow/tfjs';
import { classLabels } from '@/lib/modelTrainer';

type ModelContextType = {
  model: tf.LayersModel | null;
  isLoading: boolean;
  error: string | null;
  predict: (features: number[]) => Promise<{
    prediction: string;
    confidence: number;
    allProbabilities: Array<{label: string; probability: number}>;
  } | null>;
};

const ModelContext = createContext<ModelContextType | undefined>(undefined);

export function ModelProvider({ children }: { children: ReactNode }) {
  const [model, setModel] = useState<tf.LayersModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadModel() {
      try {
        // Initialize TensorFlow.js
        await tf.ready();
        console.log('TensorFlow.js initialized');
        
        // Check if model exists in localStorage
        const models = await tf.io.listModels();
        if (!models['localstorage://ecg-disease-model']) {
          setError('No model found in browser storage. Please train the model first.');
          setIsLoading(false);
          return;
        }
        
        // Load the model
        const loadedModel = await tf.loadLayersModel('localstorage://ecg-disease-model');
        console.log('Model loaded successfully');
        setModel(loadedModel);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load model:', err);
        setError(err instanceof Error ? err.message : 'Failed to load model');
        setIsLoading(false);
      }
    }
    
    loadModel();
  }, []);

  // Function to make predictions
  const predict = async (features: number[]) => {
    if (!model) return null;

    try {
      // Ensure features is length 720
      if (features.length !== 720) {
        throw new Error('Input features must be an array of length 720');
      }

      // Reshape to [1, 720, 1]
      const inputTensor = tf.tensor(features, [1, 720, 1]);

      // Run prediction
      const outputTensor = model.predict(inputTensor) as tf.Tensor;
      const probabilities = await outputTensor.data();

      // Get class with highest probability
      const predictionArray = Array.from(probabilities);
      const maxProbIndex = predictionArray.indexOf(Math.max(...predictionArray));
      const predictedClass = classLabels[maxProbIndex];

      // Create result object with all probabilities
      const result = {
        prediction: predictedClass,
        confidence: predictionArray[maxProbIndex] * 100,
        allProbabilities: classLabels.map((label, index) => ({
          label,
          probability: predictionArray[index] * 100
        })).sort((a, b) => b.probability - a.probability)
      };

      // Cleanup tensors
      inputTensor.dispose();
      outputTensor.dispose();

      return result;
    } catch (err) {
      console.error('Prediction error:', err);
      return null;
    }
  };

  const value = { model, isLoading, error, predict };
  
  return (
    <ModelContext.Provider value={value}>
      {children}
    </ModelContext.Provider>
  );
}

// Custom hook to use the model
export function useModel() {
  const context = useContext(ModelContext);
  if (context === undefined) {
    throw new Error('useModel must be used within a ModelProvider');
  }
  return context;
}