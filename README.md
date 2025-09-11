# ECG Monitor Next

This is an advanced [Next.js](https://nextjs.org) application for real-time ECG monitoring, AI-based beat classification, and heart disease analysis. It connects to Bluetooth ECG devices, visualizes ECG signals, and provides AI-powered insights.

## Features

- **Bluetooth ECG Device Connection:** Connect and stream ECG data in real time.
- **Live ECG Visualization:** Interactive ECG waveform panel.
- **AI Beat Classification:** Detects normal and abnormal beats using a trained neural network.
- **Heart Disease Analysis:** Calculates HRV metrics and provides risk analysis.
- **Session Recording:** Record, save, and review ECG sessions with patient info.
- **Model Training & Inspection:** Train your own ECG classifier and inspect model structure and weights.
- **Documentation:** Built-in docs for usage and workflow.

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   # or
   bun dev
   ```

3. **Open your browser:**
   Visit [http://localhost:3000](http://localhost:3000) to use the app.

## Usage Workflow

1. **Connect Device:**  
   Use the Bluetooth button on the main page to connect your ECG device.

2. **Monitor ECG:**  
   View live ECG data and toggle AI Analysis for beat predictions.

3. **Record Session:**  
   Start and stop recording sessions. Enter patient info for each session.

4. **Analyze Results:**  
   Review session reports with HRV metrics, beat classification, and heart disease risk.

5. **Train Model:**  
   Go to the Training page to train or inspect your AI model.

## Project Structure

- `src/app/page.tsx` — Main ECG monitor interface.
- `src/components/EcgPanel.tsx` — ECG visualization and controls.
- `src/components/SessionRecording.tsx` — Session recording and patient info.
- `src/components/SessionReport.tsx` — Session analysis and reporting.
- `src/components/ModelInspector.tsx` — Model inspection and testing.
- `src/app/train/page.tsx` — Model training workflow.
- `src/lib/` — Core logic for ECG processing, AI, and HRV calculation.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [ECG Signal Processing](https://en.wikipedia.org/wiki/Electrocardiography)
- [TensorFlow.js](https://www.tensorflow.org/js)

## Deployment

Deploy easily on [Vercel](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) or your preferred platform.

See [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for details.

---
**Note:**  
This project is for research and educational purposes. It is not intended for medical diagnosis or treatment. Consult healthcare professionals for medical advice.
