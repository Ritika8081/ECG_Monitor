// src/components/HeartDiseaseAnalysis.tsx
"use client";

import { useState } from 'react';
import { useModel } from '@/providers/ModelProvider';

// Define the types of heart disease your model can detect
const heartDiseaseTypes = {
  "Normal": {
    description: "ECG features are within normal ranges.",
    color: "#22c55e",
    icon: "✅",
    severity: "none"
  },
  "Bradycardia": {
    description: "Slow heart rate (< 60 BPM). May require attention if symptomatic.",
    color: "#facc15",
    icon: "⏬",
    severity: "moderate"
  },
  "Tachycardia": {
    description: "Fast heart rate (> 100 BPM). Monitor for symptoms.",
    color: "#facc15",
    icon: "⏫",
    severity: "moderate"
  },
  "BundleBranchBlock": {
    description: "Delayed conduction through heart ventricles. May require follow-up.",
    color: "#3b82f6",
    icon: "🔄",
    severity: "moderate"
  },
  "STEMI": {
    description: "ST elevation suggesting possible myocardial infarction. MEDICAL EMERGENCY.",
    color: "#ef4444",
    icon: "🚨",
    severity: "high"
  },
  "MyocardialIschemia": {
    description: "Possible restricted blood flow to heart muscle. Requires medical attention.",
    color: "#ef4444",
    icon: "⚠️",
    severity: "high"
  },
  "AFib": {
    description: "Irregular rhythm with possible high HRV imbalance.",
    color: "#f97316",
    icon: "〰️",
    severity: "high"
  }
};

type EcgFeatures = {
  rr: number;
  bpm: number;
  pr: number;
  qrs: number;
  qt: number;
  qtc: number;
  stDeviation: number;
  rmssd: number;
  sdnn: number;
  lfhf: number;
};

