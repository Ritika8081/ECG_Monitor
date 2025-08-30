import * as tf from "@tensorflow/tfjs";
import Papa from "papaparse";

// --- 1. Load ECG CSV (only first channel) ---
async function loadECG(path: string, windowSize = 720, stepSize = 360) {
  return new Promise<number[][]>((resolve) => {
    Papa.parse(path, {
      download: true,
      header: false,
      complete: (results) => {
        // ✅ Use first column only (channel 1)
        const signal = results.data
          .map((row) => Number((row as string[])[0]))
          .filter((v) => !isNaN(v));

        const windows: number[][] = [];
        for (let start = 0; start + windowSize <= signal.length; start += stepSize) {
          windows.push(signal.slice(start, start + windowSize));
        }
        resolve(windows);
      },
    });
  });
}

// --- 2. Load Annotations ---
async function loadLabels(path: string, windowSize = 720, stepSize = 360) {
  return new Promise<string[]>((resolve) => {
    Papa.parse(path, {
      download: true,
      header: true,
      complete: (results) => {
        const labels = results.data
          .map((row: any) => row.annotation_symbol)
          .filter((v: string) => typeof v === "string" && v.length > 0);

        const windowLabels: string[] = [];
        for (let start = 0; start + windowSize <= labels.length; start += stepSize) {
          const window = labels.slice(start, start + windowSize);
          const counts: Record<string, number> = {};
          window.forEach((l) => (counts[l] = (counts[l] || 0) + 1));
          const majority = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
          windowLabels.push(majority);
        }
        resolve(windowLabels);
      },
    });
  });
}

// --- 3. Preprocessing ---
export function zscoreNorm(window: number[]) {
  const mean = window.reduce((a, b) => a + b, 0) / window.length;
  const std = Math.sqrt(
    window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length
  );
  return window.map((v) => (v - mean) / (std || 1));
}

function augment(window: number[]) {
  const noise = window.map(() => (Math.random() - 0.5) * 0.05);
  return window.map((v, i) => v + noise[i]);
}

// --- 4. Prepare Dataset ---
let classLabels: string[] = [];
export { classLabels };

function prepareDataset(
  windows: number[][],
  labels: string[],
  uniqueLabels: string[]
) {
  const xs: number[][][] = [];
  const ys: number[] = [];

  windows.forEach((w, i) => {
    let win = zscoreNorm(w);
    win = augment(win);
    xs.push(win.map((v) => [v])); // shape [windowSize, 1]

    const labelIndex = uniqueLabels.indexOf(labels[i]);
    ys.push(labelIndex >= 0 ? labelIndex : 0);
  });

  return {
    xs: tf.tensor3d(xs),
    ys: tf.oneHot(tf.tensor1d(ys, "int32"), uniqueLabels.length),
  };
}

// --- 5. Build Model ---
function buildModel(windowSize: number, numClasses: number) {
  const model = tf.sequential();
  model.add(
    tf.layers.conv1d({
      inputShape: [windowSize, 1],
      filters: 32,
      kernelSize: 7,
      activation: "relu",
    })
  );
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.maxPooling1d({ poolSize: 2 }));
  model.add(
    tf.layers.conv1d({
      filters: 64,
      kernelSize: 5,
      activation: "relu",
    })
  );
  model.add(tf.layers.globalAveragePooling1d());
  model.add(
    tf.layers.dense({
      units: 64,
      activation: "relu",
      kernelRegularizer: tf.regularizers.l2({ l2: 0.01 }),
    })
  );
  model.add(tf.layers.dropout({ rate: 0.5 }));
  model.add(tf.layers.dense({ units: numClasses, activation: "softmax" }));

  model.compile({
    optimizer: tf.train.adam(),
    loss: "categoricalCrossentropy",
    metrics: ["accuracy"],
  });

  return model;
}

