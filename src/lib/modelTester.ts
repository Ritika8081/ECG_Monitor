import * as tf from "@tensorflow/tfjs";
import { classLabels } from './modelTrainer';

// Check if model exists in localStorage
export async function checkModelExists(): Promise<boolean> {
  const models = await tf.io.listModels();
  return models['localstorage://beat-level-ecg-model'] !== undefined;
}

// Load model and make a test prediction
export async function testLoadModel() {
  try {
    // Check if model exists
    const exists = await checkModelExists();
    if (!exists) {
      throw new Error('No model found in local storage. Please train the model first.');
    }

    // Load model
    const model = await tf.loadLayersModel('localstorage://beat-level-ecg-model');

    // Create test input (example: 720 features for beat-level model)
    const testInputArray = Array(720).fill(0); // Replace with realistic test data if available
    const testInput = tf.tensor(testInputArray, [1, 720, 1]);

    // Run prediction
    const prediction = model.predict(testInput) as tf.Tensor;
    const probabilities = await prediction.data();

    // Get index of highest probability
    const maxProbIndex = Array.from(probabilities).indexOf(
      Math.max(...Array.from(probabilities))
    );

    // Get corresponding class label
    const predictedClass = classLabels[maxProbIndex];

    // Cleanup tensors
    testInput.dispose();
    prediction.dispose();

    return {
      success: true,
      prediction: predictedClass,
      probabilities: Array.from(probabilities).map((p, i) => ({
        class: classLabels[i],
        probability: p
      }))
    };
  } catch (error) {
    console.error('Model test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}