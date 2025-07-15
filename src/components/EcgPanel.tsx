// components/EcgPanel.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import { WebglPlot, WebglLine, ColorRGBA } from "webgl-plot";
import { NotchFilter, ECGFilter } from '../lib/filters';
import { BPMCalculator } from '../lib/bpmCalculator';

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

  const wglpRef = useRef<WebglPlot>();
  const lineRef = useRef<WebglLine>();
  const peakLineRef = useRef<WebglLine>();
  const dataCh0 = useRef(new Array(NUM_POINTS).fill(0));
  const peakData = useRef(new Array(NUM_POINTS).fill(0));
  const sampleIndex = useRef(0);
  const notch = useRef(new NotchFilter());
  const ecg = useRef(new ECGFilter());

  // Replace BPM logic with calculator
  const bpmCalculator = useRef(new BPMCalculator(SAMPLE_RATE, 5, 40, 200));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;

    const wglp = new WebglPlot(canvas);
    const line = new WebglLine(new ColorRGBA(0.8, 0.2, 0.2, 1), NUM_POINTS);
    line.lineWidth = 2; // Made thinner
    line.arrangeX();
    const peakLine = new WebglLine(new ColorRGBA(0, 1, 0, 1), NUM_POINTS);
    peakLine.lineWidth = 2;
    peakLine.arrangeX();
    wglp.addLine(line);
    wglp.addLine(peakLine);

    wglpRef.current = wglp;
    lineRef.current = line;
    peakLineRef.current = peakLine;

    const render = () => {
      requestAnimationFrame(render);
      const scale = getScaleFactor();
      for (let i = 0; i < NUM_POINTS; i++) {
        line.setY(i, dataCh0.current[i] * scale);
        peakLine.setY(i, peaksVisible ? peakData.current[i] : 0);
      }
      wglp.update();
    };
    render();
  }, [peaksVisible]);

  function getScaleFactor() {
    const maxAbs = Math.max(...dataCh0.current.map(Math.abs), 0.1);
    return maxAbs > 0.9 ? 0.9 / maxAbs : 1;
  }

  // Simplified peak update using BPM calculator
  function updatePeaks() {
    const peaks = bpmCalculator.current.detectPeaks(dataCh0.current);
    peakData.current = bpmCalculator.current.generatePeakVisualization(dataCh0.current, peaks);
  }

  useEffect(() => {
    const timer = setInterval(() => {
      if (startTime) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const min = String(Math.floor(elapsed / 60)).padStart(2, "0");
        const sec = String(elapsed % 60).padStart(2, "0");
        document.getElementById("timer")!.textContent = `${min}:${sec}`;
      }
      
      // Use BPM calculator
      const bpm = bpmCalculator.current.computeBPM(dataCh0.current);
      if (bpm) {
        setBpmDisplay(Math.round(bpm) + " BPM");
      } else {
        setBpmDisplay("-- BPM");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  async function connect() {
    try {
      const device = await navigator.bluetooth.requestDevice({ 
        filters: [{ namePrefix: "NPG" }], 
        optionalServices: [SERVICE_UUID] 
      });
      const server = await device.gatt?.connect();
      const service = await server?.getPrimaryService(SERVICE_UUID);
      const controlChar = await service?.getCharacteristic(CONTROL_CHAR_UUID);
      const dataChar = await service?.getCharacteristic(DATA_CHAR_UUID);
      
      await controlChar?.writeValue(new TextEncoder().encode("START"));
      await dataChar?.startNotifications();

      dataChar?.addEventListener("characteristicvaluechanged", (event) => {
        const value = (event.target as BluetoothRemoteGATTCharacteristic).value!;
        if (value.byteLength === NEW_PACKET_LEN) {
          for (let i = 0; i < NEW_PACKET_LEN; i += SINGLE_SAMPLE_LEN) {
            const view = new DataView(value.buffer.slice(i, i + SINGLE_SAMPLE_LEN));
            const raw = view.getInt16(1, false);
            const norm = ((Math.max(0, Math.min(4096, raw)) - 2048) * 2) / 4096;
            const filtered = ecg.current.process(notch.current.process(norm));
            dataCh0.current[sampleIndex.current] = filtered;
            sampleIndex.current = (sampleIndex.current + 1) % NUM_POINTS;
          }
          updatePeaks();
        }
      });

      setConnected(true);
      setStartTime(Date.now());
      
      // Reset BPM calculator when connecting
      bpmCalculator.current.reset();
      
    } catch (e) {
      console.error("BLE Connection failed:", e);
    }
  }

  // Add function to get BPM stats for debugging
  const getBPMStats = () => {
    return bpmCalculator.current.getStats();
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", background: "#000" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 20 }}>
        <div id="timer" style={{ padding: "5px 10px", background: "rgba(0,0,0,0.5)", borderRadius: 12, color: "white" }}>00:00</div>
        <div style={{ padding: "5px 10px", background: "rgba(0,0,0,0.5)", borderRadius: 12, color: "#ff3838", fontWeight: 600 }}>{bpmDisplay}</div>
      </div>
      <button onClick={connect} style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", padding: "10px 20px", background: "#1e293b", color: "#fff", border: "none", borderRadius: 8 }}>
        Connect
      </button>
      <button onClick={() => setPeaksVisible(!peaksVisible)} style={{ position: "absolute", bottom: 20, right: 20, padding: "10px 20px", background: "#0f172a", color: "#fff", border: "none", borderRadius: 8 }}>
        {peaksVisible ? "Hide Peaks" : "Show Peaks"}
      </button>
    </div>
  );
}
