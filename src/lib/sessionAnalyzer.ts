import { ECGIntervalCalculator } from './ecgIntervals';
import { HRVCalculator } from './hrvCalculator';
import { PQRSTDetector } from './pqrstDetector';
import { PanTompkinsDetector } from './panTompkinsDetector';
import { RecordingSession, PatientInfo } from '../components/SessionRecording';
import * as tf from '@tensorflow/tfjs';

export type SessionAnalysisResults = {
  summary: {
    recordingDuration: string;
    recordingDurationSeconds?: number; // <-- Add this
    rPeaks?: number[];                // <-- Add this
    heartRate: {
      average: number;
      min: number;
      max: number;
      status: string;
    };
    rhythm: {
      classification: string;
      confidence: number;
      irregularBeats: number;
      percentIrregular: number;
    };
  };
  intervals: {
    pr: {
      average: number;
      status: string;
    };
    qrs: {
      average: number;
      status: string;
    };
    qt: {
      average: number;
    };
    qtc: {
      average: number;
      status: string;
    };
    st: {
      deviation: number;
      status: string;
    };
  };
  hrv: {
    timeMetrics: {
      rmssd: number;
      sdnn: number;
      pnn50: number;
      triangularIndex: number;
    };
    frequencyMetrics: {
      lf: number;
      hf: number;
      lfhfRatio: number;
    };
    assessment: {
      status: string;
      description: string;
    };
    physiologicalState: {
      state: string;
      confidence: number;
    };
  };
  aiClassification: {
    prediction: string;
    confidence: number;
    explanation: string;
  };
  abnormalities: {
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }[];
  recommendations: string[];
};

export class SessionAnalyzer {
  private panTompkins: PanTompkinsDetector;
  private pqrstDetector: PQRSTDetector;
  private intervalCalculator: ECGIntervalCalculator;
  private hrvCalculator: HRVCalculator;
  private model: tf.LayersModel | null = null;

  constructor(sampleRate: number) {
    this.panTompkins = new PanTompkinsDetector(sampleRate);
    this.pqrstDetector = new PQRSTDetector(sampleRate);
    this.intervalCalculator = new ECGIntervalCalculator(sampleRate);
    this.hrvCalculator = new HRVCalculator();
  }

  async loadModel() {
    try {
      const modelSources = [
        'localstorage://beat-level-ecg-model',
        '/models/beat-level-ecg-model.json',
        '/assets/beat-level-ecg-model.json',
        'https://your-domain.com/models/beat-level-ecg-model.json'
      ];

      for (const modelUrl of modelSources) {
        try {
          console.log(`Attempting to load model from: ${modelUrl}`);
          if (modelUrl.startsWith('localstorage://')) {
            const models = await tf.io.listModels();
            if (!models[modelUrl]) {
              console.log(`Model not found in localStorage: ${modelUrl}`);
              continue;
            }
          }
          this.model = await tf.loadLayersModel(modelUrl);
          console.log(`Model loaded successfully from: ${modelUrl}`);
          return true;
        } catch (err) {
          console.log(`Failed to load model from ${modelUrl}:`, err);
          continue;
        }
      }
      console.warn('No model could be loaded from any source');
      return false;
    } catch (err) {
      console.error('Failed to load model:', err);
      this.model = null;
      return false;
    }
  }