export default function HeartDiseaseAnalysis({ 
  features,
  onClose
}: { 
  features: EcgFeatures; 
  onClose?: () => void;
}) {
  const { isLoading, error, predict } = useModel();
  const [prediction, setPrediction] = useState<{
    prediction: keyof typeof heartDiseaseTypes;
    confidence: number;
    allProbabilities: Array<{
      label: string;
      probability: number;
    }>;
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
  // Convert features object to array in the correct order
  const getFeatureArray = () => [
    features.rr,
    features.bpm,
    features.pr,
    features.qrs,
    features.qt,
    features.qtc,
    features.stDeviation,
    features.rmssd,
    features.sdnn,
    features.lfhf
  ];
  
  const analyzeFeatures = async () => {
    setAnalyzing(true);
    const featureArray = getFeatureArray();
    const result = await predict(featureArray);
    setPrediction(result as {
      prediction: keyof typeof heartDiseaseTypes;
      confidence: number;
      allProbabilities: Array<{
        label: string;
        probability: number;
      }>;
    });
    setAnalyzing(false);
  };
  
  if (isLoading) {
    return (
      <div className="p-4 bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl">
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2"></div>
          <span className="text-blue-400">Loading model...</span>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl">
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <h3 className="text-red-400 font-medium mb-2">Error Loading Model</h3>
          <p className="text-white text-sm">{error}</p>
          <p className="text-gray-400 text-sm mt-2">
            Please make sure you have trained the model first by visiting the Training page.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4 bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Heart Disease Analysis</h2>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>
      
      {!prediction ? (
        <>
          <div className="mb-4">
            <h3 className="text-white font-medium mb-2">ECG Features</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 bg-black/20 rounded">
                <span className="text-gray-400">RR Interval:</span> <span className="text-white">{features.rr} ms</span>
              </div>
              <div className="p-2 bg-black/20 rounded">
                <span className="text-gray-400">Heart Rate:</span> <span className="text-white">{features.bpm} BPM</span>
              </div>
              <div className="p-2 bg-black/20 rounded">
                <span className="text-gray-400">PR Interval:</span> <span className="text-white">{features.pr} ms</span>
              </div>
              <div className="p-2 bg-black/20 rounded">
                <span className="text-gray-400">QRS Duration:</span> <span className="text-white">{features.qrs} ms</span>
              </div>
              <div className="p-2 bg-black/20 rounded">
                <span className="text-gray-400">QT Interval:</span> <span className="text-white">{features.qt} ms</span>
              </div>
              <div className="p-2 bg-black/20 rounded">
                <span className="text-gray-400">QTc Interval:</span> <span className="text-white">{features.qtc} ms</span>
              </div>
              <div className="p-2 bg-black/20 rounded">
                <span className="text-gray-400">ST Deviation:</span> <span className="text-white">{features.stDeviation} mm</span>
              </div>
              <div className="p-2 bg-black/20 rounded">
                <span className="text-gray-400">RMSSD:</span> <span className="text-white">{features.rmssd} ms</span>
              </div>
              <div className="p-2 bg-black/20 rounded">
                <span className="text-gray-400">SDNN:</span> <span className="text-white">{features.sdnn} ms</span>
              </div>
              <div className="p-2 bg-black/20 rounded">
                <span className="text-gray-400">LF/HF Ratio:</span> <span className="text-white">{features.lfhf}</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={analyzeFeatures}
            disabled={analyzing}
            className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center ${
              analyzing 
                ? 'bg-blue-500/30 text-blue-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {analyzing ? (
              <>
                <div className="w-5 h-5 border-2 border-blue-300 border-t-transparent rounded-full animate-spin mr-2"></div>
                Analyzing...
              </>
            ) : (
              'Analyze ECG Features'
            )}
          </button>
        </>
      ) : (
        <div>
          {/* Prediction result */}
          <div className="p-3 rounded-lg border mb-3" style={{
            backgroundColor: `${heartDiseaseTypes[prediction.prediction]?.color}20` || '#94a3b820',
            borderColor: `${heartDiseaseTypes[prediction.prediction]?.color}40` || '#94a3b840',
          }}>
            <div className="text-xl font-bold mb-1" style={{
              color: heartDiseaseTypes[prediction.prediction]?.color || '#94a3b8'
            }}>
              {heartDiseaseTypes[prediction.prediction]?.icon || '❓'} {prediction.prediction}
            </div>
            <div className="text-sm" style={{
              color: heartDiseaseTypes[prediction.prediction]?.color || '#94a3b8'
            }}>
              {prediction.confidence.toFixed(1)}% confidence
            </div>
          </div>
          
          {/* Confidence meter */}
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">Confidence</span>
              <span className="text-gray-400">{prediction.confidence.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full" 
                style={{ 
                  width: `${prediction.confidence}%`,
                  backgroundColor: getColorForConfidence(prediction.confidence)
                }}
              />
            </div>
          </div>
          
          {/* Description */}
          <div className="mb-4 p-3 bg-black/20 rounded-lg text-sm text-gray-300">
            {heartDiseaseTypes[prediction.prediction]?.description || 
              "No description available for this condition."}
          </div>
          
          {/* All probabilities toggle */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-blue-400 hover:text-blue-300 flex items-center mb-3"
          >
            {showDetails ? 'Hide' : 'Show'} all probabilities
            <svg className="w-4 h-4 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
                showDetails ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"
              } />
            </svg>
          </button>
          
          {/* All probabilities */}
          {showDetails && (
            <div className="space-y-1.5 mb-4">
              {prediction.allProbabilities.map((item, index) => (
                <div key={index} className="flex items-center">
                  <div className="w-32 text-xs text-gray-300 truncate">{item.label}</div>
                  <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full" 
                      style={{ 
                        width: `${item.probability}%`,
                        backgroundColor: getColorForConfidence(item.probability)
                      }}
                    />
                  </div>
                  <div className="w-12 text-right text-xs text-gray-300 ml-2">
                    {item.probability.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* New analysis button */}
          <button
            onClick={() => setPrediction(null)}
            className="w-full py-2 px-4 rounded-lg font-medium bg-gray-700 hover:bg-gray-600 text-white"
          >
            New Analysis
          </button>
          
          <div className="mt-3 pt-3 border-t border-white/10 text-xs text-gray-400">
            <p>This is an AI analysis based on extracted ECG features.</p>
            <p className="mt-1">Always consult a healthcare professional for accurate diagnosis.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function for color based on confidence
function getColorForConfidence(confidence: number): string {
  if (confidence > 90) return '#22c55e'; // green
  if (confidence > 75) return '#4ade80'; // light green
  if (confidence > 60) return '#facc15'; // yellow
  if (confidence > 40) return '#f97316'; // orange
  return '#ef4444'; // red
}