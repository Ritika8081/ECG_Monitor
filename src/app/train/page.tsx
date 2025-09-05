"use client";

import React, { useState, useEffect } from 'react';
import { trainECGModelIncremental } from '@/lib/modelTrainer';

import { testLoadModel, checkModelExists } from '../../lib/modelTester';
import ModelInspector from '../../components/ModelInspector';
import NavBar from '../../components/NavBar';

export default function TrainPage() {
  const [isTraining, setIsTraining] = useState(false);
  const [trainingComplete, setTrainingComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelExists, setModelExists] = useState(false);
  const [modelPrediction, setModelPrediction] = useState<any>(null); // Add state for model prediction
  const [progress, setProgress] = useState<string>("Not started");

  useEffect(() => {

    checkModelExists().then(setModelExists);

  }, []);

  const handleTrain = async () => {
    setIsTraining(true);
    setError(null);
    setTrainingComplete(false);
    setProgress("Training started...");
    
    try {
      console.log("🚀 Starting training...");
      await trainECGModelIncremental();
      console.log("✅ Training completed!");
      setTrainingComplete(true);
      setModelExists(true);
      setProgress("Training complete!");
    } catch (err) {
      console.error("❌ Training failed:", err);
      setError(err instanceof Error ? err.message : 'Training failed');
    } finally {
      setIsTraining(false);
    }
  };

  // Add this function to your component to handle dismissing the prediction
  const dismissPrediction = () => {
    setModelPrediction(null);
  };



  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-auto">
      <NavBar />
      <div className="pt-16 h-[calc(100vh-4rem)]">
        <div className="max-w-6xl mx-auto p-6 pb-24">
          <h1 className="text-xl font-bold text-white mb-4">ECG Model Training & Inspection</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Training Panel */}
            <div className="bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Model Training</h2>
              
              <div className="mb-6">
                <p className="text-white mb-4">
                  This panel allows you to train a neural network to classify ECG conditions based on features like heart rate, intervals, and HRV metrics.
                </p>
                
                {modelExists && (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg mb-4">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-green-400 rounded-full mr-2"></div>
                      <span className="text-green-400 font-medium">Model is trained and ready to use</span>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2 text-sm text-gray-300 mb-4">
                  <p>• Training uses 6 example ECG condition patterns</p>
                  <p>• Model learns to recognize patterns in 10 ECG metrics</p>
                  <p>• Training happens in your browser using TensorFlow.js</p>
                  <p>• Trained model is saved in your browser's local storage</p>
                </div>
              </div>
              
              <button
                onClick={handleTrain}
                disabled={isTraining}
                className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center ${
                  isTraining 
                    ? 'bg-blue-500/30 text-blue-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isTraining ? (
                  <>
                    <div className="w-5 h-5 border-2 border-blue-300 border-t-transparent rounded-full animate-spin mr-2"></div>
                    Training in Progress...
                  </>
                ) : (
                  modelExists ? 'Retrain Model' : 'Train Model'
                )}
              </button>
              
              {trainingComplete && (
                <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <span className="text-green-400">✓ Training completed successfully!</span>
                </div>
              )}
              
              {error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <span className="text-red-400">Error: {error}</span>
                </div>
              )}
              
              <div className="mt-6">
                <h3 className="text-white font-medium mb-2">What happens during training?</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
                  <li>The model learns from example ECG data</li>
                  <li>It trains for up to 40 epochs (iterations)</li>
                  <li>Early stopping prevents overfitting</li>
                  <li>The trained model is saved to your browser storage</li>
                  <li>The model is then ready to classify ECG conditions</li>
                </ol>
              </div>
            </div>
            
            {/* Model Inspector - Note the max-h-[800px] to limit height and enable scrolling */}
            <div className="max-h-[800px] overflow-auto">
              <ModelInspector />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

