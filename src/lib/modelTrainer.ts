import * as tf from "@tensorflow/tfjs";
import Papa from "papaparse";

// --- 1. Load ECG CSV (only first channel) ---
async function loadECG(path: string, windowSize = 720, stepSize = 360) {
  return new Promise<number[][]>((resolve, reject) => {
    Papa.parse(path, {
      download: true,
      header: false,
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          console.error(`Failed to fetch ECG file: ${path}`, results.errors);
          reject(new Error(`Failed to fetch ECG file: ${path}`));
          return;
        }
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
      error: (err) => {
        console.error(`Error fetching ECG file: ${path}`, err);
        reject(err);
      }
    });
  });
}

// --- 2. Load Annotations ---
async function loadLabels(path: string, windowSize = 720, stepSize = 360) {
  return new Promise<string[]>((resolve, reject) => {
    Papa.parse(path, {
      download: true,
      header: true,
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          const nonFieldMismatch = results.errors.filter(e => e.type !== "FieldMismatch");
          if (nonFieldMismatch.length > 0) {
            console.error(`Failed to fetch annotation file: ${path}`, results.errors);
            reject(new Error(`Failed to fetch annotation file: ${path}`));
            return;
          }
          console.warn(`Some rows in ${path} had missing fields and were skipped.`);
        }
        const labels = results.data
          .map((row: any) => row.annotation_symbol)
          .filter((v: string) => typeof v === "string" && v.length > 0);

        // Pair each window with the annotation at its starting index
        const windowLabels: string[] = [];
        for (let start = 0; start + windowSize <= labels.length; start += stepSize) {
          windowLabels.push(labels[start]);
        }

        console.log(`Windowed annotation symbols for ${path}:`, Array.from(new Set(windowLabels)));
        resolve(windowLabels);
      },
      error: (err) => {
        console.error(`Error fetching annotation file: ${path}`, err);
        reject(err);
      }
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

function augment(window: number[], label?: string) {
  let noiseLevel = 0.05;
  if (label && ['V', 'R', 'L', '/'].includes(label)) noiseLevel = 0.15;
  // Add scaling
  const scale = 1 + (Math.random() - 0.5) * 0.15;
  // Add shifting
  const shift = (Math.random() - 0.5) * 0.15;
  // Add jitter (random spikes)
  const jitter = window.map(() => (Math.random() < 0.01 ? (Math.random() - 0.5) * 2 : 0));
  // Time warping (simple: random stretch/compress)
  const warp = Math.random() < 0.5 ? 1 : (1 + (Math.random() - 0.5) * 0.1);
  const noise = window.map(() => (Math.random() - 0.5) * noiseLevel);
  return window.map((v, i) => scale * v * warp + shift + noise[i] + jitter[i]);
}

// --- 4. Prepare Dataset ---
// Use fixed classLabels in the required order
export const classLabels = ["+", "N", "/", "f", "~", "L", "V", "R", "A", "x", "F"];

// Remove previous let classLabels: string[] = []; and export { classLabels };

// Update prepareDataset to use classLabels directly
function prepareDataset(
  windows: number[][],
  labels: string[],
  uniqueLabels: string[] = classLabels // default to fixed labels
) {
  if (!windows.length) {
    throw new Error("prepareDataset: windows array is empty.");
  }
  const xs: number[][][] = [];
  const ys: number[] = [];

  windows.forEach((w, i) => {
    let win = zscoreNorm(w);
    win = augment(win, labels[i]);
    xs.push(win.map((v) => [v])); // shape [windowSize, 1]
    const labelIndex = classLabels.indexOf(labels[i]);
    ys.push(labelIndex >= 0 ? labelIndex : 0);
  });

  return {
    xs: tf.tensor3d(xs, [xs.length, windows[0].length, 1]),
    ys: tf.oneHot(tf.tensor1d(ys, "int32"), classLabels.length),
  };
}

// --- 5. Build Model ---
function buildModel(windowSize: number, numClasses: number) {
  const model = tf.sequential();
  model.add(tf.layers.conv1d({ inputShape: [windowSize, 1], filters: 64, kernelSize: 7, activation: "relu" }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.maxPooling1d({ poolSize: 2 }));
  model.add(tf.layers.conv1d({ filters: 128, kernelSize: 5, activation: "relu" }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.maxPooling1d({ poolSize: 2 }));
  model.add(tf.layers.conv1d({ filters: 256, kernelSize: 3, activation: "relu" }));
  model.add(tf.layers.globalAveragePooling1d());
  model.add(tf.layers.dense({ units: 256, activation: "relu", kernelRegularizer: tf.regularizers.l2({ l2: 0.003 }) }));
  model.add(tf.layers.dropout({ rate: 0.3 }));
  model.add(tf.layers.dense({ units: numClasses, activation: "softmax" }));

  model.compile({
    optimizer: tf.train.adam(0.0005), // Lower learning rate
    loss: "categoricalCrossentropy",
    metrics: ["categoricalAccuracy"],
  });

  return model;
}

// --- 6. Train and Save (multi-file version) ---
const windowSize = 720, stepSize = 360;

// Only include a small default subset for initial compilation
export const allFilePairs = [
    { ecg: "/100_ekg.csv", ann: "/100_annotations_1.csv" },
    { ecg: "/101_ekg.csv", ann: "/101_annotations_1.csv" },
    { ecg: "/102_ekg.csv", ann: "/102_annotations_1.csv" },
    { ecg: "/103_ekg.csv", ann: "/103_annotations_1.csv" },
    { ecg: "/104_ekg.csv", ann: "/104_annotations_1.csv" },
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
    { ecg: "/220_ekg.csv", ann: "/220_annotations_1.csv" },
    { ecg: "/221_ekg.csv", ann: "/221_annotations_1.csv" },
    { ecg: "/222_ekg.csv", ann: "/222_annotations_1.csv" },
    { ecg: "/223_ekg.csv", ann: "/223_annotations_1.csv" },
    { ecg: "/228_ekg.csv", ann: "/228_annotations_1.csv" },
    { ecg: "/230_ekg.csv", ann: "/230_annotations_1.csv" },
    { ecg: "/231_ekg.csv", ann: "/231_annotations_1.csv" },
    { ecg: "/232_ekg.csv", ann: "/232_annotations_1.csv" },
    { ecg: "/233_ekg.csv", ann: "/233_annotations_1.csv" },
    { ecg: "/234_ekg.csv", ann: "/234_annotations_1.csv" }
  ];

// Use a function to select which files to train on
export function getFilePairs(selectedIndices?: number[]): { ecg: string, ann: string }[] {
  if (!selectedIndices || selectedIndices.length === 0) {
    // Default: use all files
    return allFilePairs;
  }
  return selectedIndices.map(i => allFilePairs[i]).filter(Boolean);
}

let allWindows: number[][] = [];
let allLabels: string[] = [];

// Batched, async loading with file selection
export async function loadAllDataBatched({ batchSize = 100, onProgress, selectedIndices }: { batchSize?: number, onProgress?: (current: number, total: number) => void, selectedIndices?: number[] } = {}) {
  allWindows = [];
  allLabels = [];
  const filePairs = getFilePairs(selectedIndices);
  const total = filePairs.length;
  for (let i = 0; i < total; i += batchSize) {
    const batch = filePairs.slice(i, i + batchSize);
    await Promise.all(batch.map(async (pair) => {
      const ecgWindows = await loadECG(pair.ecg, windowSize, stepSize);
      const labels = await loadLabels(pair.ann, windowSize, stepSize);
      const n = Math.min(ecgWindows.length, labels.length);
      allWindows.push(...ecgWindows.slice(0, n));
      allLabels.push(...labels.slice(0, n));
    }));
    if (onProgress) onProgress(Math.min(i + batchSize, total), total);
    // Yield to UI thread
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

// Utility: Load files in batches and show progress
// ...existing code...

// Usage in trainECGModel:
export async function trainECGModel(onEpoch?: (epoch: number, logs: tf.Logs) => void, onProgress?: (current: number, total: number) => void, selectedIndices?: number[]) {
  await loadAllDataBatched({ batchSize: 100, onProgress, selectedIndices });

  // Use fixed classLabels
  const uniqueLabels = classLabels;
  console.log("Using fixed class labels:", uniqueLabels);

  // Prepare dataset
  const { xs, ys } = prepareDataset(allWindows, allLabels, uniqueLabels);

  // After loading all labels
const counts: Record<string, number> = {};
allLabels.forEach(l => { counts[l] = (counts[l] || 0) + 1; });
console.log(counts);

// Oversample minority classes before splitting
function oversample(windows: number[][], labels: string[], targetCount: number) {
  const newWindows: number[][] = [];
  const newLabels: string[] = [];
  const labelCounts: Record<string, number> = {};
  labels.forEach(l => { labelCounts[l] = (labelCounts[l] || 0) + 1; });

  for (const label of Object.keys(labelCounts)) {
    const idxs = labels.map((l, i) => l === label ? i : -1).filter(i => i !== -1);
    let samples = idxs.map(i => windows[i]);
    let count = labelCounts[label];
    while (count < targetCount) {
      samples = samples.concat(samples.slice(0, targetCount - count));
      count = samples.length;
    }
    newWindows.push(...samples);
    newLabels.push(...Array(samples.length).fill(label));
  }
  return { windows: newWindows, labels: newLabels };
}

// Usage:
const targetCount = Math.max(...Object.values(counts));
const oversampled = oversample(allWindows, allLabels, targetCount);
allWindows = oversampled.windows;
allLabels = oversampled.labels;

// Shuffle and split data
// Stratified split: ensures each class is represented proportionally in each split
function stratifiedSplit(windows: number[][], labels: string[], trainRatio: number, valRatio: number) {
  const byClass: Record<string, number[]> = {};
  labels.forEach((l, i) => {
    if (!byClass[l]) byClass[l] = [];
    byClass[l].push(i);
  });
  const trainIdx: number[] = [], valIdx: number[] = [], testIdx: number[] = [];
  Object.values(byClass).forEach(idxs => {
    const n = idxs.length;
    const trainN = Math.floor(n * trainRatio);
    const valN = Math.floor(n * valRatio);
    // Shuffle indices for each class
    for (let i = idxs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
    }
    trainIdx.push(...idxs.slice(0, trainN));
    valIdx.push(...idxs.slice(trainN, trainN + valN));
    testIdx.push(...idxs.slice(trainN + valN));
  });
  return {
    trainWindows: trainIdx.map(i => windows[i]),
    trainLabels: trainIdx.map(i => labels[i]),
    valWindows: valIdx.map(i => windows[i]),
    valLabels: valIdx.map(i => labels[i]),
    testWindows: testIdx.map(i => windows[i]),
    testLabels: testIdx.map(i => labels[i]),
  };
}

// Usage:
const split = stratifiedSplit(allWindows, allLabels, 0.7, 0.15);
const trainWindows = split.trainWindows;
const trainLabels = split.trainLabels;
const valWindows = split.valWindows;
const valLabels = split.valLabels;
const testWindows = split.testWindows;
const testLabels = split.testLabels;

  // Prepare datasets
  const { xs: xsTrain, ys: ysTrain } = prepareDataset(trainWindows, trainLabels, uniqueLabels);
  const { xs: xsVal, ys: ysVal } = prepareDataset(valWindows, valLabels, uniqueLabels);
  const { xs: xsTest, ys: ysTest } = prepareDataset(testWindows, testLabels, uniqueLabels);

  // Build + train model
   const model = buildModel(windowSize, uniqueLabels.length);
  await model.fit(xsTrain, ysTrain, {
    epochs: 100,
    batchSize: 32,
    validationData: [xsVal, ysVal],
    shuffle: true,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          if (onEpoch) onEpoch(epoch, logs ?? {} as tf.Logs);
           console.log(
          `Epoch ${epoch + 1}: loss=${typeof logs?.loss === 'number' ? logs.loss.toFixed(4) : logs?.loss}, accuracy=${typeof logs?.categoricalAccuracy === 'number' ? logs.categoricalAccuracy.toFixed(4) : logs?.categoricalAccuracy}, val_loss=${typeof logs?.val_loss === 'number' ? logs.val_loss.toFixed(4) : logs?.val_loss}, val_accuracy=${typeof logs?.val_categoricalAccuracy === 'number' ? logs.val_categoricalAccuracy.toFixed(4) : logs?.val_categoricalAccuracy}`
        );
        }
      }
    });
  
    // Evaluate on train, val, and test sets
  const [trainLoss, trainAccScalar] = model.evaluate(xsTrain, ysTrain) as tf.Scalar[];
  const [valLoss, valAccScalar] = model.evaluate(xsVal, ysVal) as tf.Scalar[];
  const [testLoss, testAccScalar] = model.evaluate(xsTest, ysTest) as tf.Scalar[];

  const trainAcc = (await trainAccScalar.data())[0];
  const valAcc = (await valAccScalar.data())[0];
  const testAcc = (await testAccScalar.data())[0];

  console.log(`Train accuracy: ${(trainAcc * 100).toFixed(2)}%`);
  console.log(`Validation accuracy: ${(valAcc * 100).toFixed(2)}%`);
  console.log(`Test accuracy: ${(testAcc * 100).toFixed(2)}%`);

    await model.save("localstorage://ecg-disease-model");
    localStorage.setItem('ecg-class-labels', JSON.stringify(classLabels));
    console.log("✅ Model trained and saved!");

    function printClassCounts(labels: string[], split: string) {
  const counts: Record<string, number> = {};
  labels.forEach(l => { counts[l] = (counts[l] || 0) + 1; });
  console.log(`${split} class counts:`, counts);
}
printClassCounts(trainLabels, "Train");
printClassCounts(valLabels, "Validation");
printClassCounts(testLabels, "Test");

// After accuracy logging
const preds = model.predict(xsTest) as tf.Tensor;
const predArr = Array.from(await preds.argMax(-1).data());
const trueArr = Array.from(await ysTest.argMax(-1).data());
console.log("Sample predictions (true vs predicted):");
for (let i = 0; i < Math.min(10, predArr.length); i++) {
  console.log(`True: ${classLabels[trueArr[i]]}, Predicted: ${classLabels[predArr[i]]}`);
}
}

function kFoldSplit(windows: number[][], labels: string[], k: number) {
  const indices = Array.from({ length: windows.length }, (_, i) => i);
  // Shuffle indices
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const foldSize = Math.floor(windows.length / k);
  const folds = [];
  for (let i = 0; i < k; i++) {
    const start = i * foldSize;
    const end = i === k - 1 ? windows.length : start + foldSize;
    folds.push(indices.slice(start, end));
  }
  return folds;
}

// ...after oversampling allWindows and allLabels...

// Ensure uniqueLabels is defined for k-fold
const uniqueLabels = Array.from(new Set(allLabels));

const k = 5; // Number of folds
const folds = kFoldSplit(allWindows, allLabels, k);

let foldAccuracies: number[] = [];
for (let fold = 0; fold < k; fold++) {
  // Use one fold as test, rest as train
  const testIdx = folds[fold];
  const trainIdx = folds.flatMap((f, i) => i === fold ? [] : f);

  const trainWindows = trainIdx.map(i => allWindows[i]);
  const trainLabels = trainIdx.map(i => allLabels[i]);
  const testWindows = testIdx.map(i => allWindows[i]);
  const testLabels = testIdx.map(i => allLabels[i]);

  // Skip fold if train or test set is empty
  if (!trainWindows.length || !testWindows.length) {
    console.warn(`Skipping fold ${fold + 1}: train or test set is empty.`);
    continue;
  }

  // Prepare datasets
  const { xs: xsTrain, ys: ysTrain } = prepareDataset(trainWindows, trainLabels, uniqueLabels);
  const { xs: xsTest, ys: ysTest } = prepareDataset(testWindows, testLabels, uniqueLabels);

  // Build and train model
  const model = buildModel(windowSize, uniqueLabels.length);
  await model.fit(xsTrain, ysTrain, {
    epochs: 100,
    batchSize: 32,
    shuffle: true,
  });

  // Evaluate
  const [testLoss, testAccScalar] = model.evaluate(xsTest, ysTest) as tf.Scalar[];
  const testAcc = (await testAccScalar.data())[0];
  foldAccuracies.push(testAcc);

  // Confusion matrix for this fold
  const preds = model.predict(xsTest) as tf.Tensor;
  const predArr = Array.from(await preds.argMax(-1).data());
  const trueArr = Array.from(await ysTest.argMax(-1).data());
  const numClasses = uniqueLabels.length;
  const confusion = Array.from({ length: numClasses }, () => Array(numClasses).fill(0));
  for (let i = 0; i < predArr.length; i++) {
    confusion[trueArr[i]][predArr[i]]++;
  }
  console.log(`Fold ${fold + 1} confusion matrix:`);
  console.table(confusion);
}

console.log(`K-fold test accuracies:`, foldAccuracies.map(a => (a * 100).toFixed(2) + "%"));
console.log(`Mean test accuracy: ${(foldAccuracies.reduce((a, b) => a + b, 0) / k * 100).toFixed(2)}%`);

// --- Incremental Training --- //
export async function trainECGModelIncremental(onEpoch?: (epoch: number, logs: tf.Logs) => void) {
  // Use fixed classLabels
  // Remove dynamic detection
  // classLabels = Array.from(allLabelsSet); // Remove this line

  // Build model once
  const model = buildModel(windowSize, classLabels.length);

  // Get all file pairs to train on
  const filePairs = getFilePairs();

  // Train on each file sequentially
  for (const pair of filePairs) {
    const ecgWindows = await loadECG(pair.ecg, windowSize, stepSize);
    const labels = await loadLabels(pair.ann, windowSize, stepSize);
    const n = Math.min(ecgWindows.length, labels.length);
    const windows = ecgWindows.slice(0, n);
    const labs = labels.slice(0, n);

    // Prepare dataset
    const { xs, ys } = prepareDataset(windows, labs, classLabels);

    // Train for a few epochs per file
    await model.fit(xs, ys, {
      epochs: 10, // You can adjust this
      batchSize: 32,
      shuffle: true,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          if (onEpoch) onEpoch(epoch, logs ?? {} as tf.Logs);
          console.log(`File ${pair.ecg}: Epoch ${epoch + 1} - loss=${logs?.loss}, acc=${logs?.categoricalAccuracy}`);
        }
      }
    });
  }

  // Save model after all files
  await model.save("localstorage://ecg-disease-model");
  localStorage.setItem('ecg-class-labels', JSON.stringify(classLabels));
  console.log("✅ Model trained on all files and saved!");
}
