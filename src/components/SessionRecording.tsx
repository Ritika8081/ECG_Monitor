import React, { useState, useEffect } from 'react';
import { 
  Play, Square, Clock, User, Save, FileText, 
  AlertTriangle, CheckCircle, Info, BarChart3
} from 'lucide-react';
import HRVMetrics from '../components/EcgPanel'; // or the correct path
import { PQRSTPoint } from '../lib/pqrstDetector';
import { ECGIntervals } from '../lib/ecgIntervals';
import { SessionAnalysisResults } from '../lib/sessionAnalyzer';

export type PatientInfo = {
  age: number;
  gender: 'male' | 'female';
  weight: number; // in kg
  height: number; // in cm
  medicalHistory: string[];
  medications: string[];
};

export type RecordingSession = {
  id: string;
  startTime: number;
  endTime: number | null;
  duration: number;
  patientInfo: PatientInfo;
  ecgData: number[];
  sampleRate: number;
  rPeaks: number[];
  pqrstPoints: PQRSTPoint[];
  // Add this new property
  intervals?: ECGIntervals | null;
}

export interface SessionRecordingProps {
  connected: boolean;
  onStartRecording: (patientInfo: PatientInfo) => void;
  onStopRecording: () => RecordingSession | null;
  isRecording: boolean;
  recordingTime: string;
  sessionResults?: SessionAnalysisResults | null;             
  setShowSessionReport?: React.Dispatch<React.SetStateAction<boolean>>;  
}

