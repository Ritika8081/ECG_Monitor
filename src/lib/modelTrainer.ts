import * as tf from "@tensorflow/tfjs";

// Sample dataset — we'll replace this with real or synthetic data later
const rawData = [
  {
    input: [950, 60, 180, 100, 380, 450, 0.1, 30, 40, 2.0],
    label: "Bradycardia",
  },
  {
    input: [450, 130, 160, 90, 360, 390, -0.3, 28, 45, 3.5],
    label: "Tachycardia",
  },
  {
    input: [860, 72, 220, 140, 390, 470, 0.6, 45, 42, 1.9],
    label: "BundleBranchBlock",
  },
  {
    input: [800, 75, 160, 100, 420, 460, 1.0, 35, 30, 1.2],
    label: "STEMI",
  },
  {
    input: [810, 77, 160, 110, 380, 440, -0.6, 50, 30, 1.1],
    label: "MyocardialIschemia",
  },
  {
    input: [870, 90, 170, 90, 390, 430, 0.3, 40, 28, 2.2],
    label: "AFib",
  },
];

// Update your dataset with more examples

// Generate a sample with random variation around base values
function generateSample(baseInput: number[], label: string, count: number = 5) {
  const samples = [];
  for (let i = 0; i < count; i++) {
    // Add random variation to each feature (±10%)
    const input = baseInput.map(value => {
      const variation = value * 0.1; // 10% variation
      return value + (Math.random() * variation * 2 - variation);
    });
    samples.push({ input, label });
  }
  return samples;
}

// Base values for different conditions
const baseValues = {
  Normal: [800, 75, 160, 90, 380, 420, 0.0, 35, 50, 1.5],
  Bradycardia: [950, 60, 180, 100, 380, 450, 0.1, 30, 40, 2.0],
  Tachycardia: [450, 130, 160, 90, 360, 390, -0.3, 28, 45, 3.5],
  BundleBranchBlock: [860, 72, 220, 140, 390, 470, 0.6, 45, 42, 1.9],
  STEMI: [800, 75, 160, 100, 420, 460, 1.0, 35, 30, 1.2],
  MyocardialIschemia: [810, 77, 160, 110, 380, 440, -0.6, 50, 30, 1.1],
  AFib: [870, 90, 170, 90, 390, 430, 0.3, 40, 28, 2.2]
};

// Generate expanded dataset
let expandedRawData: { input: number[]; label: string }[] = [];

// Add samples for each condition
for (const [condition, baseInput] of Object.entries(baseValues)) {
  expandedRawData = expandedRawData.concat(
    generateSample(baseInput, condition, 10) // 10 samples per condition
  );
}

// Export class labels so they can be used in the ModelInspector component
export const classLabels = [
  "Normal",
  "Bradycardia",
  "Tachycardia",
  "BundleBranchBlock",
  "STEMI",
  "MyocardialIschemia",
  "AFib"
];

export async function trainEcgModel() {
  // STEP 1: Prepare input (X) and label (Y)
  const inputs = expandedRawData.map((d) => d.input);
  const labels = expandedRawData.map((d) =>
    classLabels.map((label) => (label === d.label ? 1 : 0)) // one-hot encode
  );

  const xs = tf.tensor2d(inputs);
  const ys = tf.tensor2d(labels);

  // STEP 2: Build the model
  const model = tf.sequential();
  model.add(tf.layers.dense({ inputShape: [10], units: 32, activation: "relu" }));
  model.add(tf.layers.dense({ units: 16, activation: "relu" }));
  model.add(tf.layers.dense({ units: classLabels.length, activation: "softmax" }));

  model.compile({
    optimizer: "adam",
    loss: "categoricalCrossentropy",
    metrics: ["accuracy"],
  });

  // STEP 3: Train the model
  await model.fit(xs, ys, {
    epochs: 40,
    batchSize: 2,
    validationSplit: 0.2,
    callbacks: tf.callbacks.earlyStopping({ patience: 5 }),
  });

  // STEP 4: Save the model in local browser storage
  await model.save("localstorage://ecg-disease-model");
  console.log("✅ Model trained and saved in local storage!");
}