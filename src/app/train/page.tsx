"use client";

import React, { useState, useEffect, useRef } from 'react';
import { trainBeatLevelECGModelAllFiles, classLabels } from '@/lib/modelTrainer';
import { checkModelExists } from '../../lib/modelTester';
import ModelInspector from '../../components/ModelInspector';
import NavBar from '../../components/NavBar';

export default function TrainPage() {
  const [isTraining, setIsTraining] = useState(false);
  const [trainingComplete, setTrainingComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelExists, setModelExists] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkModelExists().then(setModelExists);
  }, []);

  // Scroll to bottom of logs when logs update
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const appendLog = (msg: string) => setLogs(logs => [...logs, msg]);

  const handleTrain = async () => {
    setIsTraining(true);
    setError(null);
    setTrainingComplete(false);
    setLogs([]);

    try {
      appendLog("🚀 Starting training...");
      await trainBeatLevelECGModelAllFiles(
        // onEpoch callback
        (epoch, logsObj) => {
          const trainAcc = (logsObj?.acc || logsObj?.categoricalAccuracy || 0) * 100;
          const valAcc = (logsObj?.val_acc || logsObj?.val_categoricalAccuracy || 0) * 100;
          const trainLoss = logsObj?.loss?.toFixed(4);
          const valLoss = logsObj?.val_loss?.toFixed(4);
          appendLog(
            `Epoch ${epoch + 1}/10 | Train Acc: ${trainAcc.toFixed(2)}% | Val Acc: ${valAcc.toFixed(2)}% | Train Loss: ${trainLoss} | Val Loss: ${valLoss}`
          );
        },
        // onLog callback (see below)
        appendLog
      );
      appendLog("✅ Training completed!");
      setTrainingComplete(true);
      setModelExists(true);
    } catch (err) {
      appendLog(`❌ Training failed: ${err instanceof Error ? err.message : 'Training failed'}`);
      setError(err instanceof Error ? err.message : 'Training failed');
    } finally {
      setIsTraining(false);
    }
  };

  // Constants for display
  const samplingRate = 500;
  const beatLength = 187; // This is the window length used in modelTrainer.ts

  return (
    <div className="w-full min-h-screen h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-auto flex flex-col">
      <NavBar />
      <div className="flex-1 flex flex-col pt-16">
        <div className="max-w-9xl mx-auto p-4 flex-1 w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
            {/* Training Panel */}
            <div className="bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl p-3 flex flex-col h-[540px] md:h-[calc(100vh-7.5rem)]">
              <h2 className="text-lg font-bold text-white mb-2">Model Training</h2>
              <div className="mb-2 flex-1 overflow-y-auto">
                <p className="text-white mb-2 text-sm">
                  This panel allows you to train a neural network to classify ECG conditions based on features like heart rate, intervals, and HRV metrics.
                </p>
                <div className="mb-2 text-xs text-blue-300">
                  <p>• <b>Sampling Rate:</b> {samplingRate} Hz (data is resampled from 360 Hz)</p>
                  <p>• <b>Beat Window Length:</b> {beatLength} samples per beat</p>
                  <p>• <b>Classes:</b> {classLabels.join(', ')}</p>
                </div>
                {modelExists && (
                  <div className="p-2 bg-green-500/10 border border-green-500/30 rounded-lg mb-2">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                      <span className="text-green-400 font-medium text-xs">Model is trained and ready to use</span>
                    </div>
                  </div>
                )}
                <div className="space-y-1 text-xs text-gray-300 mb-2">
                  <p>• Training uses {classLabels.length} example ECG condition patterns</p>
                  <p>• Model learns to recognize patterns in 10 ECG metrics</p>
                  <p>• Training happens in your browser using TensorFlow.js</p>
                  <p>• Trained model is saved in your browser&apos;s local storage</p>
                </div>
              </div>
              <button
                onClick={handleTrain}
                disabled={isTraining}
                className={`w-full py-2 px-3 rounded-lg font-medium flex items-center justify-center text-sm ${
                  isTraining
                    ? 'bg-blue-500/30 text-blue-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isTraining ? (
                  <>
                    <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin mr-2"></div>
                    Training in Progress...
                  </>
                ) : (
                  modelExists ? 'Retrain Model' : 'Train Model'
                )}
              </button>
              {trainingComplete && (
                <div className="mt-2 p-2 bg-green-500/10 border border-green-500/30 rounded-lg text-xs">
                  <span className="text-green-400">✓ Training completed successfully!</span>
                </div>
              )}
              {error && (
                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs">
                  <span className="text-red-400">Error: {error}</span>
                </div>
              )}
            </div>

            {/* Training Logs & What happens */}
            <div className="bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl p-3 flex flex-col h-[540px] md:h-[calc(100vh-7.5rem)]">
              <h3 className="text-lg font-bold text-white mb-2">Training Logs</h3>
              <div className="bg-black/60 border border-white/10 rounded p-2 h-28 md:h-40 overflow-y-auto text-xs text-gray-200 font-mono whitespace-pre-line flex-1">
                {logs.map((log, idx) => (
                  <div key={idx}>{log}</div>
                ))}
                <div ref={logsEndRef} />
              </div>
              <div className="mt-2">
                <h3 className="text-lg font-bold text-white mb-2">What happens during training?</h3>
                <ol className="list-decimal list-inside space-y-1 text-xs text-gray-300">
                  <li>The model learns from example ECG data (resampled to 500 Hz)</li>
                  <li>It trains for up to 10 epochs (iterations)</li>
                  <li>Early stopping prevents overfitting</li>
                  <li>The trained model is saved to your browser storage</li>
                  <li>The model is then ready to classify ECG conditions</li>
                </ol>
              </div>
            </div>

            {/* Model Inspector */}
            <div className="bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl p-3 h-[540px] md:h-[calc(100vh-7.5rem)] overflow-auto flex flex-col">
              <ModelInspector />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