  public async analyzeSession(session: RecordingSession): Promise<SessionAnalysisResults> {
    let intervals = session.intervals;

    if (!intervals) {
      console.warn("No interval data in session");
      if (session.pqrstPoints && session.pqrstPoints.length > 0) {
        const calculator = new ECGIntervalCalculator(session.sampleRate);
        session.intervals = calculator.calculateIntervals(session.pqrstPoints);
      } else {
        session.intervals = {
          rr: 0,
          bpm: 0,
          pr: 0,
          qrs: 0,
          qt: 0,
          qtc: 0,
          status: {
            rr: 'unknown',
            bpm: 'unknown',
            pr: 'unknown',
            qrs: 'unknown',
            qt: 'unknown',
            qtc: 'unknown'
          }
        };
      }
      intervals = session.intervals;
    }

    const { ecgData, patientInfo, sampleRate, duration } = session;

    this.intervalCalculator.setGender(patientInfo.gender);

    // 1. Detect R-peaks
    const peaks = this.panTompkins.detectQRS(ecgData);

    // 2. Detect PQRST waves
    const pqrstPoints = this.pqrstDetector.detectWaves(ecgData, peaks, 0);

    // 3. Calculate ECG intervals
    intervals = session.intervals || this.intervalCalculator.calculateIntervals(pqrstPoints);

    // 4. Calculate HRV metrics
    this.hrvCalculator.extractRRFromPeaks(peaks, sampleRate);
    const hrvMetrics = this.hrvCalculator.getAllMetrics();
    const physioState = this.hrvCalculator.getPhysiologicalState();

    // 5. Analyze ST segment
    const stSegmentData = this.analyzeSTSegment(pqrstPoints);

    // 6. Run AI classification
    const aiClassification = await this.runAIClassification(
      intervals,
      stSegmentData,
      hrvMetrics,
      patientInfo
    );

    // 7. Determine abnormalities
    const abnormalities = this.detectAbnormalities(
      intervals,
      stSegmentData,
      hrvMetrics,
      aiClassification,
      patientInfo
    );

    // 8. Generate recommendations
    const recommendations = this.generateRecommendations(
      abnormalities,
      aiClassification,
      patientInfo
    );

    // 9. Calculate summary statistics
    const heartRates = this.calculateHeartRateStats(peaks, sampleRate, duration);

    return {
      summary: {
        recordingDuration: this.formatDuration(duration),
        recordingDurationSeconds: duration, // <-- Add this
        rPeaks: peaks,                     // <-- Add this
        heartRate: {
          average: heartRates.average,
          min: heartRates.min,
          max: heartRates.max,
          status: this.determineHeartRateStatus(heartRates.average)
        },
        rhythm: {
          classification: aiClassification.prediction,
          confidence: aiClassification.confidence,
          irregularBeats: this.countIrregularBeats(peaks, sampleRate),
          percentIrregular: this.calculatePercentIrregular(peaks, sampleRate)
        }
      },
      intervals: {
        pr: {
          average: intervals?.pr || 0,
          status: intervals?.status.pr || 'unknown'
        },
        qrs: {
          average: intervals?.qrs || 0,
          status: intervals?.status.qrs || 'unknown'
        },
        qt: {
          average: intervals?.qt || 0
        },
        qtc: {
          average: intervals?.qtc || 0,
          status: intervals?.status.qtc || 'unknown'
        },
        st: {
          deviation: stSegmentData?.deviation || 0,
          status: stSegmentData?.status || 'unknown'
        }
      },
      hrv: {
        timeMetrics: {
          rmssd: hrvMetrics.rmssd,
          sdnn: hrvMetrics.sdnn,
          pnn50: hrvMetrics.pnn50,
          triangularIndex: hrvMetrics.triangularIndex
        },
        frequencyMetrics: {
          lf: hrvMetrics.lfhf.lf,
          hf: hrvMetrics.lfhf.hf,
          lfhfRatio: hrvMetrics.lfhf.ratio
        },
        assessment: hrvMetrics.assessment,
        physiologicalState: {
          state: physioState.state,
          confidence: physioState.confidence
        }
      },
      aiClassification,
      abnormalities,
      recommendations
    };
  }

  private analyzeSTSegment(pqrstPoints: any[]): { deviation: number; status: string } | null {
    // Implementation similar to your existing analyzeSTSegment method
    // ...
    return null; // Replace with actual implementation
  }

