"use client";
import React, { useEffect, useRef, useState } from "react";
import { Heart, Bluetooth, Eye, EyeOff, Activity, Timer, Zap, BarChart3, TrendingUp } from "lucide-react";
import { WebglPlot, WebglLine, ColorRGBA } from "webgl-plot";
import { BPMCalculator } from '../lib/bpmCalculator';
import { NotchFilter, ECGFilter } from '../lib/filters';
import { HRVCalculator } from '../lib/hrvCalculator';
import { PQRSTDetector, PQRSTPoint } from '../lib/pqrstDetector';
import { PanTompkinsDetector } from '../lib/panTompkinsDetector';

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const DATA_CHAR_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const CONTROL_CHAR_UUID = "0000ff01-0000-1000-8000-00805f9b34fb";

const NUM_POINTS = 1200;
const SAMPLE_RATE = 500;
const SINGLE_SAMPLE_LEN = 7;
const NEW_PACKET_LEN = 7 * 10;

export default function EcgFullPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [connected, setConnected] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [bpmDisplay, setBpmDisplay] = useState("-- BPM");
  const [peaksVisible, setPeaksVisible] = useState(true);
  const [timer, setTimer] = useState("00:00");
  const [showHRV, setShowHRV] = useState(false);
  const [showPQRST, setShowPQRST] = useState(false);
  const [signalQuality, setSignalQuality] = useState<'good' | 'poor' | 'no-signal'>('no-signal');

  // Update this state for physiological state
  const [physioState, setPhysioState] = useState<{ state: string; confidence: number }>({ 
    state: "Analyzing", 
    confidence: 0 
  });

  type HRVMetrics = {
    sampleCount: number;
    assessment: {
      color: string;
      status: string;
      description: string;
    };
    rmssd: number;
    sdnn: number;
    pnn50: number;
    triangularIndex: number;
    lfhf: {
      lf: number;
      hf: number;
      ratio: number;
    };
    // Add any other fields returned by getAllMetrics()
  };

  const [hrvMetrics, setHrvMetrics] = useState<HRVMetrics | null>(null);

  const wglpRef = useRef<WebglPlot | null>(null);
  const lineRef = useRef<WebglLine | null>(null);
  const peakLineRef = useRef<WebglLine | null>(null);
  const dataCh0 = useRef(new Array(NUM_POINTS).fill(0));
  const peakData = useRef(new Array(NUM_POINTS).fill(0));
  const sampleIndex = useRef(0);
  const notch = useRef(new NotchFilter());
  const ecg = useRef(new ECGFilter());
  const bpmCalculator = useRef(new BPMCalculator(SAMPLE_RATE, 5, 40, 200));
  const hrvCalculator = useRef(new HRVCalculator()); // Add HRV calculator
  const pqrstDetector = useRef(new PQRSTDetector(SAMPLE_RATE));
  const pqrstPoints = useRef<PQRSTPoint[]>([]);
  const pLineRef = useRef<WebglLine | null>(null);
  const qLineRef = useRef<WebglLine | null>(null);
  const rLineRef = useRef<WebglLine | null>(null);
  const sLineRef = useRef<WebglLine | null>(null);
  const tLineRef = useRef<WebglLine | null>(null);
  const panTompkins = useRef(new PanTompkinsDetector(SAMPLE_RATE));

  // Add this state to store currently visible PQRST points
  const [visiblePQRST, setVisiblePQRST] = useState<PQRSTPoint[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;

    const wglp = new WebglPlot(canvas);

    // Create ECG line (main signal)
    const line = new WebglLine(new ColorRGBA(0, 1, 0.2, 1), NUM_POINTS);
    line.arrangeX();

    // Create peak line
    const peakLine = new WebglLine(new ColorRGBA(1, 0.2, 0.2, 1), NUM_POINTS);
    peakLine.arrangeX();

    // Create PQRST lines
    const pLine = new WebglLine(new ColorRGBA(1, 0.7, 0, 1), NUM_POINTS); // Orange for P
    pLine.arrangeX();

    const qLine = new WebglLine(new ColorRGBA(0.2, 0.6, 1, 1), NUM_POINTS); // Blue for Q
    qLine.arrangeX();

    const rLine = new WebglLine(new ColorRGBA(1, 0, 0, 1), NUM_POINTS); // Red for R
    rLine.arrangeX();

    const sLine = new WebglLine(new ColorRGBA(0, 0.8, 1, 1), NUM_POINTS); // Cyan for S
    sLine.arrangeX();

    const tLine = new WebglLine(new ColorRGBA(0.8, 0.3, 1, 1), NUM_POINTS); // Purple for T
    tLine.arrangeX();

    // Add all lines to the plot
    wglp.addLine(line);
    wglp.addLine(peakLine);
    wglp.addLine(pLine);
    wglp.addLine(qLine);
    wglp.addLine(rLine);
    wglp.addLine(sLine);
    wglp.addLine(tLine);

    // Store references
    wglpRef.current = wglp;
    lineRef.current = line;
    peakLineRef.current = peakLine;
    pLineRef.current = pLine;
    qLineRef.current = qLine;
    rLineRef.current = rLine;
    sLineRef.current = sLine;
    tLineRef.current = tLine;

    const render = () => {
      requestAnimationFrame(render);
      const scale = getScaleFactor();
      for (let i = 0; i < NUM_POINTS; i++) {
        line.setY(i, dataCh0.current[i] * scale);
        peakLine.setY(i, peaksVisible ? peakData.current[i] : 0);

        // Update PQRST lines if visible
        if (showPQRST) {
          pLine.setY(i, pLineRef.current?.getY(i) || 0);
          qLine.setY(i, qLineRef.current?.getY(i) || 0);
          rLine.setY(i, rLineRef.current?.getY(i) || 0);
          sLine.setY(i, sLineRef.current?.getY(i) || 0);
          tLine.setY(i, tLineRef.current?.getY(i) || 0);
        } else {
          pLine.setY(i, 0);
          qLine.setY(i, 0);
          rLine.setY(i, 0);
          sLine.setY(i, 0);
          tLine.setY(i, 0);
        }
      }
      wglp.update();
    };
    render();
  }, [peaksVisible, showPQRST]);

  function getScaleFactor() {
    const maxAbs = Math.max(...dataCh0.current.map(Math.abs), 0.1);
    return maxAbs > 0.9 ? 0.9 / maxAbs : 1;
  }

  // Add this function to see what data we have
  function updatePeaks() {
    // Add debug for signal diagnostics
    const maxAbs = Math.max(...dataCh0.current.map(Math.abs));
    const mean = dataCh0.current.reduce((sum, val) => sum + val, 0) / dataCh0.current.length;
    const variance = dataCh0.current.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dataCh0.current.length;

    console.log("Signal diagnostic:", {
      maxAbs,
      mean,
      variance,
      signalToNoiseRatio: maxAbs / (Math.sqrt(variance) || 1)
    });

    // Skip peak detection if the signal is too weak or too flat
    if (maxAbs < 0.05 || variance < 0.0002) {
      console.log('Signal too weak or flat for detection, skipping');
      pqrstPoints.current = [];
      if (showPQRST) {
        setVisiblePQRST([]);
      }
      return;
    }

    // Use Pan-Tompkins algorithm for peak detection
    const peaks = panTompkins.current.detectQRS(dataCh0.current);

    // Fall back to original algorithm if Pan-Tompkins doesn't find peaks
    let usedPanTompkins = peaks.length > 0;

    if (!usedPanTompkins) {
      console.log('Pan-Tompkins found no peaks, trying original algorithm');
      const originalPeaks = bpmCalculator.current.detectPeaks(dataCh0.current);
      if (originalPeaks.length > 0) {
        peaks.push(...originalPeaks);
      }
    }

    // Generate visualization (same as before)
    peakData.current = bpmCalculator.current.generatePeakVisualization(dataCh0.current, peaks);

    // Log detailed peak info
    if (peaks.length > 0) {
      console.log('Peak detection used Pan-Tompkins:', usedPanTompkins);
      console.log('Peak amplitudes:', peaks.map(idx => dataCh0.current[idx]));
      console.log('Peak indices:', peaks);
    }

    // Try to detect PQRST waves
    let pqrstDetected = false;

    if (peaks.length >= 1) {
      // Existing PQRST detection with peaks
      pqrstPoints.current = pqrstDetector.current.detectWaves(dataCh0.current, peaks, sampleIndex.current);
      pqrstDetected = pqrstPoints.current.length > 0;

      if (showPQRST) {
        setVisiblePQRST([...pqrstPoints.current]);
      }
    }

    // If standard detection failed, try direct detection
    if (!pqrstDetected) {
      console.log('Standard detection failed, trying direct PQRST detection');
      pqrstPoints.current = pqrstDetector.current.detectDirectWaves(dataCh0.current, sampleIndex.current);

      if (showPQRST && pqrstPoints.current.length > 0) {
        setVisiblePQRST([...pqrstPoints.current]);
      } else {
        setVisiblePQRST([]);
      }
    }

    // Debug logging
    console.log('Peaks detected:', peaks.length);
    console.log('PQRST points detected:', pqrstPoints.current.length);
    console.log('Data max:', Math.max(...dataCh0.current));
    console.log('Data min:', Math.min(...dataCh0.current));

    // Extract RR intervals for HRV analysis
    if (peaks.length >= 2) {
      console.log('Extracting RR intervals from', peaks.length, 'peaks');
      hrvCalculator.current.extractRRFromPeaks(peaks, SAMPLE_RATE);

      // Force update HRV metrics
      const metrics = hrvCalculator.current.getAllMetrics();
      console.log('HRV Metrics:', metrics);
      setHrvMetrics(metrics);
    } else {
      console.log('Not enough peaks for HRV analysis');
    }
  }

  // Add an effect to clear visible points when toggling off
  useEffect(() => {
    if (!showPQRST) {
      setVisiblePQRST([]);
    } else if (pqrstPoints.current.length > 0) {
      setVisiblePQRST([...pqrstPoints.current]);
    }
  }, [showPQRST]);

  useEffect(() => {
    const timerInterval = setInterval(() => {
      if (startTime) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000); // Define elapsed here
        const min = String(Math.floor(elapsed / 60)).padStart(2, "0");
        const sec = String(elapsed % 60).padStart(2, "0");
        setTimer(`${min}:${sec}`);
      }

      const bpm = bpmCalculator.current.computeBPM(dataCh0.current);
      if (bpm) {
        setBpmDisplay(Math.round(bpm) + " BPM");
      } else {
        setBpmDisplay("-- BPM");
      }

      // Always try to update HRV metrics when connected
      if (connected) {
        const metrics = hrvCalculator.current.getAllMetrics();
        console.log('Timer HRV update:', metrics.sampleCount, 'samples');
        if (metrics.sampleCount > 0) {
          setHrvMetrics(metrics);
          // Update this line to use the new method name
          setPhysioState(hrvCalculator.current.getPhysiologicalState());
        }
      }
    }, 1000);
    return () => clearInterval(timerInterval);
  }, [startTime, connected]);

  async function connect() {
    try {
      // Check if navigator.bluetooth is available
      if (!('bluetooth' in navigator)) {
        alert("Web Bluetooth API is not supported in this browser.");
        return;
      }
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ namePrefix: "NPG" }],
        optionalServices: [SERVICE_UUID]
      });
      const server = await device.gatt?.connect();
      const service = await server?.getPrimaryService(SERVICE_UUID);
      const controlChar = await service?.getCharacteristic(CONTROL_CHAR_UUID);
      const dataChar = await service?.getCharacteristic(DATA_CHAR_UUID);

      await controlChar?.writeValue(new TextEncoder().encode("START"));
      await dataChar?.startNotifications();

      dataChar?.addEventListener("characteristicvaluechanged", (event: any) => {
        const value = event.target.value;
        if (value.byteLength === NEW_PACKET_LEN) {
          for (let i = 0; i < NEW_PACKET_LEN; i += SINGLE_SAMPLE_LEN) {
            const view = new DataView(value.buffer.slice(i, i + SINGLE_SAMPLE_LEN));
            const raw = view.getInt16(1, false);
            const norm = ((Math.max(0, Math.min(4096, raw)) - 2048) * 2) / 4096;
            const filtered = ecg.current.process(notch.current.process(norm));
            dataCh0.current[sampleIndex.current] = filtered;
            sampleIndex.current = (sampleIndex.current + 1) % NUM_POINTS;
          }

          // Call updatePeaks to refresh the PQRST points with each new data packet
          updatePeaks();
        }
      });

      setConnected(true);
      setStartTime(Date.now());
      bpmCalculator.current.reset();
      hrvCalculator.current.reset();
      panTompkins.current.reset(); // Reset Pan-Tompkins detector

    } catch (e) {
      console.error("BLE Connection failed:", e);
    }
  }

  const getBPMStats = () => {
    console.log('BPM Stats:', bpmCalculator.current.getStats());
    console.log('HRV Metrics:', hrvCalculator.current.getAllMetrics());
  };

  // Add this to keep PQRST labels moving with the wave
  useEffect(() => {
    if (!showPQRST) return;

    // Update the PQRST labels position when the data is refreshed
    const pqrstUpdateInterval = setInterval(() => {
      if (pqrstPoints.current.length > 0 && showPQRST) {
        setVisiblePQRST([...pqrstPoints.current]);
      }
    }, 50); // Update at 20fps for smooth movement

    return () => clearInterval(pqrstUpdateInterval);
  }, [showPQRST]);

  // Add this effect to update signal quality
  useEffect(() => {
    const signalQualityInterval = setInterval(() => {
      if (!connected) {
        setSignalQuality('no-signal');
        return;
      }

      // Calculate signal quality metrics
      const maxAbs = Math.max(...dataCh0.current.map(Math.abs));
      const variance = dataCh0.current.reduce((sum, val) => sum + Math.pow(val, 2), 0) / dataCh0.current.length;

      if (maxAbs < 0.1 || variance < 0.001) {
        setSignalQuality('no-signal');
      } else if (maxAbs < 0.3 || variance < 0.01) {
        setSignalQuality('poor');
      } else {
        setSignalQuality('good');
      }
    }, 1000);

    return () => clearInterval(signalQualityInterval);
  }, [connected]);

  return (
    <div className="relative w-full h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 opacity-10">
        <div className="h-full w-full bg-grid-pattern bg-[size:40px_40px]"></div>
      </div>

      {/* Main canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}
      />

      {/* Header section */}
      <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/40 to-transparent ">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-white">
              <Activity className="w-6 h-6 text-red-400" />
              <h1 className="text-xl font-bold bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent">
                ECG Monitor
              </h1>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${connected
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
              {connected ? 'Connected' : 'Disconnected'}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-black/30 rounded-xl border border-white/10">
              <Timer className="w-4 h-4 text-blue-400" />
              <span className="text-white font-mono text-lg">{timer}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-black/30 rounded-xl border border-white/10">
              <Heart className="w-5 h-5 text-red-400 animate-pulse" />
              <span className="text-red-400 font-bold text-xl">{bpmDisplay}</span>
            </div>
          </div>
        </div>
      </div>

      {/* HRV Panel */}
      {showHRV && (
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-80 bg-black/60 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              HRV Analysis
            </h3>
            <button
              onClick={() => setShowHRV(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {hrvMetrics && hrvMetrics.sampleCount > 0 ? (
            <>
              {/* Physiological State (previously Mental State) */}
              <div className="mb-4 p-3 rounded-lg border border-white/20 bg-black/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-300">Physiological State:</span>
                  <span className="font-bold text-lg" style={{ 
                    color: 
                      physioState.state === "High Stress" ? "#ef4444" : 
                      physioState.state === "Relaxed" ? "#22c55e" : 
                      physioState.state === "Focused" ? "#3b82f6" : 
                      physioState.state === "Fatigue" ? "#f97316" : 
                      physioState.state === "Analyzing" ? "#94a3b8" : "#94a3b8" 
                  }}>
                    {physioState.state}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div 
                    className="h-1.5 rounded-full" 
                    style={{ 
                      width: `${physioState.confidence * 100}%`,
                      backgroundColor: 
                        physioState.state === "High Stress" ? "#ef4444" : 
                        physioState.state === "Relaxed" ? "#22c55e" : 
                        physioState.state === "Focused" ? "#3b82f6" : 
                        physioState.state === "Fatigue" ? "#f97316" : 
                        physioState.state === "Analyzing" ? "#94a3b8" : "#94a3b8" 
                    }}
                  ></div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Confidence: {(physioState.confidence * 100).toFixed(0)}%
                </p>
              </div>

              {/* HRV Status */}
              <div className="mb-4 p-3 rounded-lg border" style={{
                backgroundColor: `${hrvMetrics.assessment.color}20`,
                borderColor: `${hrvMetrics.assessment.color}40`
              }}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Status:</span>
                  <span className="font-bold" style={{ color: hrvMetrics.assessment.color }}>
                    {hrvMetrics.assessment.status}
                  </span>
                </div>
                <p className="text-sm text-gray-300 mt-1">
                  {hrvMetrics.assessment.description}
                </p>
              </div>

              {/* Time Domain Metrics */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-300">RMSSD:</span>
                  <span className="font-mono text-green-400">{hrvMetrics.rmssd.toFixed(1)} ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">SDNN:</span>
                  <span className="font-mono text-blue-400">{hrvMetrics.sdnn.toFixed(1)} ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">pNN50:</span>
                  <span className="font-mono text-yellow-400">{hrvMetrics.pnn50.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Triangular:</span>
                  <span className="font-mono text-purple-400">{hrvMetrics.triangularIndex.toFixed(1)}</span>
                </div>
              </div>

              {/* Frequency Domain */}
              <div className="mt-4 pt-4 border-t border-white/20">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Frequency Domain</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">LF Power:</span>
                    <span className="font-mono text-blue-400 text-sm">
                      {hrvMetrics.lfhf.lf.toFixed(2)} ms²
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">HF Power:</span>
                    <span className="font-mono text-green-400 text-sm">
                      {hrvMetrics.lfhf.hf.toFixed(2)} ms²
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">LF/HF Ratio:</span>
                    <span className="font-mono text-orange-400 text-sm">
                      {hrvMetrics.lfhf.ratio.toFixed(2)}
                      <span className="text-xs ml-1 text-gray-400">
                        {hrvMetrics.lfhf.ratio > 2.0 ? '(Sympathetic ↑)' : 
                         hrvMetrics.lfhf.ratio < 0.5 ? '(Parasympathetic ↑)' : '(Balanced)'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Sample Info */}
              <div className="mt-4 pt-4 border-t border-white/20 text-xs text-gray-400">
                Samples: {hrvMetrics.sampleCount} RR intervals
              </div>
            </>
          ) : (
            <div className="text-center text-gray-400 py-8">
              <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p>Collecting heart beats...</p>
              <p className="text-sm mt-2">Need at least 2 peaks for analysis</p>
              {connected && (
                <p className="text-xs mt-2">
                  Connected - waiting for ECG data...
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* PQRST text labels overlay - simpler approach */}
      {showPQRST && (
        <div className="absolute inset-0 pointer-events-none">
          {visiblePQRST.map((point, index) => {
            // Only show points from the most recent section of the ECG (e.g., last 20% of the screen)
            // This ensures we only label the newest data coming in from the left
            const isRecent = point.index > (sampleIndex.current - NUM_POINTS * 0.2 + NUM_POINTS) % NUM_POINTS &&
              point.index < (sampleIndex.current + NUM_POINTS * 0.1) % NUM_POINTS;

            if (isRecent) {
              const xPercent = (point.index / NUM_POINTS) * 100;
              const yOffset = 50 - (point.amplitude * getScaleFactor() * 50);

              let color;
              switch (point.type) {
                case 'P': color = 'text-orange-400'; break;
                case 'Q': color = 'text-blue-400'; break;
                case 'R': color = 'text-red-500'; break;
                case 'S': color = 'text-cyan-400'; break;
                case 'T': color = 'text-purple-400'; break;
                default: color = 'text-white';
              }

              return (
                <div
                  key={`pqrst-${index}`}
                  className={`absolute font-bold ${color}`}
                  style={{
                    left: `${xPercent}%`,
                    top: `${yOffset}%`,
                    transform: 'translate(-50%, -50%)',
                    textShadow: '0 0 4px rgba(0,0,0,0.8)'
                  }}
                >
                  {point.type}
                </div>
              );
            }
            return null;
          })}
        </div>
      )}

      {/* Control panel */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/40 to-transparent">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={connect}
            disabled={connected}
            className={`flex items-center gap-3 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${connected
              ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-not-allowed'
              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 hover:scale-105 active:scale-95'
              }`}
          >
            <Bluetooth className="w-5 h-5" />
            {connected ? 'Connected' : 'Connect Device'}
          </button>

          <button
            onClick={() => setPeaksVisible(!peaksVisible)}
            className={`flex items-center gap-3 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${peaksVisible
              ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
              : 'bg-gray-500/20 text-gray-400 border border-gray-500/30 hover:bg-gray-500/30'
              } hover:scale-105 active:scale-95`}
          >
            {peaksVisible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            {peaksVisible ? 'Hide Peaks' : 'Show Peaks'}
          </button>

          {/* Add PQRST toggle button */}
          <button
            onClick={() => setShowPQRST(!showPQRST)}
            className={`flex items-center gap-3 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${showPQRST
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30'
              : 'bg-gray-500/20 text-gray-400 border border-gray-500/30 hover:bg-gray-500/30'
              } hover:scale-105 active:scale-95`}
          >
            <Activity className="w-5 h-5" />
            {showPQRST ? 'Hide PQRST' : 'Show PQRST'}
          </button>

          <button
            onClick={() => setShowHRV(!showHRV)}
            className={`flex items-center gap-3 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${showHRV
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30'
              : 'bg-gray-500/20 text-gray-400 border border-gray-500/30 hover:bg-gray-500/30'
              } hover:scale-105 active:scale-95`}
          >
            <BarChart3 className="w-5 h-5" />
            {showHRV ? 'Hide HRV' : 'Show HRV'}
          </button>

          <button
            onClick={getBPMStats}
            className="flex items-center gap-3 px-6 py-3 rounded-xl font-medium transition-all duration-200 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 hover:scale-105 active:scale-95"
          >
            <Zap className="w-5 h-5" />
            Debug Stats
          </button>
        </div>
      </div>

      {/* Signal quality indicator */}
      <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white">
        <div className={`w-3 h-3 rounded-full ${signalQuality === 'good' ? 'bg-green-500' :
          signalQuality === 'poor' ? 'bg-yellow-500' : 'bg-red-500'
          }`}></div>
        <span className="text-sm">
          {signalQuality === 'good' ? 'Good Signal' :
            signalQuality === 'poor' ? 'Poor Signal' : 'No Signal'}
        </span>
      </div>

      {/* Pulse animation overlay */}
      <div className="absolute top-4 right-4 pointer-events-none">
        <div className="relative">
          <div className="w-4 h-4 bg-red-500 rounded-full animate-ping"></div>
          <div className="absolute top-0 w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}