"use client";

import React from 'react';
import Link from 'next/link';

export default function DocsPage() {
  return (
    <div className="h-full h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="h-full scrollable-content p-6">
        <div className="max-w-4xl mx-auto pb-8">
          <h1 className="text-3xl font-bold text-white mb-8">ECG Monitor Application Documentation</h1>
          
          <div className="bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">How to Use This Application</h2>
            <ol className="list-decimal list-inside text-gray-300 space-y-3 mb-4">
              <li>
                <span className="font-semibold text-blue-400">Train the AI Model:</span>
                <ul className="list-disc list-inside ml-6 mt-1 text-gray-400">
                  <li>Go to the <Link href="/train" className="text-blue-400 hover:underline">Training Page</Link>.</li>
                  <li>Click <span className="font-semibold">"Train Model"</span> to start training a neural network on ECG data in your browser.</li>
                  <li>Wait for training to complete. The model will be saved in your browser for future use.</li>
                  <li>Use the Model Inspector panel to view model structure, weights, and test predictions.</li>
                </ul>
              </li>
              <li>
                <span className="font-semibold text-blue-400">Connect Your ECG Device:</span>
                <ul className="list-disc list-inside ml-6 mt-1 text-gray-400">
                  <li>Return to the <Link href="/" className="text-blue-400 hover:underline">ECG Monitor</Link> page.</li>
                  <li>Click the <span className="font-semibold">Bluetooth</span> button in the sidebar to connect your ECG device via Bluetooth.</li>
                  <li>Follow the prompts to select and pair your device.</li>
                </ul>
              </li>
              <li>
                <span className="font-semibold text-blue-400">Monitor and Analyze ECG:</span>
                <ul className="list-disc list-inside ml-6 mt-1 text-gray-400">
                  <li>Once connected, you will see your real-time ECG waveform on the main screen.</li>
                  <li>Use the sidebar buttons to toggle features such as:
                    <ul className="list-disc ml-6 mt-1">
                      <li><span className="text-purple-400">Peaks:</span> Show detected R-peaks</li>
                      <li><span className="text-green-400">PQRST:</span> Visualize P, Q, R, S, T points</li>
                      <li><span className="text-yellow-400">Intervals:</span> View PR, QRS, QT intervals</li>
                      <li><span className="text-blue-400">HRV:</span> Show heart rate variability metrics</li>
                      <li><span className="text-pink-400">AI Analysis:</span> Toggle real-time heartbeat classification</li>
                    </ul>
                  </li>
                  <li>Hover over buttons for tooltips describing each feature.</li>
                </ul>
              </li>
              <li>
                <span className="font-semibold text-blue-400">View AI Analysis:</span>
                <ul className="list-disc list-inside ml-6 mt-1 text-gray-400">
                  <li>Enable the <span className="font-semibold">AI Analysis</span> button to see real-time beat classification results.</li>
                  <li>Each detected heartbeat will be classified into one of five categories (Normal, Supraventricular, Ventricular, Fusion, Other) according to the AAMI EC57 standard.</li>
                  <li>Confidence scores and class probabilities are displayed for each beat.</li>
                </ul>
              </li>
              <li>
                <span className="font-semibold text-blue-400">Session Recording & Reports:</span>
                <ul className="list-disc list-inside ml-6 mt-1 text-gray-400">
                  <li>Optionally, record your ECG session for later review.</li>
                  <li>After recording, view a summary report with statistics, detected events, and AI analysis results.</li>
                </ul>
              </li>
            </ol>
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg mt-2">
              <h4 className="text-sm font-medium text-blue-400">Tip:</h4>
              <p className="text-gray-300 text-sm mt-1">
                All processing and AI inference happens locally in your browser. No ECG data is uploaded or shared.
              </p>
            </div>
          </div>
          
          <div className="bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Model Architecture</h2>
            <p className="text-gray-300 mb-4">
              The model is a 1D Convolutional Neural Network (CNN) trained to classify single heartbeats. It uses the following layers:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="px-4 py-2 text-blue-400">Layer</th>
                    <th className="px-4 py-2 text-blue-400">Type</th>
                    <th className="px-4 py-2 text-blue-400">Filters/Units</th>
                    <th className="px-4 py-2 text-blue-400">Activation</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-white/10">
                    <td className="px-4 py-2">Input</td>
                    <td className="px-4 py-2">Conv1D</td>
                    <td className="px-4 py-2">32</td>
                    <td className="px-4 py-2">ReLU</td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="px-4 py-2">Hidden</td>
                    <td className="px-4 py-2">Conv1D x3</td>
                    <td className="px-4 py-2">64, 128, 256</td>
                    <td className="px-4 py-2">ReLU</td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="px-4 py-2">Pooling</td>
                    <td className="px-4 py-2">GlobalAvgPool1D</td>
                    <td className="px-4 py-2">-</td>
                    <td className="px-4 py-2">-</td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="px-4 py-2">Dense</td>
                    <td className="px-4 py-2">Dense x2</td>
                    <td className="px-4 py-2">128, 64</td>
                    <td className="px-4 py-2">ReLU</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Output</td>
                    <td className="px-4 py-2">Dense</td>
                    <td className="px-4 py-2">5</td>
                    <td className="px-4 py-2">Softmax</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Input Features</h2>
            <p className="text-gray-300 mb-4">
              The model takes 187 consecutive ECG samples centered on the R-peak of each heartbeat. Each beat is normalized using z-score normalization before classification.
            </p>
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg mt-2">
              <h4 className="text-sm font-medium text-blue-400">Beat Extraction:</h4>
              <p className="text-gray-300 text-sm mt-1">
                Beats are extracted from the MIT-BIH Arrhythmia Database using annotation indices for R-peaks. Each beat is a window of 187 samples (about 0.37 seconds at 500Hz).
              </p>
            </div>
          </div>
          
          <div className="bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl p-6 mt-8">
            <h2 className="text-2xl font-bold text-white mb-4">Classification System</h2>
            <p className="text-gray-300 mb-4">
              The model uses the AAMI EC57 standard for heartbeat classification:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-1 mb-2">
              <li><span className="text-green-400 font-semibold">Normal (N):</span> N, L, R, e, j</li>
              <li><span className="text-yellow-400 font-semibold">Supraventricular (S):</span> A, a, J, S</li>
              <li><span className="text-red-400 font-semibold">Ventricular (V):</span> V, E, r</li>
              <li><span className="text-blue-400 font-semibold">Fusion (F):</span> F</li>
              <li><span className="text-gray-400 font-semibold">Other (Q):</span> Q, /, f, n</li>
            </ul>
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg mt-2">
              <h4 className="text-sm font-medium text-green-400">Clinical Standard:</h4>
              <p className="text-gray-300 text-sm mt-1">
                The AAMI EC57 standard is used internationally for ECG research and clinical validation.
              </p>
            </div>
          </div>
          
          <div className="bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl p-6 mt-8">
            <h2 className="text-2xl font-bold text-white mb-4">AI & Analysis Features</h2>
            <p className="text-gray-300 mb-4">
              The application provides real-time and retrospective ECG analysis:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <h3 className="text-lg font-medium text-yellow-400 mb-2">ECG Beat Classification</h3>
                <p className="text-gray-300 mb-2">
                  Each detected heartbeat is automatically classified into one of five categories:
                </p>
                <ul className="text-gray-300 space-y-1 list-disc list-inside">
                  <li>Normal</li>
                  <li>Supraventricular</li>
                  <li>Ventricular</li>
                  <li>Fusion</li>
                  <li>Other</li>
                </ul>
                <p className="text-gray-300 mt-2 text-sm italic">
                  Classification runs automatically for each detected beat when the AI Analysis panel is enabled.
                </p>
              </div>
              
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <h3 className="text-lg font-medium text-blue-400 mb-2">Additional Features</h3>
                <ul className="text-gray-300 space-y-1 list-disc list-inside">
                  <li>Real-time heart rate and HRV metrics</li>
                  <li>PQRST and interval visualization</li>
                  <li>Session recording and summary reports</li>
                  <li>All processing is local—no data leaves your device</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}