  private async runAIClassification(
    intervals: any,
    stSegmentData: any,
    hrvMetrics: any,
    patientInfo: PatientInfo
  ): Promise<{ prediction: string; confidence: number; explanation: string }> {
    if (!this.model || !intervals) {
      return {
        prediction: "Analysis Failed",
        confidence: 0,
        explanation: "Could not run AI analysis due to missing model or data."
      };
    }

    try {
      let features = [
        intervals.rr,
        intervals.bpm,
        intervals.pr,
        intervals.qrs,
        intervals.qt,
        intervals.qtc,
        stSegmentData?.deviation || 0,
        hrvMetrics?.rmssd || 0,
        hrvMetrics?.sdnn || 0,
        hrvMetrics?.lfhf?.ratio || 0,
        patientInfo.age / 100,
        patientInfo.gender === 'male' ? 1 : 0,
        patientInfo.weight / 100,
        patientInfo.height / 200,
      ];

      // Always pad or slice to 187 elements
      if (features.length < 187) {
        features = features.concat(Array(187 - features.length).fill(0));
      } else if (features.length > 187) {
        features = features.slice(0, 187);
      }

      const inputTensor = tf.tensor3d([features.map(v => [v])], [1, 187, 1]);
      const outputTensor = this.model.predict(inputTensor) as tf.Tensor;
      const probabilities = await outputTensor.data();

      const predArray = Array.from(probabilities);
      const maxIndex = predArray.indexOf(Math.max(...predArray));
      let predictedClass = this.getClassLabel(maxIndex);
      const confidence = predArray[maxIndex] * 100;

      if (
        predictedClass === "Atrial Fibrillation" &&
        (hrvMetrics?.percentIrregular !== undefined && hrvMetrics?.irregularBeats !== undefined &&
         hrvMetrics.percentIrregular <= 20 && hrvMetrics.irregularBeats <= 3)
      ) {
        predictedClass = "Normal Sinus Rhythm";
      }

      inputTensor.dispose();
      outputTensor.dispose();

      return {
        prediction: predictedClass,
        confidence,
        explanation: this.getExplanationForClass(predictedClass)
      };
    } catch (err) {
      console.error('AI classification failed:', err);
      return {
        prediction: "Error",
        confidence: 0,
        explanation: "An error occurred during analysis."
      };
    }
  }

  private getClassLabel(index: number): string {
    const labels = [
      "Normal Sinus Rhythm",
      "Atrial Fibrillation",
      "First-degree AV Block",
      "Left Bundle Branch Block",
      "Right Bundle Branch Block",
      "Premature Atrial Contraction",
      "Premature Ventricular Contraction",
      "ST Elevation",
      "ST Depression"
    ];
    return labels[index] || "Unknown";
  }

  private getExplanationForClass(className: string): string {
    const explanations: {[key: string]: string} = {
      "Normal Sinus Rhythm": "Your heart's electrical activity appears normal with regular rhythm.",
      "Atrial Fibrillation": "Irregular heart rhythm potentially indicating atrial fibrillation.",
      "First-degree AV Block": "Delayed electrical conduction between the atria and ventricles.",
      "Left Bundle Branch Block": "Delayed activation of the left ventricle.",
      "Right Bundle Branch Block": "Delayed activation of the right ventricle.",
      "Premature Atrial Contraction": "Early beats originating in the atria.",
      "Premature Ventricular Contraction": "Early beats originating in the ventricles.",
      "ST Elevation": "Elevation of the ST segment potentially indicating myocardial injury.",
      "ST Depression": "Depression of the ST segment potentially indicating ischemia."
    };

    return explanations[className] ||
      "The AI model has identified patterns in your ECG that require further analysis.";
  }

