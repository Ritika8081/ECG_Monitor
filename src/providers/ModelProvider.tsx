// src/providers/ModelProvider.tsx
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as tf from '@tensorflow/tfjs';
import { classLabels } from '@/lib/modelTrainer'; // Use your actual class labels

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
        await tf.ready();
        console.log('TensorFlow.js initialized');

        // Check if model exists in localStorage
        const models = await tf.io.listModels();
        if (!models['localstorage://beat-level-ecg-model']) {
          setError('No model found in browser storage. Please train the model first.');
          setIsLoading(false);
          return;
        }

        // Load the model
        const loadedModel = await tf.loadLayersModel('localstorage://beat-level-ecg-model');
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
      if (features.length !== 720) {
        throw new Error('Input features must be an array of length 720');
      }

      const inputTensor = tf.tensor(features, [1, 720, 1]);
      const outputTensor = model.predict(inputTensor) as tf.Tensor;
      const probabilities = await outputTensor.data();

      const predictionArray = Array.from(probabilities);
      const maxProbIndex = predictionArray.indexOf(Math.max(...predictionArray));
      const predictedClass = classLabels[maxProbIndex];

      const result = {
        prediction: predictedClass,
        confidence: predictionArray[maxProbIndex] * 100,
        allProbabilities: classLabels.map((label, index) => ({
          label,
          probability: predictionArray[index] * 100
        })).sort((a, b) => b.probability - a.probability)
      };

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