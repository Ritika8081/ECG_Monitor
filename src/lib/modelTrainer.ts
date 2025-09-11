import * as tf from "@tensorflow/tfjs";
import Papa from "papaparse";

// --- 1. Map MIT-BIH annotation symbols to AAMI 5-class standard ---
export const AAMI_CLASSES = ["Normal", "Supraventricular", "Ventricular", "Fusion", "Other"];

export const classLabels = AAMI_CLASSES;

export function mapAnnotationToAAMI(symbol: string): string | null {
  if (['N', '.', 'L', 'R', 'e', 'j'].includes(symbol)) return 'Normal';
  if (['A', 'a', 'J', 'S'].includes(symbol)) return 'Supraventricular';
  if (['V', 'E', 'r'].includes(symbol)) return 'Ventricular';
  if (['F'].includes(symbol)) return 'Fusion';
  if (['Q', '/', 'f', 'n'].includes(symbol)) return 'Other';
  return null;
}

// --- 2. Load ECG and annotation files, extract beats around R-peaks ---
export async function loadBeatLevelData(ecgPath: string, annPath: string, beatLength = 187) {
  // Load ECG CSV (MLII lead)
  const ecgSignal: number[] = await new Promise((resolve, reject) => {
    Papa.parse(ecgPath, {
      download: true,
      header: false,
      complete: (results) => {
        const signal = results.data
          .map((row) => Number((row as [string, string])[1])) // Cast row to [string, string]
          .filter((v: number) => !isNaN(v));
        resolve(signal);
      },
      error: reject
    });
  });

  // Load annotation CSV (index, annotation_symbol)
  const annotations: { index: number, annotation_symbol: string }[] = await new Promise((resolve, reject) => {
    Papa.parse(annPath, {
      download: true,
      header: true,
      complete: (results) => {
        const anns = results.data
          .map((row) => {
            const r = row as { index: string; annotation_symbol: string };
            return {
              index: Number(r.index),
              annotation_symbol: r.annotation_symbol
            };
          })
          .filter((ann: { index: number; annotation_symbol: string }) => !isNaN(ann.index));
        resolve(anns);
      },
      error: reject
    });
  });

  // Extract beats around R-peaks
  const beats: number[][] = [];
  const labels: string[] = [];
  const halfBeat = Math.floor(beatLength / 2);

  annotations.forEach(ann => {
    const mappedClass = mapAnnotationToAAMI(ann.annotation_symbol);
    if (!mappedClass) return;
    const startIdx = ann.index - halfBeat;
    const endIdx = ann.index + halfBeat + 1;
    if (startIdx >= 0 && endIdx < ecgSignal.length) {
      const beat = ecgSignal.slice(startIdx, endIdx);
      if (beat.length === beatLength) {
        // Z-score normalization
        const mean = beat.reduce((a, b) => a + b, 0) / beat.length;
        const std = Math.sqrt(beat.reduce((a, b) => a + (b - mean) ** 2, 0) / beat.length);
        if (std > 0.001) {
          beats.push(beat.map(x => (x - mean) / std));
          labels.push(mappedClass);
        }
      }
    }
  });

  return { beats, labels };
}

// --- 3. Balance classes for training ---
export function prepareBalancedBeatDataset(beats: number[][], labels: string[]) {
  const classData: Record<string, number[][]> = {};
  beats.forEach((beat, idx) => {
    const label = labels[idx];
    if (!classData[label]) classData[label] = [];
    classData[label].push(beat);
  });
  const classes = Object.keys(classData);
  const minSize = Math.min(...classes.map(cls => classData[cls].length));
  const targetSize = Math.max(500, minSize);

  const balancedBeats: number[][] = [];
  const balancedLabels: string[] = [];
  classes.forEach(cls => {
    const classBeats = classData[cls];
    for (let i = 0; i < targetSize; i++) {
      balancedBeats.push(classBeats[i % classBeats.length]);
      balancedLabels.push(cls);
    }
  });

  // Shuffle
  for (let i = balancedBeats.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [balancedBeats[i], balancedBeats[j]] = [balancedBeats[j], balancedBeats[i]];
    [balancedLabels[i], balancedLabels[j]] = [balancedLabels[j], balancedLabels[i]];
  }

  return { beats: balancedBeats, labels: balancedLabels, classes };
}

