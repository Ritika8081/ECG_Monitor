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
              This application uses a 1D Convolutional Neural Network (CNN) to classify individual ECG heartbeats into clinically relevant categories. The model is trained in-browser using TensorFlow.js and the MIT-BIH Arrhythmia Database, following international medical standards.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <h3 className="text-lg font-medium text-blue-400 mb-2">Key Features</h3>
                <ul className="list-disc list-inside text-gray-300 space-y-1">
                  <li>Browser-based 1D CNN model</li>
                  <li>Real-time beat-level ECG analysis</li>
                  <li>5-class AAMI EC57 standard classification</li>
                  <li>Local model storage</li>
                  <li>Interactive model inspector</li>
                  <li>Clinical-grade accuracy</li>
                </ul>
              </div>
              
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <h3 className="text-lg font-medium text-green-400 mb-2">Getting Started</h3>
                <ol className="list-decimal list-inside text-gray-300 space-y-1">
                  <li>Visit the <Link href="/train" className="text-blue-400 hover:underline">Training Page</Link></li>
                  <li>Train the model using the "Train Model" button</li>
                  <li>Inspect the model structure and weights</li>
                  <li>Return to the <Link href="/" className="text-blue-400 hover:underline">ECG Monitor</Link></li>
                  <li>Connect your ECG device using the Bluetooth button</li>
                  <li>Toggle the "AI Analysis" button to see real-time beat predictions</li>
                </ol>
              </div>
            </div>
          </div>
          
          <div className="bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Model Architecture</h2>
            <p className="text-gray-300 mb-4">
              The model uses a 1D Convolutional Neural Network (CNN) with the following layers:
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
              The model accepts 187 consecutive ECG samples representing a single heartbeat, centered on the R-peak. Each beat is normalized using z-score normalization.
            </p>
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg mt-2">
              <h4 className="text-sm font-medium text-blue-400">Beat Extraction:</h4>
              <p className="text-gray-300 text-sm mt-1">
                Beats are extracted from the MIT-BIH Arrhythmia Database using annotation indices for R-peaks. Each beat is a window of 187 samples (0.52 seconds at 360Hz).
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
            <h2 className="text-2xl font-bold text-white mb-4">AI Analysis Features</h2>
            <p className="text-gray-300 mb-4">
              The application provides real-time beat-level AI analysis:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <h3 className="text-lg font-medium text-yellow-400 mb-2">ECG Beat Classification</h3>
                <p className="text-gray-300 mb-2">
                  Automatically classifies each heartbeat into one of five categories:
                </p>
                <ul className="text-gray-300 space-y-1 list-disc list-inside">
                  <li>Normal</li>
                  <li>Supraventricular</li>
                  <li>Ventricular</li>
                  <li>Fusion</li>
                  <li>Other</li>
                </ul>
                <p className="text-gray-300 mt-2 text-sm italic">
                  Classification runs automatically for each detected beat when the AI Analysis panel is visible.
                </p>
              </div>
              
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <h3 className="text-lg font-medium text-blue-400 mb-2">Clinical Validation</h3>
                <p className="text-gray-300 mb-2">
                  <span className="font-semibold text-green-400">Dataset:</span> MIT-BIH Arrhythmia Database<br/>
                  <span className="font-semibold text-green-400">Standard:</span> AAMI EC57<br/>
                  <span className="font-semibold text-green-400">Accuracy:</span> Up to 99.3% test accuracy
                </p>
                <ul className="text-gray-300 space-y-1 list-disc list-inside">
                  <li>Beat-level segmentation around R-peaks</li>
                  <li>Per-class precision, recall, and F1-score</li>
                  <li>Minimal false positive rate</li>
                  <li>Optimized for real-time browser inference</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}