// --- 6. Train and Save (multi-file version) ---
export async function trainECGModel(onEpoch?: (epoch: number, logs: tf.Logs) => void) {
  const windowSize = 720, stepSize = 360;

// ✅ List your ECG + annotation pairs here
const filePairs = [
  { ecg: "/105_ekg.csv", ann: "/105_annotations_1.csv" },
  { ecg: "/106_ekg.csv", ann: "/106_annotations_1.csv" },
  { ecg: "/107_ekg.csv", ann: "/107_annotations_1.csv" },
  { ecg: "/108_ekg.csv", ann: "/108_annotations_1.csv" },
  { ecg: "/109_ekg.csv", ann: "/109_annotations_1.csv" },
  { ecg: "/111_ekg.csv", ann: "/111_annotations_1.csv" },
  { ecg: "/112_ekg.csv", ann: "/112_annotations_1.csv" },
  { ecg: "/113_ekg.csv", ann: "/113_annotations_1.csv" },
  { ecg: "/114_ekg.csv", ann: "/114_annotations_1.csv" },
  { ecg: "/115_ekg.csv", ann: "/115_annotations_1.csv" },
  { ecg: "/116_ekg.csv", ann: "/116_annotations_1.csv" },
  { ecg: "/117_ekg.csv", ann: "/117_annotations_1.csv" },
  { ecg: "/118_ekg.csv", ann: "/118_annotations_1.csv" },
  { ecg: "/119_ekg.csv", ann: "/119_annotations_1.csv" },
  { ecg: "/121_ekg.csv", ann: "/121_annotations_1.csv" },
  { ecg: "/122_ekg.csv", ann: "/122_annotations_1.csv" },
  { ecg: "/123_ekg.csv", ann: "/123_annotations_1.csv" },
  { ecg: "/124_ekg.csv", ann: "/124_annotations_1.csv" },
  { ecg: "/200_ekg.csv", ann: "/200_annotations_1.csv" },
  { ecg: "/201_ekg.csv", ann: "/201_annotations_1.csv" },
  { ecg: "/202_ekg.csv", ann: "/202_annotations_1.csv" },
  { ecg: "/203_ekg.csv", ann: "/203_annotations_1.csv" },
  { ecg: "/205_ekg.csv", ann: "/205_annotations_1.csv" },
  { ecg: "/207_ekg.csv", ann: "/207_annotations_1.csv" },
  { ecg: "/208_ekg.csv", ann: "/208_annotations_1.csv" },
  { ecg: "/209_ekg.csv", ann: "/209_annotations_1.csv" },
  { ecg: "/210_ekg.csv", ann: "/210_annotations_1.csv" },
  { ecg: "/212_ekg.csv", ann: "/212_annotations_1.csv" },
  { ecg: "/213_ekg.csv", ann: "/213_annotations_1.csv" },
  { ecg: "/214_ekg.csv", ann: "/214_annotations_1.csv" },
  { ecg: "/215_ekg.csv", ann: "/215_annotations_1.csv" },
  { ecg: "/217_ekg.csv", ann: "/217_annotations_1.csv" },
  { ecg: "/219_ekg.csv", ann: "/219_annotations_1.csv" },
  { ecg: "/221_ekg.csv", ann: "/221_annotations_1.csv" },
  { ecg: "/222_ekg.csv", ann: "/222_annotations_1.csv" },
  { ecg: "/223_ekg.csv", ann: "/223_annotations_1.csv" },
  { ecg: "/228_ekg.csv", ann: "/228_annotations_1.csv" },
  { ecg: "/230_ekg.csv", ann: "/230_annotations_1.csv" },
  { ecg: "/231_ekg.csv", ann: "/231_annotations_1.csv" },
  { ecg: "/234_ekg.csv", ann: "/234_annotations_1.csv" },
];
  let allWindows: number[][] = [];
  let allLabels: string[] = [];

  // Load & merge all datasets
  for (const pair of filePairs) {
    const ecgWindows = await loadECG(pair.ecg, windowSize, stepSize);
    const labels = await loadLabels(pair.ann, windowSize, stepSize);

    // Match lengths (safety)
    const n = Math.min(ecgWindows.length, labels.length);
    allWindows.push(...ecgWindows.slice(0, n));
    allLabels.push(...labels.slice(0, n));
  }

  // Unique labels across all files
  let uniqueLabels = Array.from(new Set(allLabels));
  if (uniqueLabels.length < 2) {
    console.warn("⚠️ Only one class found, adding dummy");
    uniqueLabels.push("Other");
  }
  classLabels = uniqueLabels;
  console.log("Detected classes:", uniqueLabels);

  // Prepare dataset
  const { xs, ys } = prepareDataset(allWindows, allLabels, uniqueLabels);

  // Build + train model
  const model = buildModel(windowSize, uniqueLabels.length);
  await model.fit(xs, ys, {
    epochs: 30,
    batchSize: 32,
    validationSplit: 0.2,
    shuffle: true,
    callbacks: {
      onEpochEnd: async (epoch, logs) => {
        if (onEpoch) onEpoch(epoch, logs ?? {});
      },
    },
  });

  await model.save("localstorage://ecg-disease-model");
  localStorage.setItem('ecg-class-labels', JSON.stringify(classLabels));
  console.log("✅ Model trained and saved!");
}