export default function SessionRecording({
  connected,
  onStartRecording,
  onStopRecording,
  isRecording,
  recordingTime
}: SessionRecordingProps) {
  const [showPatientInfo, setShowPatientInfo] = useState(false);
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    age: 30,
    gender: 'male',
    weight: 70,
    height: 170,
    medicalHistory: [],
    medications: []
  });
  const [showSessionReport, setShowSessionReport] = useState(false);
  const [sessionResults, setSessionResults] = useState<any>(null);
  
  // Medical history options
  const historyOptions = [
    'Hypertension',
    'Diabetes',
    'Previous Heart Attack',
    'Arrhythmia',
    'Heart Failure',
    'Stroke',
    'None'
  ];
  
  // Common medications
  const medicationOptions = [
    'Beta Blockers',
    'ACE Inhibitors',
    'Calcium Channel Blockers',
    'Statins',
    'Anticoagulants',
    'Diuretics',
    'None'
  ];
  
  const toggleHistory = (item: string) => {
    if (item === 'None') {
      setPatientInfo({...patientInfo, medicalHistory: []});
      return;
    }
    
    // Remove 'None' if it exists
    let newHistory = patientInfo.medicalHistory.filter(h => h !== 'None');
    
    if (newHistory.includes(item)) {
      newHistory = newHistory.filter(h => h !== item);
    } else {
      newHistory.push(item);
    }
    
    setPatientInfo({...patientInfo, medicalHistory: newHistory});
  };
  
  const toggleMedication = (item: string) => {
    if (item === 'None') {
      setPatientInfo({...patientInfo, medications: []});
      return;
    }
    
    // Remove 'None' if it exists
    let newMeds = patientInfo.medications.filter(m => m !== 'None');
    
    if (newMeds.includes(item)) {
      newMeds = newMeds.filter(m => m !== item);
    } else {
      newMeds.push(item);
    }
    
    setPatientInfo({...patientInfo, medications: newMeds});
  };
  
  const handleStartRecording = () => {
    onStartRecording(patientInfo);
    setShowPatientInfo(false);
  };
  
  const handleStopRecording = () => {
    const session = onStopRecording();
    // Remove this line, as it's setting local state which isn't connected to props
    // setSessionResults(session);
    
    // If you want to show the report immediately after stopping:
    if (setShowSessionReport && session) {
      setShowSessionReport(true);
    }
  };
  
  return (
    <>
      {/* Recording Controls */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50
                    bg-black/70 backdrop-blur-md border border-white/20 rounded-full
                    py-2 px-4 flex items-center gap-4">
        {!isRecording ? (
          <>
            <button
              onClick={() => setShowPatientInfo(true)}
              disabled={!connected}
              className={`flex items-center gap-2 rounded-full px-4 py-2
                        ${connected ? 'bg-red-500 hover:bg-red-600 text-white' :
                                    'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
            >
              <Play className="w-5 h-5" fill="currentColor" />
              Start Recording
            </button>
            
            {/* Add View Results button that appears if sessionResults exists */}
            {sessionResults && (
              <button
                onClick={() => setShowSessionReport(true)}
                className="flex items-center gap-2 rounded-full px-4 py-2
                          bg-blue-500 hover:bg-blue-600 text-white"
              >
                <BarChart3 className="w-5 h-5" />
                View Results
              </button>
            )}
          </>
        ) : (
          <>
            <button
              onClick={handleStopRecording}
              className="flex items-center gap-2 rounded-full px-4 py-2
                        bg-red-500 hover:bg-red-600 text-white"
            >
              <Square className="w-5 h-5" />
              Stop
            </button>
            <div className="flex items-center gap-2 text-white">
              <Clock className="w-4 h-4 text-red-400" />
              <span className="font-mono">{recordingTime}</span>
            </div>
            <div className="animate-pulse flex gap-2 items-center text-red-400">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              Recording
            </div>
          </>
        )}
      </div>
      
      {/* Patient Info Modal */}
      {showPatientInfo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/20 rounded-xl p-6 max-w-lg w-full">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-400" />
              Patient Information
            </h2>
            
            <div className="text-gray-300 text-sm mb-4">
              <p>This information helps improve the accuracy of ECG analysis.</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Age</label>
                <input
                  type="number"
                  value={patientInfo.age}
                  onChange={(e) => setPatientInfo({...patientInfo, age: parseInt(e.target.value) || 0})}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                />
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm mb-1">Gender</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPatientInfo({...patientInfo, gender: 'male'})}
                    className={`flex-1 py-2 rounded-lg text-sm ${
                      patientInfo.gender === 'male' 
                        ? 'bg-blue-500/30 border border-blue-500/60 text-blue-400' 
                        : 'bg-gray-800/50 border border-gray-700 text-gray-400'
                    }`}
                  >
                    Male
                  </button>
                  <button
                    onClick={() => setPatientInfo({...patientInfo, gender: 'female'})}
                    className={`flex-1 py-2 rounded-lg text-sm ${
                      patientInfo.gender === 'female' 
                        ? 'bg-pink-500/30 border border-pink-500/60 text-pink-400' 
                        : 'bg-gray-800/50 border border-gray-700 text-gray-400'
                    }`}
                  >
                    Female
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm mb-1">Weight (kg)</label>
                <input
                  type="number"
                  value={patientInfo.weight}
                  onChange={(e) => setPatientInfo({...patientInfo, weight: parseInt(e.target.value) || 0})}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                />
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm mb-1">Height (cm)</label>
                <input
                  type="number"
                  value={patientInfo.height}
                  onChange={(e) => setPatientInfo({...patientInfo, height: parseInt(e.target.value) || 0})}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                />
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-300 text-sm mb-1">Medical History</label>
              <div className="flex flex-wrap gap-2">
                {historyOptions.map(option => (
                  <button
                    key={option}
                    onClick={() => toggleHistory(option)}
                    className={`text-xs rounded-full px-3 py-1 border ${
                      patientInfo.medicalHistory.includes(option)
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                        : 'bg-gray-800 border-gray-700 text-gray-400'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-300 text-sm mb-1">Current Medications</label>
              <div className="flex flex-wrap gap-2">
                {medicationOptions.map(option => (
                  <button
                    key={option}
                    onClick={() => toggleMedication(option)}
                    className={`text-xs rounded-full px-3 py-1 border ${
                      patientInfo.medications.includes(option)
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                        : 'bg-gray-800 border-gray-700 text-gray-400'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300 mb-6 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p>All information is stored locally on your device and is not transmitted elsewhere. This data helps improve analysis accuracy.</p>
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={() => setShowPatientInfo(false)}
                className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleStartRecording}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center gap-2"
              >
                <Play className="w-4 h-4" fill="currentColor" />
                Start Recording
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Session Results Report */}
      {showSessionReport && sessionResults && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/20 rounded-xl p-6 max-w-lg w-full overflow-auto max-h-[90vh]">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-green-400" />
              Session Results
            </h2>
            
            {/* Add detailed results view here.
                For now, just showing dummy values. Replace with actual data. */}
            <div className="text-gray-300 text-sm mb-4">
              <p><strong>Duration:</strong> {sessionResults.duration} seconds</p>
              <p><strong>Start Time:</strong> {new Date(sessionResults.startTime).toLocaleString()}</p>
              <p><strong>End Time:</strong> {sessionResults.endTime ? new Date(sessionResults.endTime).toLocaleString() : 'In Progress'}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">HRV Metrics</h3>
                <p><strong>RMSSD:</strong> {sessionResults.hrvMetrics?.rmssd.toFixed(2)} ms</p>
                <p><strong>SDNN:</strong> {sessionResults.hrvMetrics?.sdnn.toFixed(2)} ms</p>
                <p><strong>LF/HF Ratio:</strong> {sessionResults.hrvMetrics?.lfhf.ratio.toFixed(2)}</p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">ECG Intervals</h3>
                <p><strong>RR Interval:</strong> {sessionResults.ecgIntervals?.rr.toFixed(2)} ms</p>
                <p><strong>BPM:</strong> {sessionResults.ecgIntervals?.bpm.toFixed(2)}</p>
                <p><strong>PR Interval:</strong> {sessionResults.ecgIntervals?.pr.toFixed(2)} ms</p>
                <p><strong>QRS Duration:</strong> {sessionResults.ecgIntervals?.qrs.toFixed(2)} ms</p>
                <p><strong>QT Interval:</strong> {sessionResults.ecgIntervals?.qt.toFixed(2)} ms</p>
                <p><strong>QTc Interval:</strong> {sessionResults.ecgIntervals?.qtc.toFixed(2)} ms</p>
              </div>
            </div>
            
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white mb-2">ST Segment Data</h3>
              <p><strong>Deviation:</strong> {sessionResults.stSegmentData?.deviation.toFixed(2)} mm</p>
              <p><strong>Status:</strong> {sessionResults.stSegmentData?.status}</p>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSessionReport(false)}
                className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Close
              </button>
              
              <button
                onClick={() => {/* Add export functionality here */}}
                className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white"
              >
                Export Results
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Dummy example values for ecgIntervals and other variables to prevent errors.
// Replace these with actual computed values from your ECG analysis logic.
const ecgIntervals = {
  rr: 0,
  bpm: 0,
  pr: 0,
  qrs: 0,
  qt: 0,
  qtc: 0,
};
const stSegmentData = { deviation: 0 };
const hrvMetrics = { rmssd: 0, sdnn: 0, lfhf: { ratio: 0 } };

const features = [
  ecgIntervals.rr,        // ❌ Missing or zero
  ecgIntervals.bpm,       // ❌ Missing or zero
  ecgIntervals.pr,        // ❌ Shows 0 ms
  ecgIntervals.qrs,       // ❌ Shows 0 ms
  ecgIntervals.qt,        // ❌ Shows 0 ms
  ecgIntervals.qtc,       // ❌ Shows 0 ms
  stSegmentData?.deviation || 0,  // ❌ Shows 0 mm
  hrvMetrics?.rmssd || 0,  // ✅ Shows 314.7 ms
  hrvMetrics?.sdnn || 0,   // ✅ Shows 219.5 ms
  hrvMetrics?.lfhf?.ratio || 0,  // ✅ Shows 1.14
];