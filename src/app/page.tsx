"use client";

import { useState, useEffect, useRef } from 'react';
import { useModel } from '@/providers/ModelProvider';
import EcgPanel from '../components/EcgPanel';

export default function HomePage() {
  const { predict } = useModel();
  const autoAnalyzeInterval = useRef<NodeJS.Timeout | null>(null);
  
  type EcgIntervals = {
    rr?: number;
    bpm?: number;
    pr?: number;
    qrs?: number;
    qt?: number;
    qtc?: number;
    stDeviation?: number;
  };

  type HrvMetrics = {
    rmssd?: number;
    sdnn?: number;
    lfhf?: { ratio?: number };
  };

  type ModelPrediction = {
    prediction: string;
    confidence: number;
  };

  const [ecgIntervals, setEcgIntervals] = useState<EcgIntervals | null>(null);
  const [hrvMetrics, setHrvMetrics] = useState<HrvMetrics | null>(null);
  const [modelPrediction, setModelPrediction] = useState<ModelPrediction | null>(null);

  // Extract ECG features from current data
  const extractEcgFeatures = () => {
    if (!ecgIntervals || !hrvMetrics) return null;
    
    return {
      rr: ecgIntervals.rr || 800,
      bpm: ecgIntervals.bpm || 75,
      pr: ecgIntervals.pr || 160,
      qrs: ecgIntervals.qrs || 90,
      qt: ecgIntervals.qt || 380,
      qtc: ecgIntervals.qtc || 420,
      stDeviation: ecgIntervals.stDeviation || 0,
      rmssd: hrvMetrics.rmssd || 35,
      sdnn: hrvMetrics.sdnn || 50,
      lfhf: hrvMetrics.lfhf?.ratio || 1.5
    };
  };
  
  // Run heart disease prediction
  const analyzeCurrent = async () => {
    const features = extractEcgFeatures();
    if (!features) {
      console.log('Cannot analyze: Missing ECG features');
      return;
    }
    
    const featureArray = [
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
    
    const result = await predict(featureArray);
    if (result) {
      setModelPrediction(result);
      console.log(`Prediction: ${result.prediction} (${result.confidence.toFixed(1)}% confidence)`);
    }
  };
  
  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      const interval = autoAnalyzeInterval.current;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);
  
  
  return (
    <div className="relative w-full h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <EcgPanel />
      
      {/* Heart Disease Prediction Result */}
      {modelPrediction && (
        <div className="absolute top-20 right-4 bg-black/70 backdrop-blur-md border border-white/20 rounded-lg p-4 text-white max-w-xs z-30">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <span className="text-blue-400">AI</span> Analysis
            </h3>
            <button 
              onClick={() => setModelPrediction(null)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          
          {/* Prediction headline */}
          <div className="p-3 rounded-lg border mb-3" style={{
            backgroundColor: getConditionColor(modelPrediction.prediction, true),
            borderColor: getConditionColor(modelPrediction.prediction, false),
          }}>
            <div className="text-xl font-bold mb-1" style={{
              color: getConditionColor(modelPrediction.prediction, false)
            }}>
              {getConditionIcon(modelPrediction.prediction)} {modelPrediction.prediction}
            </div>
            <div className="text-sm" style={{
              color: getConditionColor(modelPrediction.prediction, false)
            }}>
              {modelPrediction.confidence.toFixed(1)}% confidence
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions
function getConditionColor(condition: string, isBackground: boolean): string {
  const colors: Record<string, { bg: string, text: string }> = {
    "Normal": { bg: "rgba(34, 197, 94, 0.2)", text: "#22c55e" },
    "Bradycardia": { bg: "rgba(250, 204, 21, 0.2)", text: "#facc15" },
    "Tachycardia": { bg: "rgba(250, 204, 21, 0.2)", text: "#facc15" },
    "AFib": { bg: "rgba(249, 115, 22, 0.2)", text: "#f97316" },
    "STEMI": { bg: "rgba(239, 68, 68, 0.2)", text: "#ef4444" },
    "MyocardialIschemia": { bg: "rgba(239, 68, 68, 0.2)", text: "#ef4444" },
    "BundleBranchBlock": { bg: "rgba(59, 130, 246, 0.2)", text: "#3b82f6" }
  };
  
  return isBackground 
    ? colors[condition]?.bg || "rgba(148, 163, 184, 0.2)" 
    : colors[condition]?.text || "#94a3b8";
}

function getConditionIcon(condition: string): string {
  switch (condition) {
    case "Normal": return "✅";
    case "Bradycardia": return "⏬";
    case "Tachycardia": return "⏫";
    case "AFib": return "〰️";
    case "STEMI": return "🚨";
    case "MyocardialIschemia": return "⚠️";
    case "BundleBranchBlock": return "🔄";
    default: return "❓";
  }
}