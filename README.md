# ECG Monitor Next

ECG Monitor Next is a comprehensive web application built with [Next.js](https://nextjs.org) for real-time ECG monitoring, AI-powered beat classification, and heart disease analysis. It is designed for researchers, students, and developers interested in biomedical signal processing and machine learning for healthcare.

---

## Important: First-Time User Steps

Before you can use the AI features and beat classification, **you must train your model** using the built-in ECG datasets.  
Follow these steps to get started:

### 1. **Train the AI Model (Required for First Use)**

1. Go to the **Training** page (`/train`).
2. Click the **Train Model** button.
3. Wait for the training process to complete. This may take a few minutes.
4. Once training is finished, the model will be saved in your browser's local storage.
5. You can now use the AI Analysis and Model Inspector features.

> **Note:**  
> If you clear your browser data or use a new device, you will need to retrain the model.

---

## How to Use This Application

### 2. **Setup and Installation**

- **Clone the repository** and install dependencies:
  ```bash
  git clone https://github.com/yourusername/ECG_Monitor.git
  cd ECG_Monitor/ecg-monitor-next
  npm install
  ```

- **Start the development server:**
  ```bash
  npm run dev
  ```
  Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### 3. **Connecting Your ECG Device**

- On the main page, click the **Bluetooth** button.
- Select your ECG device from the list and connect.
- Once connected, live ECG data will stream and display on the waveform panel.

---

### 4. **Monitoring and Analyzing ECG**

- **Live Visualization:**  
  Watch your ECG waveform update in real time.
- **AI Analysis:**  
  Toggle the **AI Analysis** button to enable beat classification. The app will highlight detected beats and display their type.
- **Session Recording:**  
  Click **Start Recording** to begin a session. Enter patient information if prompted. Click **Stop Recording** to end the session.

---

### 5. **Reviewing Session Reports**

- After recording, view the **Session Report** for detailed analysis:
  - Beat classification summary
  - HRV metrics (RMSSD, SDNN, LF/HF ratio, etc.)
  - Heart disease risk indicators
  - Patient information and session details

---

### 6. **Training and Inspecting the AI Model**

- Go to the **Training** page.
- Click **Train Model** to train a new neural network using built-in ECG datasets.
- Inspect the model’s structure, weights, and performance metrics.
- Use the **Model Inspector** to test predictions with your own ECG data.

---

### 7. **Documentation and Help**

- Visit the **Docs** page for step-by-step instructions, workflow diagrams, and troubleshooting tips.
- Each page includes tooltips and guidance for new users.

---

## How Is This Application Helpful?

- **For Researchers:**  
  Rapidly prototype and test ECG analysis algorithms, visualize results, and export session data for further study.

- **For Students:**  
  Learn about ECG signal processing, machine learning, and biomedical engineering with hands-on tools.

- **For Developers:**  
  Integrate real-time biomedical data streams, experiment with TensorFlow.js models, and extend the app for custom use cases.

- **For Healthcare Enthusiasts:**  
  Understand your heart’s activity, explore AI-powered analysis, and record sessions for personal tracking (not for medical diagnosis).

---

## Project Structure

- `src/app/page.tsx` — Main ECG monitor interface.
- `src/components/EcgPanel.tsx` — ECG visualization and controls.
- `src/components/SessionRecording.tsx` — Session recording and patient info.
- `src/components/SessionReport.tsx` — Session analysis and reporting.
- `src/components/ModelInspector.tsx` — Model inspection and testing.
- `src/app/train/page.tsx` — Model training workflow.
- `src/lib/` — Core logic for ECG processing, AI, and HRV calculation.

---

## Deployment

- **Local:**  
  Run with `npm run dev` for development.
- **Production:**  
  Deploy on [Vercel](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme), GitHub Pages, or any static hosting platform.  
  Ensure all required CSV data files are present in the `public` folder and update file paths for your hosting environment.

---

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [ECG Signal Processing](https://en.wikipedia.org/wiki/Electrocardiography)
- [TensorFlow.js](https://www.tensorflow.org/js)

---

## Disclaimer

This project is for research and educational purposes only.  
It is **not intended for medical diagnosis or treatment**.  
Consult healthcare professionals for medical advice.
