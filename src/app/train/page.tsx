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
      appendLog("🚀 Starting training with new 360Hz model...");
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
        // onLog callback
        appendLog
      );
      appendLog("✅ Training completed successfully!");
      appendLog("📁 Model saved to browser downloads as 'beat-level-ecg-model'");
      setTrainingComplete(true);
      setModelExists(true);
    } catch (err) {
      appendLog(`❌ Training failed: ${err instanceof Error ? err.message : 'Training failed'}`);
      setError(err instanceof Error ? err.message : 'Training failed');
    } finally {
      setIsTraining(false);
    }
  };

  // Updated constants for 360Hz model
  const samplingRate = 360; // Updated from 500 to 360
  const beatLength = 135; // Updated from 187 to 135

  return (
    <div className="w-full min-h-screen h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-auto flex flex-col">
      <NavBar />
      <div className="flex-1 flex flex-col pt-16">
        <div className="max-w-9xl mx-auto p-4 flex-1 w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
            {/* Training Panel */}
            <div className="bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl p-3 flex flex-col h-[540px] md:h-[calc(100vh-7.5rem)]">
              <h2 className="text-lg font-bold text-white mb-2">ECG Beat Classification Model Training</h2>
              <div className="mb-2 flex-1 overflow-y-auto">
                <p className="text-white mb-2 text-sm">
                  Train a deep learning model to classify ECG heartbeat patterns using the AAMI 5-class standard for real-time arrhythmia detection.
                </p>
                <div className="mb-2 text-xs text-blue-300">
                  <p>• <b>Sampling Rate:</b> {samplingRate} Hz (native 360Hz - no resampling)</p>
                  <p>• <b>Beat Window:</b> {beatLength} samples ({(beatLength / samplingRate * 1000).toFixed(0)}ms)</p>
                  <p>• <b>Model Input:</b> [{beatLength}, 1] tensor shape</p>
                  <p>• <b>Classes:</b> {classLabels.join(', ')}</p>
                  <p>• <b>Architecture:</b> CNN with 4 conv layers + 2 dense layers</p>
                </div>
                {modelExists && (
                  <div className="p-2 bg-green-500/10 border border-green-500/30 rounded-lg mb-2">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                      <span className="text-green-400 font-medium text-xs">Model trained and ready for inference</span>
                    </div>
                  </div>
                )}
                <div className="space-y-1 text-xs text-gray-300 mb-2">
                  <p>• Uses 0 MIT-BIH records for training</p>
                  <p>• Processes ~100,000+ labeled heartbeat examples</p>
                  <p>• Balanced dataset with equal class representation</p>
                  <p>• Z-score normalized beat windows for stable training</p>
                  <p>• 70/15/15% train/validation/test split</p>
                  <p>• Model saved locally in browser IndexedDB</p>
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
                    Training Model...
                  </>
                ) : (
                  modelExists ? 'Retrain Model (360Hz)' : 'Train New Model (360Hz)'
                )}
              </button>
              {trainingComplete && (
                <div className="mt-2 p-2 bg-green-500/10 border border-green-500/30 rounded-lg text-xs">
                  <span className="text-green-400">✓ 360Hz model training completed successfully!</span>
                </div>
              )}
              {error && (
                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs">
                  <span className="text-red-400">Error: {error}</span>
                </div>
              )}
            </div>

            {/* Training Logs */}
            <div className="bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl p-3 flex flex-col h-[540px] md:h-[calc(100vh-7.5rem)]">
              <h3 className="text-lg font-bold text-white mb-2">Training Progress</h3>
              <div className="bg-black/60 border border-white/10 rounded p-2 h-28 md:h-40 overflow-y-auto text-xs text-gray-200 font-mono whitespace-pre-line flex-1">
                {logs.length === 0 && !isTraining && (
                  <div className="text-gray-500 italic">Training logs will appear here...</div>
                )}
                {logs.map((log, idx) => (
                  <div key={idx} className={
                    log.includes('✅') ? 'text-green-400' :
                    log.includes('❌') ? 'text-red-400' :
                    log.includes('⚠️') ? 'text-yellow-400' :
                    log.includes('Epoch') ? 'text-blue-300' :
                    'text-gray-200'
                  }>{log}</div>
                ))}
                <div ref={logsEndRef} />
              </div>
              <div className="mt-2">
                <h3 className="text-lg font-bold text-white mb-2">Training Process (360Hz)</h3>
                <ol className="list-decimal list-inside space-y-1 text-xs text-gray-300">
                  <li>Load MIT-BIH ECG data at native 360Hz sampling rate</li>
                  <li>Extract 135-sample beat windows around R-peaks (375ms)</li>
                  <li>Apply Z-score normalization for stable training</li>
                  <li>Balance dataset across 5 AAMI arrhythmia classes</li>
                  <li>Train CNN model for 10 epochs with early stopping</li>
                  <li>Evaluate performance with precision/recall metrics</li>
                  <li>Save trained model to browser storage</li>
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

