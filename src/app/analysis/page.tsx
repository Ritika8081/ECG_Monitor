// src/app/analysis/page.tsx
"use client";

import { useState, useEffect } from "react";
import * as tf from "@tensorflow/tfjs";
import { zscoreNorm } from "../../lib/modelTrainer";

export default function AnalysisPage() {
  const [inputText, setInputText] = useState("");
  const [inputs, setInputs] = useState<number[]>(Array(720).fill(0));
  const [prediction, setPrediction] = useState<string | null>(null);
  const [probabilities, setProbabilities] = useState<number[]>([]);
  const [classLabels, setClassLabels] = useState<string[]>([]);

  useEffect(() => {
    // Load class labels from localStorage
    const labels = JSON.parse(localStorage.getItem("ecg-class-labels") || "[]");
    setClassLabels(labels);
  }, []);

  // Handle textarea change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    const arr = e.target.value
      .split(",")
      .map((s) => parseFloat(s.trim()))
      .filter((v) => !isNaN(v));
    if (arr.length === 720) setInputs(arr);
  };

  // Example preset (fill with realistic ECG values)
  const loadPreset = () => {
    const preset = Array.from({ length: 720 }, (_, i) => Math.sin(i / 50) + Math.random() * 0.1);
    setInputs(preset);
    setInputText(preset.join(","));
  };

  // Predict using the model
  const handlePredict = async () => {
    const model = await tf.loadLayersModel("localstorage://ecg-disease-model");
    const normInputs = zscoreNorm(inputs);
    const inputTensor = tf.tensor3d([normInputs.map((v) => [v])], [1, 720, 1]);
    const outputTensor = model.predict(inputTensor) as tf.Tensor;
    const probs = Array.from(await outputTensor.data());
    setProbabilities(probs);
    const maxIdx = probs.indexOf(Math.max(...probs));
    setPrediction(classLabels[maxIdx] || `Class ${maxIdx + 1}`);
  };

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-white mb-6">ECG Window Analysis</h1>
        <div className="bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Input ECG Window (720 values)</h2>
          <textarea
            value={inputText}
            onChange={handleTextChange}
            rows={6}
            className="w-full bg-black/30 text-white border border-white/20 rounded px-3 py-2 mb-4"
            placeholder="Enter 720 comma-separated ECG values"
          />
          <button
            onClick={loadPreset}
            className="px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg mr-2"
          >
            Load Example Preset
          </button>
          <button
            onClick={handlePredict}
            disabled={inputs.length !== 720}
            className={`px-4 py-2 rounded-lg font-medium ${
              inputs.length === 720
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-blue-500/30 text-blue-300 cursor-not-allowed"
            }`}
          >
            Predict
          </button>
          <p className="text-xs text-gray-400 mt-2">
            {inputs.length !== 720 && "Please enter exactly 720 values."}
          </p>
        </div>
        {prediction && (
          <div className="bg-black/40 border border-white/20 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-2">Prediction</h2>
            <p className="text-white text-xl mb-2">{prediction}</p>
            <h3 className="text-gray-300 font-medium mb-2">Probabilities:</h3>
            <ul>
              {probabilities.map((prob, idx) => (
                <li key={idx} className="text-gray-300">
                  {classLabels[idx] || `Class ${idx + 1}`}: {(prob * 100).toFixed(2)}%
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}