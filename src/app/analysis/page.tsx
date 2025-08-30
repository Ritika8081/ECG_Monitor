// src/app/analysis/page.tsx
"use client";

import { useState } from 'react';
import HeartDiseaseAnalysis from '@/components/HeartDiseaseAnalysis';
import { trainECGModel } from '../../lib/modelTrainer';

// Default features for manual input
const defaultFeatures = {
  rr: 0,
  bpm: 0,
  pr: 0,
  qrs: 0,
  qt: 0,
  qtc: 0,
  stDeviation: 0,
  rmssd: 0,
  sdnn: 0,
  lfhf: 0
};

export default function AnalysisPage() {
  const [features, setFeatures] = useState(defaultFeatures);
  
  // Handle feature input changes
  const handleFeatureChange = (feature: string, value: string) => {
    setFeatures(prev => ({
      ...prev,
      [feature]: parseFloat(value) || 0
    }));
  };
  
  // Preset conditions for quick testing
  const presetConditions = {
    "Normal": [800, 75, 160, 90, 380, 420, 0.0, 35, 50, 1.5],
    "Bradycardia": [950, 60, 180, 100, 380, 450, 0.1, 30, 40, 2.0],
    "Tachycardia": [450, 130, 160, 90, 360, 390, -0.3, 28, 45, 3.5],
    "BundleBranchBlock": [860, 72, 220, 140, 390, 470, 0.6, 45, 42, 1.9],
    "STEMI": [800, 75, 160, 100, 420, 460, 1.0, 35, 30, 1.2],
    "MyocardialIschemia": [810, 77, 160, 110, 380, 440, -0.6, 50, 30, 1.1],
    "AFib": [870, 90, 170, 90, 390, 430, 0.3, 40, 28, 2.2]
  } as const;

  type PresetCondition = keyof typeof presetConditions;
  
  // Load preset condition
  const loadPreset = (condition: PresetCondition) => {
    const preset = presetConditions[condition];
    if (!preset) return;
    
    setFeatures({
      rr: preset[0],
      bpm: preset[1],
      pr: preset[2],
      qrs: preset[3],
      qt: preset[4],
      qtc: preset[5],
      stDeviation: preset[6],
      rmssd: preset[7],
      sdnn: preset[8],
      lfhf: preset[9]
    });
  };
  
  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-auto">
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-white mb-6">ECG Feature Analysis</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Panel */}
          <div className="bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">ECG Features Input</h2>
            
            <div className="mb-6">
              <h3 className="text-white font-medium mb-3">Presets</h3>
              <div className="flex flex-wrap gap-2">
                {Object.keys(presetConditions).map(condition => (
                  <button
                    key={condition}
                    onClick={() => loadPreset(condition as PresetCondition)}
                    className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-sm hover:bg-blue-500/30"
                  >
                    {condition}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  RR Interval (ms)
                </label>
                <input 
                  type="number" 
                  value={features.rr}
                  onChange={(e) => handleFeatureChange('rr', e.target.value)}
                  className="w-full bg-black/30 text-white border border-white/20 rounded px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Heart Rate (BPM)
                </label>
                <input 
                  type="number" 
                  value={features.bpm}
                  onChange={(e) => handleFeatureChange('bpm', e.target.value)}
                  className="w-full bg-black/30 text-white border border-white/20 rounded px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  PR Interval (ms)
                </label>
                <input 
                  type="number" 
                  value={features.pr}
                  onChange={(e) => handleFeatureChange('pr', e.target.value)}
                  className="w-full bg-black/30 text-white border border-white/20 rounded px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  QRS Duration (ms)
                </label>
                <input 
                  type="number" 
                  value={features.qrs}
                  onChange={(e) => handleFeatureChange('qrs', e.target.value)}
                  className="w-full bg-black/30 text-white border border-white/20 rounded px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  QT Interval (ms)
                </label>
                <input 
                  type="number" 
                  value={features.qt}
                  onChange={(e) => handleFeatureChange('qt', e.target.value)}
                  className="w-full bg-black/30 text-white border border-white/20 rounded px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  QTc Interval (ms)
                </label>
                <input 
                  type="number" 
                  value={features.qtc}
                  onChange={(e) => handleFeatureChange('qtc', e.target.value)}
                  className="w-full bg-black/30 text-white border border-white/20 rounded px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  ST Deviation (mm)
                </label>
                <input 
                  type="number" 
                  value={features.stDeviation}
                  onChange={(e) => handleFeatureChange('stDeviation', e.target.value)}
                  className="w-full bg-black/30 text-white border border-white/20 rounded px-3 py-2"
                  step="0.1"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  RMSSD (ms)
                </label>
                <input 
                  type="number" 
                  value={features.rmssd}
                  onChange={(e) => handleFeatureChange('rmssd', e.target.value)}
                  className="w-full bg-black/30 text-white border border-white/20 rounded px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  SDNN (ms)
                </label>
                <input 
                  type="number" 
                  value={features.sdnn}
                  onChange={(e) => handleFeatureChange('sdnn', e.target.value)}
                  className="w-full bg-black/30 text-white border border-white/20 rounded px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  LF/HF Ratio
                </label>
                <input 
                  type="number" 
                  value={features.lfhf}
                  onChange={(e) => handleFeatureChange('lfhf', e.target.value)}
                  className="w-full bg-black/30 text-white border border-white/20 rounded px-3 py-2"
                  step="0.1"
                />
              </div>
            </div>
            
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-4">
              <p className="text-sm text-gray-300">
                Enter ECG feature values manually or select a preset condition to analyze.
              </p>
            </div>
          </div>
          
          {/* Analysis Panel */}
          <HeartDiseaseAnalysis features={features} />
        </div>
      </div>
    </div>
  );
}