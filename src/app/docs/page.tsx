"use client";

import React from 'react';
import Link from 'next/link';

export default function DocsPage() {
  return (
    <div className="h-full h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="h-full scrollable-content p-6">
        <div className="max-w-4xl mx-auto pb-8">
          <h1 className="text-3xl font-bold text-white mb-8">ECG AI Model Documentation</h1>
          
          <div className="bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Overview</h2>
            <p className="text-gray-300 mb-4">
              This application uses a neural network model to classify ECG conditions based on various ECG metrics and features.
              The model is trained using TensorFlow.js directly in your browser and can identify various cardiac conditions.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <h3 className="text-lg font-medium text-blue-400 mb-2">Key Features</h3>
                <ul className="list-disc list-inside text-gray-300 space-y-1">
                  <li>Browser-based neural network</li>
                  <li>Real-time ECG analysis</li>
                  <li>7 different ECG condition classifications</li>
                  <li>Local model storage</li>
                  <li>Interactive model inspector</li>
                </ul>
              </div>
              
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <h3 className="text-lg font-medium text-green-400 mb-2">Getting Started</h3>
                <ol className="list-decimal list-inside text-gray-300 space-y-1">
                  <li>Visit the <Link href="/train" className="text-blue-400 hover:underline">Training Page</Link></li>
                  <li>Train the model using the "Train Model" button</li>
                  <li>Inspect the model structure and weights</li>
                  <li>Return to the <Link href="/" className="text-blue-400 hover:underline">ECG Monitor</Link></li>
                  <li>Use the "Analyze ECG" button to get predictions</li>
                </ol>
              </div>
            </div>
          </div>
          
          <div className="bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Model Architecture</h2>
            <p className="text-gray-300 mb-4">
              The model uses a simple feed-forward neural network with the following layers:
            </p>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="px-4 py-2 text-blue-400">Layer</th>
                    <th className="px-4 py-2 text-blue-400">Type</th>
                    <th className="px-4 py-2 text-blue-400">Units</th>
                    <th className="px-4 py-2 text-blue-400">Activation</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-white/10">
                    <td className="px-4 py-2">Input</td>
                    <td className="px-4 py-2">Dense</td>
                    <td className="px-4 py-2">32</td>
                    <td className="px-4 py-2">ReLU</td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="px-4 py-2">Hidden</td>
                    <td className="px-4 py-2">Dense</td>
                    <td className="px-4 py-2">16</td>
                    <td className="px-4 py-2">ReLU</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Output</td>
                    <td className="px-4 py-2">Dense</td>
                    <td className="px-4 py-2">7</td>
                    <td className="px-4 py-2">Softmax</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Input Features</h2>
            <p className="text-gray-300 mb-4">
              The model accepts 10 input features that represent various ECG metrics:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-black/20 border border-white/10 rounded-lg">
                <h3 className="text-lg font-medium text-white mb-2">Time Intervals</h3>
                <ul className="text-gray-300 space-y-1">
                  <li><span className="text-blue-400">RR Interval:</span> Time between consecutive R peaks (ms)</li>
                  <li><span className="text-blue-400">Heart Rate:</span> Beats per minute (BPM)</li>
                  <li><span className="text-blue-400">PR Interval:</span> Time from P wave to QRS complex (ms)</li>
                  <li><span className="text-blue-400">QRS Duration:</span> Width of the QRS complex (ms)</li>
                  <li><span className="text-blue-400">QT Interval:</span> Time from QRS to end of T wave (ms)</li>
                  <li><span className="text-blue-400">QTc Interval:</span> Heart-rate corrected QT interval (ms)</li>
                </ul>
              </div>
              
              <div className="p-3 bg-black/20 border border-white/10 rounded-lg">
                <h3 className="text-lg font-medium text-white mb-2">Other Features</h3>
                <ul className="text-gray-300 space-y-1">
                  <li><span className="text-blue-400">ST Deviation:</span> ST segment elevation/depression (mm)</li>
                  <li><span className="text-blue-400">RMSSD:</span> Root mean square of successive RR interval differences (ms)</li>
                  <li><span className="text-blue-400">SDNN:</span> Standard deviation of NN intervals (ms)</li>
                  <li><span className="text-blue-400">LF/HF Ratio:</span> Ratio of low-frequency to high-frequency power</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}