import React from 'react';
import { SessionAnalysisResults } from '../lib/sessionAnalyzer';
import { PatientInfo } from './SessionRecording';
import { 
  FileText, User, Clock, Activity, Heart, TrendingUp, 
  Zap, AlertTriangle, ClipboardList
} from 'lucide-react';

interface SessionReportProps {
  analysisResults: SessionAnalysisResults;
  patientInfo: PatientInfo;
  sessionDate: Date;
  onClose: () => void;
  onSaveReport: () => void;
}

export default function SessionReport({
  analysisResults,
  patientInfo,
  sessionDate,
  onClose,
  onSaveReport
}: SessionReportProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-auto">
      <div className="bg-slate-900 border border-white/20 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
        {/* Report Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-white/10 p-6 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            ECG Session Report
          </h2>
          
          <div className="flex gap-3">
            <button
              onClick={onSaveReport}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            >
              <ClipboardList className="w-4 h-4" />
              Save Report
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        </div>
        
        <div className="p-6">
          {/* Session Info */}
          <div className="mb-6 grid grid-cols-2 gap-6">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
              <h3 className="text-white font-medium flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-blue-400" />
                Session Information
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-400">Date:</div>
                <div className="text-white">{sessionDate.toLocaleDateString()}</div>
                <div className="text-gray-400">Time:</div>
                <div className="text-white">{sessionDate.toLocaleTimeString()}</div>
                <div className="text-gray-400">Duration:</div>
                <div className="text-white">{analysisResults.summary.recordingDuration}</div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
              <h3 className="text-white font-medium flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-blue-400" />
                Patient Information
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-400">Age:</div>
                <div className="text-white">{patientInfo.age} years</div>
                <div className="text-gray-400">Gender:</div>
                <div className="text-white">{patientInfo.gender === 'male' ? 'Male' : 'Female'}</div>
                <div className="text-gray-400">Weight:</div>
                <div className="text-white">{patientInfo.weight} kg</div>
                <div className="text-gray-400">Height:</div>
                <div className="text-white">{patientInfo.height} cm</div>
              </div>
            </div>
          </div>
          
          {/* AI Classification */}
          <div className="mb-6">
            <div className={`p-4 rounded-lg border ${
              analysisResults.aiClassification.prediction === "Normal Sinus Rhythm"
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-yellow-500/10 border-yellow-500/30'
            }`}>
              <h3 className="text-lg font-medium flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                ECG Pattern Analysis
              </h3>
              
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-300">Classification:</span>
                <span className="font-bold text-lg" style={{ 
                  color: analysisResults.aiClassification.prediction === "Normal Sinus Rhythm" 
                    ? "#22c55e" : "#f59e0b" 
                }}>
                  {analysisResults.aiClassification.prediction}
                </span>
              </div>
              
              <div className="w-full bg-gray-700 rounded-full h-1.5 mb-1">
                <div 
                  className="h-1.5 rounded-full" 
                  style={{ 
                    width: `${analysisResults.aiClassification.confidence}%`,
                    backgroundColor: analysisResults.aiClassification.prediction === "Normal Sinus Rhythm" 
                      ? "#22c55e" : "#f59e0b"
                  }}
                ></div>
              </div>
              
              <p className="text-sm text-gray-300 mt-3">
                {analysisResults.aiClassification.explanation}
              </p>
            </div>
          </div>
          
          {/* Heart Rate and Rhythm */}
          <div className="mb-6">
            <h3 className="text-white font-medium flex items-center gap-2 mb-3">
              <Heart className="w-4 h-4 text-red-400" />
              Heart Rate and Rhythm
            </h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Average Heart Rate</div>
                <div className={`font-bold text-2xl ${
                  analysisResults.summary.heartRate.status === 'normal' ? 'text-green-400' :
                  analysisResults.summary.heartRate.status === 'bradycardia' ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {analysisResults.summary.heartRate.average.toFixed(1)} <span className="text-sm">BPM</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {analysisResults.summary.heartRate.status === 'normal' ? 'Normal Range' :
                   analysisResults.summary.heartRate.status === 'bradycardia' ? 'Bradycardia (Slow)' :
                   'Tachycardia (Fast)'}
                </div>
              </div>
              
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Range</div>
                <div className="font-medium">
                  <span className="text-blue-400">{analysisResults.summary.heartRate.min.toFixed(0)}</span>
                  <span className="text-gray-500 mx-2">-</span>
                  <span className="text-red-400">{analysisResults.summary.heartRate.max.toFixed(0)}</span>
                  <span className="text-sm text-gray-400 ml-1">BPM</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Min - Max Heart Rate
                </div>
              </div>
              
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Rhythm Regularity</div>
                <div className="font-medium">
                  <span className={
                    analysisResults.summary.rhythm.percentIrregular < 5 ? 'text-green-400' :
                    analysisResults.summary.rhythm.percentIrregular < 15 ? 'text-yellow-400' :
                    'text-red-400'
                  }>
                    {(100 - analysisResults.summary.rhythm.percentIrregular).toFixed(1)}%
                  </span>
                  <span className="text-sm text-gray-400 ml-1">Regular</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {analysisResults.summary.rhythm.irregularBeats} irregular beats detected
                </div>
              </div>
            </div>
          </div>
          
          {/* ECG Intervals */}
          <div className="mb-6">
            <h3 className="text-white font-medium flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-blue-400" />
              ECG Intervals
            </h3>
            
            <div className="grid grid-cols-5 gap-3">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">PR Interval</div>
                <div className={`font-bold text-lg ${
                  analysisResults.intervals.pr.status === 'normal' ? 'text-green-400' :
                  analysisResults.intervals.pr.status === 'short' ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {analysisResults.intervals.pr.average.toFixed(0)} <span className="text-xs">ms</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {analysisResults.intervals.pr.status === 'normal' ? 'Normal' :
                   analysisResults.intervals.pr.status === 'short' ? 'Short' : 'Prolonged'}
                </div>
              </div>
              
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">QRS Duration</div>
                <div className={`font-bold text-lg ${
                  analysisResults.intervals.qrs.status === 'normal' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {analysisResults.intervals.qrs.average.toFixed(0)} <span className="text-xs">ms</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {analysisResults.intervals.qrs.status === 'normal' ? 'Normal' : 'Wide'}
                </div>
              </div>
              
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">QT Interval</div>
                <div className="font-bold text-lg text-gray-200">
                  {analysisResults.intervals.qt.average.toFixed(0)} <span className="text-xs">ms</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Raw measurement
                </div>
              </div>
              
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">QTc Interval</div>
                <div className={`font-bold text-lg ${
                  analysisResults.intervals.qtc.status === 'normal' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {analysisResults.intervals.qtc.average.toFixed(0)} <span className="text-xs">ms</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {analysisResults.intervals.qtc.status === 'normal' ? 'Normal' : 'Prolonged'}
                </div>
              </div>
              
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">ST Segment</div>
                <div className={`font-bold text-lg ${
                  analysisResults.intervals.st.status === 'normal' ? 'text-green-400' :
                  analysisResults.intervals.st.status === 'elevation' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {analysisResults.intervals.st.deviation.toFixed(2)} <span className="text-xs">mm</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {analysisResults.intervals.st.status === 'normal' ? 'Normal' :
                   analysisResults.intervals.st.status === 'elevation' ? 'Elevated' : 'Depressed'}
                </div>
              </div>
            </div>
          </div>
          
          {/* HRV Analysis */}
          <div className="mb-6">
            <h3 className="text-white font-medium flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              Heart Rate Variability
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">RMSSD</div>
                    <div className="font-bold text-lg text-green-400">
                      {analysisResults.hrv.timeMetrics.rmssd.toFixed(1)} <span className="text-xs">ms</span>
                    </div>
                  </div>
                  
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">SDNN</div>
                    <div className="font-bold text-lg text-blue-400">
                      {analysisResults.hrv.timeMetrics.sdnn.toFixed(1)} <span className="text-xs">ms</span>
                    </div>
                  </div>
                  
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">pNN50</div>
                    <div className="font-bold text-lg text-yellow-400">
                      {analysisResults.hrv.timeMetrics.pnn50.toFixed(1)} <span className="text-xs">%</span>
                    </div>
                  </div>
                  
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">LF/HF Ratio</div>
                    <div className="font-bold text-lg text-orange-400">
                      {analysisResults.hrv.frequencyMetrics.lfhfRatio.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <div className="text-gray-400 text-sm">Physiological State:</div>
                  <div className="font-medium" style={{ 
                    color: 
                      analysisResults.hrv.physiologicalState.state === "High Stress" ? "#ef4444" : 
                      analysisResults.hrv.physiologicalState.state === "Relaxed" ? "#22c55e" : 
                      analysisResults.hrv.physiologicalState.state === "Focused" ? "#3b82f6" : 
                      analysisResults.hrv.physiologicalState.state === "Fatigue" ? "#f97316" : "#94a3b8" 
                  }}>
                    {analysisResults.hrv.physiologicalState.state}
                  </div>
                </div>
                
                <div className="flex justify-between mb-3">
                  <div className="text-gray-400 text-sm">HRV Status:</div>
                  <div className="font-medium" style={{ color: analysisResults.hrv.assessment.status }}>
                    {analysisResults.hrv.assessment.status}
                  </div>
                </div>
                
                <div className="text-sm text-gray-300">
                  {analysisResults.hrv.assessment.description}
                </div>
              </div>
            </div>
          </div>
          
          {/* Findings and Recommendations */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Abnormalities */}
            <div>
              <h3 className="text-white font-medium flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                Potential Findings
              </h3>
              
              {analysisResults.abnormalities.length > 0 ? (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
                  <ul className="space-y-3">
                    {analysisResults.abnormalities.map((abnormality, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className={`w-2 h-2 rounded-full mt-1.5 ${
                          abnormality.severity === 'high' ? 'bg-red-500' :
                          abnormality.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                        }`}></span>
                        <div>
                          <div className={`font-medium ${
                            abnormality.severity === 'high' ? 'text-red-400' :
                            abnormality.severity === 'medium' ? 'text-yellow-400' : 'text-blue-400'
                          }`}>
                            {abnormality.type}
                          </div>
                          <div className="text-sm text-gray-300">
                            {abnormality.description}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="font-medium text-green-400">No Abnormalities Detected</div>
                  <div className="text-sm text-gray-300 mt-1">
                    All measured parameters appear to be within normal ranges.
                  </div>
                </div>
              )}
            </div>
            
            {/* Recommendations */}
            <div>
              <h3 className="text-white font-medium flex items-center gap-2 mb-3">
                <ClipboardList className="w-4 h-4 text-blue-400" />
                Recommendations
              </h3>
              
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
                <ul className="space-y-2">
                  {analysisResults.recommendations.map((recommendation, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-blue-400">•</span>
                      <span className="text-gray-300">{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          
          {/* Disclaimer */}
          <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-4 text-sm text-red-300">
            <div className="font-medium mb-1">IMPORTANT DISCLAIMER</div>
            <p>
              This is not a medical device and is not intended for diagnosis or treatment decisions. 
              The analysis provided is based on a simplified algorithm and should be reviewed by a 
              healthcare professional. Please consult with a qualified medical practitioner before 
              making any health-related decisions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}