  private detectAbnormalities(
    intervals: any,
    stSegmentData: any,
    hrvMetrics: any,
    aiClassification: any,
    patientInfo: PatientInfo
  ): { type: string; severity: 'low' | 'medium' | 'high'; description: string }[] {
    const abnormalities: { type: string; severity: 'low' | 'medium' | 'high'; description: string }[] = [];

    if (intervals) {
      if (intervals.status.bpm === 'bradycardia') {
        abnormalities.push({
          type: 'Bradycardia',
          severity: 'medium',
          description: 'Slow heart rate detected, which may indicate an underlying condition.'
        });
      }

      if (intervals.status.bpm === 'tachycardia') {
        abnormalities.push({
          type: 'Tachycardia',
          severity: 'medium',
          description: 'Elevated heart rate detected, which could be due to exertion, stress, or cardiac issues.'
        });
      }

      if (
        (aiClassification.prediction === "Atrial Fibrillation" || aiClassification.prediction === "AFib") &&
        ((hrvMetrics?.percentIrregular ?? 0) > 20 || (hrvMetrics?.irregularBeats ?? 0) > 3)
      ) {
        abnormalities.push({
          type: "Atrial Fibrillation",
          description: "Irregular heart rhythm potentially indicating atrial fibrillation.",
          severity: "high"
        });
      }
    }

    return abnormalities;
  }

  private generateRecommendations(
    abnormalities: any[],
    aiClassification: any,
    patientInfo: PatientInfo
  ): string[] {
    const recommendations = [];

    recommendations.push(
      "Remember that this device is not a medical diagnostic tool. Always consult with a healthcare professional."
    );

    if (abnormalities.length > 0 || aiClassification.prediction !== "Normal Sinus Rhythm") {
      recommendations.push(
        "Based on the patterns detected, consider scheduling a consultation with a cardiologist."
      );
    }

    return recommendations;
  }

  private calculateHeartRateStats(peaks: number[], sampleRate: number, duration: number): {
    average: number;
    min: number;
    max: number;
  } {
    if (!peaks || peaks.length < 2) {
      console.warn("No valid R-peaks detected.");
      return { average: 0, min: 0, max: 0 };
    }

    console.log("Detected R-peaks:", peaks.length, peaks);

    const rrIntervals = [];
    for (let i = 1; i < peaks.length; i++) {
      const rr = (peaks[i] - peaks[i-1]) * (1000 / sampleRate);
      rrIntervals.push(rr);
    }
    console.log("RR intervals (ms):", rrIntervals);

    // Filter RR intervals to physiological range (300ms to 2000ms)
    const filteredRRs = rrIntervals.filter(rr => rr >= 300 && rr <= 2000);
    console.log("Filtered RR intervals (ms):", filteredRRs);

    if (filteredRRs.length === 0) {
      console.warn("No valid RR intervals after filtering.");
      return { average: 0, min: 0, max: 0 };
    }

    const instantHRs = filteredRRs.map(rr => 60000 / rr);

    const average = instantHRs.reduce((sum, hr) => sum + hr, 0) / instantHRs.length;
    const min = Math.min(...instantHRs);
    const max = Math.max(...instantHRs);

    return {
      average: isNaN(average) ? 0 : average,
      min: isNaN(min) ? 0 : min,
      max: isNaN(max) ? 0 : max
    };
  }

  private countIrregularBeats(peaks: number[], sampleRate: number): number {
    if (!peaks || peaks.length < 3) return 0;
    const rrIntervals = [];
    for (let i = 1; i < peaks.length; i++) {
      rrIntervals.push((peaks[i] - peaks[i-1]) * (1000 / sampleRate));
    }
    const median = rrIntervals.sort((a, b) => a - b)[Math.floor(rrIntervals.length / 2)];
    return rrIntervals.filter(rr => Math.abs(rr - median) > median * 0.2).length;
  }

  private calculatePercentIrregular(peaks: number[], sampleRate: number): number {
    // Logic to calculate percentage of irregular beats
    // ...
    return 0; // Replace with actual implementation
  }

  private formatDuration(seconds: number): string {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  private determineHeartRateStatus(bpm: number): string {
    if (isNaN(bpm) || bpm <= 0) return 'unknown';
    if (bpm < 60) return 'bradycardia';
    if (bpm > 100) return 'tachycardia';
    return 'normal';
  }
}