// --- 4. Build optimized CNN model for beat-level classification ---
export function buildBeatLevelModel(inputLength: number, numClasses: number): tf.LayersModel {
  const model = tf.sequential();
  model.add(tf.layers.conv1d({ inputShape: [inputLength, 1], filters: 32, kernelSize: 5, activation: 'relu', padding: 'same', kernelInitializer: 'glorotNormal' }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.maxPooling1d({ poolSize: 2 }));
  model.add(tf.layers.dropout({ rate: 0.2 }));

  model.add(tf.layers.conv1d({ filters: 64, kernelSize: 5, activation: 'relu', padding: 'same', kernelInitializer: 'glorotNormal' }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.maxPooling1d({ poolSize: 2 }));
  model.add(tf.layers.dropout({ rate: 0.2 }));

  model.add(tf.layers.conv1d({ filters: 128, kernelSize: 3, activation: 'relu', padding: 'same', kernelInitializer: 'glorotNormal' }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.maxPooling1d({ poolSize: 2 }));
  model.add(tf.layers.dropout({ rate: 0.3 }));

  model.add(tf.layers.conv1d({ filters: 256, kernelSize: 3, activation: 'relu', padding: 'same', kernelInitializer: 'glorotNormal' }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.globalAveragePooling1d());

  model.add(tf.layers.dense({ units: 128, activation: 'relu', kernelRegularizer: tf.regularizers.l2({ l2: 0.01 }), kernelInitializer: 'glorotNormal' }));
  model.add(tf.layers.dropout({ rate: 0.5 }));

  model.add(tf.layers.dense({ units: 64, activation: 'relu', kernelRegularizer: tf.regularizers.l2({ l2: 0.01 }), kernelInitializer: 'glorotNormal' }));
  model.add(tf.layers.dropout({ rate: 0.3 }));

  model.add(tf.layers.dense({ units: numClasses, activation: 'softmax', kernelInitializer: 'glorotNormal' }));

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'categoricalCrossentropy',
    metrics: ['categoricalAccuracy']
  });

  return model;
}

// --- 5. Utility: Convert beats/labels to tensors for training ---
export function beatsToTensors(beats: number[][], labels: string[], classes: string[]) {
  const X = tf.tensor3d(beats.map(beat => beat.map(val => [val])));
  const classMap = classes.reduce((map, cls, idx) => ({ ...map, [cls]: idx }), {} as Record<string, number>);
  const y = tf.oneHot(tf.tensor1d(labels.map(label => classMap[label]), 'int32'), classes.length);
  return { X, y, classMap };
}

// --- Utility: Z-score normalization for a beat or window ---
export function zscoreNorm(arr: number[]): number[] {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);
  return std > 0.001 ? arr.map(x => (x - mean) / std) : arr.map(() => 0);
}

// --- 6. Example: Train beat-level model (call from React page) ---
export async function trainBeatLevelECGModel(ecgPath: string, annPath: string, onEpoch?: (epoch: number, logs: tf.Logs) => void) {
  const { beats, labels } = await loadBeatLevelData(ecgPath, annPath, 187);
  const { beats: balancedBeats, labels: balancedLabels, classes } = prepareBalancedBeatDataset(beats, labels);
  const { X, y } = beatsToTensors(balancedBeats, balancedLabels, classes);

  // Split data
  const totalSamples = balancedBeats.length;
  const trainSize = Math.floor(totalSamples * 0.7);
  const valSize = Math.floor(totalSamples * 0.15);
  const [xTrain, xRest] = tf.split(X, [trainSize, totalSamples - trainSize]);
  const [yTrain, yRest] = tf.split(y, [trainSize, totalSamples - trainSize]);
  const [xVal, xTest] = tf.split(xRest, [valSize, totalSamples - trainSize - valSize]);
  const [yVal, yTest] = tf.split(yRest, [valSize, totalSamples - trainSize - valSize]);

  const model = buildBeatLevelModel(187, classes.length);

  await model.fit(xTrain, yTrain, {
    epochs: 50,
    batchSize: 32,
    validationData: [xVal, yVal],
    shuffle: true,
    callbacks: {
      onEpochEnd: async (epoch, logs) => {
        if (onEpoch) onEpoch(epoch, logs ?? {} as tf.Logs);
      }
    }
  });

  await model.save('localstorage://beat-level-ecg-model');
  X.dispose(); y.dispose(); xTrain.dispose(); yTrain.dispose(); xVal.dispose(); yVal.dispose(); xTest.dispose(); yTest.dispose();
  return model;
}

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

// --- Train using all file pairs ---
export async function trainBeatLevelECGModelAllFiles(onEpoch?: (epoch: number, logs: tf.Logs) => void) {
  let allBeats: number[][] = [];
  let allLabels: string[] = [];

  console.log("Loading all file pairs...");
  for (const pair of allFilePairs) {
    try {
      const { beats, labels } = await loadBeatLevelData(pair.ecg, pair.ann, 187);
      console.log(`Loaded ${pair.ecg}: ${beats.length} beats`);
      allBeats.push(...beats);
      allLabels.push(...labels);
    } catch (err) {
      console.warn(`Failed to load ${pair.ecg} or ${pair.ann}:`, err);
    }
  }

  console.log(`Total beats loaded: ${allBeats.length}`);
  if (allBeats.length === 0) {
    throw new Error("No beats loaded. Check your data files and paths.");
  }

  const { beats: balancedBeats, labels: balancedLabels, classes } = prepareBalancedBeatDataset(allBeats, allLabels);
  console.log(`Balanced dataset: ${balancedBeats.length} beats, classes: ${classes.join(", ")}`);

  const { X, y } = beatsToTensors(balancedBeats, balancedLabels, classes);

  // Split data
  const totalSamples = balancedBeats.length;
  const trainSize = Math.floor(totalSamples * 0.7);
  const valSize = Math.floor(totalSamples * 0.15);
  console.log(`Splitting data: train=${trainSize}, val=${valSize}, test=${totalSamples - trainSize - valSize}`);

  const [xTrain, xRest] = tf.split(X, [trainSize, totalSamples - trainSize]);
  const [yTrain, yRest] = tf.split(y, [trainSize, totalSamples - trainSize]);
  const [xVal, xTest] = tf.split(xRest, [valSize, totalSamples - trainSize - valSize]);
  const [yVal, yTest] = tf.split(yRest, [valSize, totalSamples - trainSize - valSize]);

  const model = buildBeatLevelModel(187, classes.length);

  let bestValAcc = 0;

  console.log("Starting model.fit...");
  await model.fit(xTrain, yTrain, {
    epochs: 10,
    batchSize: 32,
    validationData: [xVal, yVal],
    shuffle: true,
    callbacks: {
      onEpochEnd: async (epoch, logs) => {
        const trainAcc = (logs?.acc || logs?.categoricalAccuracy || 0) * 100;
        const valAcc = (logs?.val_acc || logs?.val_categoricalAccuracy || 0) * 100;
        const trainLoss = logs?.loss?.toFixed(4);
        const valLoss = logs?.val_loss?.toFixed(4);
        bestValAcc = Math.max(bestValAcc, valAcc);

        console.log(
          `Epoch ${epoch + 1}/50 | Train Acc: ${trainAcc.toFixed(2)}% | Val Acc: ${valAcc.toFixed(2)}% | Train Loss: ${trainLoss} | Val Loss: ${valLoss}`
        );

        if (onEpoch) onEpoch(epoch, logs ?? {} as tf.Logs);
      }
    }
  });

  console.log("Evaluating on test set...");
  // Evaluate on test set
  const evalResult = await model.evaluate(xTest, yTest);
  let testAcc = 0;
  if (Array.isArray(evalResult)) {
    testAcc = (await evalResult[1].data())[0] * 100;
  } else {
    testAcc = (await evalResult.data())[0] * 100;
  }

  console.log(`Test Accuracy: ${testAcc.toFixed(2)}%`);
  console.log(`Best Validation Accuracy: ${bestValAcc.toFixed(2)}%`);

  // Print detected classes
  console.log("Detected Classes:", classes);

  // Per-class metrics
  const predictions = model.predict(xTest) as tf.Tensor;
  const predClasses = await tf.argMax(predictions, 1).data();
  const trueClasses = await tf.argMax(yTest, 1).data();

  classes.forEach((className, classIdx) => {
    const tp = Array.from(predClasses).filter((pred, i) => pred === classIdx && trueClasses[i] === classIdx).length;
    const fp = Array.from(predClasses).filter((pred, i) => pred === classIdx && trueClasses[i] !== classIdx).length;
    const fn = Array.from(trueClasses).filter((true_, i) => true_ === classIdx && predClasses[i] !== classIdx).length;

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

    console.log(
      `${className}: Precision=${(precision * 100).toFixed(1)}%, Recall=${(recall * 100).toFixed(1)}%, F1=${(f1Score * 100).toFixed(1)}%`
    );
  });

  await model.save('localstorage://beat-level-ecg-model');
  X.dispose(); y.dispose(); xTrain.dispose(); yTrain.dispose(); xVal.dispose(); yVal.dispose(); xTest.dispose(); yTest.dispose();
  predictions.dispose();
  return model;
}
