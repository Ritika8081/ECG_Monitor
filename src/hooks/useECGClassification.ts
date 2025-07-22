import { useState, useEffect, useCallback } from 'react';
import { ecgClassifier, ModelPrediction, ECGDiseaseClassifier } from '../lib/modelTrainer';

export interface TrainingProgress {
  epoch: number;
  loss: number;
  accuracy: number;
  val_loss?: number;
  val_accuracy?: number;
}

export const useECGClassification = () => {
  const [isModelReady, setIsModelReady] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress | null>(null);
  const [lastPrediction, setLastPrediction] = useState<ModelPrediction | null>(null);

  useEffect(() => {
    // Check if model is ready on mount
    const checkModelStatus = async () => {
      await ecgClassifier.loadModel();
      setIsModelReady(ecgClassifier.isReady());
    };
    
    checkModelStatus();
  }, []);

  const trainModel = useCallback(async () => {
    setIsTraining(true);
    setTrainingProgress(null);
    
    try {
      await ecgClassifier.trainModel((epoch, logs) => {
        setTrainingProgress({
          epoch,
          loss: logs.loss,
          accuracy: logs.acc,
          val_loss: logs.val_loss,
          val_accuracy: logs.val_acc,
        });
      });
    } catch (error) {
      console.error("Error training model:", error);
    } finally {
      setIsTraining(false);
    }
  }, []);

  const predict = useCallback(async (features: number[]) => {
    const prediction = await ecgClassifier.predict(features);
    setLastPrediction(prediction);
  }, []);

  return {
    isModelReady,
    isTraining,
    trainingProgress,
    lastPrediction,
    trainModel,
    predict,
  };
};
