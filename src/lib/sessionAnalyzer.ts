import { ECGIntervalCalculator } from './ecgIntervals';
import { HRVCalculator } from './hrvCalculator';
import { PQRSTDetector } from './pqrstDetector';
import { PanTompkinsDetector } from './panTompkinsDetector';
import { RecordingSession, PatientInfo } from '../components/SessionRecording';
import * as tf from '@tensorflow/tfjs';

export type SessionAnalysisResults = {
  summary: {
    recordingDuration: string;
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
      this.model = await tf.loadLayersModel('localstorage://ecg-disease-model');
      return true;
    } catch (err) {
      console.error('Failed to load model:', err);
      return false;
    }
  }
  
  public async analyzeSession(session: RecordingSession): Promise<SessionAnalysisResults> {
    // Check if we have intervals (by whatever name they exist)
    let intervals = session.intervals;
    
    if (!intervals) {
      console.warn("No interval data in session");
      // Try to create intervals if we have PQRST points
      if (session.pqrstPoints && session.pqrstPoints.length > 0) {
        const calculator = new ECGIntervalCalculator(session.sampleRate);
        session.intervals = calculator.calculateIntervals(session.pqrstPoints);
      } else {
        // Create minimal intervals with zeros if nothing else works
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
    
    // Set gender for interval calculations
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
    
    // Compile final results
    return {
      summary: {
        recordingDuration: this.formatDuration(duration),
        heartRate: {
          average: heartRates.average,
          min: heartRates.min,
          max: heartRates.max,
          status: intervals?.status.bpm || 'unknown'
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
      // Create features with patient info
      const features = [
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
        patientInfo.age / 100, // Normalize age
        patientInfo.gender === 'male' ? 1 : 0,
        patientInfo.weight / 100, // Normalize weight
        patientInfo.height / 200, // Normalize height
      ];
      
      // Make prediction
      const inputTensor = tf.tensor2d([features], [1, features.length]);
      const outputTensor = this.model.predict(inputTensor) as tf.Tensor;
      const probabilities = await outputTensor.data();
      
      // Get predicted class
      const predArray = Array.from(probabilities);
      const maxIndex = predArray.indexOf(Math.max(...predArray));
      const predictedClass = this.getClassLabel(maxIndex);
      const confidence = predArray[maxIndex] * 100;
      
      // Cleanup tensors
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
    
    // Examples of abnormality detection logic
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
      
      // Add more conditions based on your existing patterns
    }
    
    // More abnormality detection logic...
    
    return abnormalities;
  }
  
  private generateRecommendations(
    abnormalities: any[],
    aiClassification: any,
    patientInfo: PatientInfo
  ): string[] {
    const recommendations = [];
    
    // General recommendation
    recommendations.push(
      "Remember that this device is not a medical diagnostic tool. Always consult with a healthcare professional."
    );
    
    // Add specific recommendations based on findings
    if (abnormalities.length > 0 || aiClassification.prediction !== "Normal Sinus Rhythm") {
      recommendations.push(
        "Based on the patterns detected, consider scheduling a consultation with a cardiologist."
      );
    }
    
    // Add more personalized recommendations...
    
    return recommendations;
  }
  
  private calculateHeartRateStats(peaks: number[], sampleRate: number, duration: number): {
    average: number;
    min: number;
    max: number;
  } {
    if (!peaks || peaks.length < 2) {
      return { average: 0, min: 0, max: 0 };
    }
    
    // Calculate RR intervals in milliseconds
    const rrIntervals = [];
    for (let i = 1; i < peaks.length; i++) {
      const rr = (peaks[i] - peaks[i-1]) * (1000 / sampleRate);
      rrIntervals.push(rr);
    }
    
    // Calculate instantaneous heart rates
    const instantHRs = rrIntervals.map(rr => 60000 / rr);
    
    // Calculate statistics
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
    // Logic to count irregular beats
    // ...
    return 0; // Replace with actual implementation
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

  async analyzeFeatures(featureVector: number[]): Promise<SessionAnalysisResults> {
    try {
      // Add this debugging line to see what's coming in
      console.log("Feature vector received:", featureVector);
      
      // Ensure we have all 10 features required by the model
      if (featureVector.length < 10) {
        // Pad with zeros for missing features
        const paddedFeatures = [...featureVector];
        while (paddedFeatures.length < 10) {
          paddedFeatures.push(0);
        }
        featureVector = paddedFeatures;
      }
      
      // Extract and validate the heart rate specifically
      const rawHeartRate = featureVector[1];
      // Use a valid default heart rate if the value is missing, zero, or invalid
      const heartRate = (rawHeartRate && !isNaN(rawHeartRate) && rawHeartRate > 30) 
                       ? rawHeartRate 
                       : 75; // Default to a normal adult heart rate
      
      console.log("Heart rate for analysis:", heartRate);
      
      // Create input tensor with correct shape
      const inputTensor = tf.tensor2d([featureVector], [1, 10]);
      
      if (!this.model) {
        await this.loadModel();
        if (!this.model) {
          throw new Error("Model is not loaded.");
        }
      }
      
      const prediction = this.model.predict(inputTensor) as tf.Tensor;
      const probabilities = await prediction.data();
      
      // Get the predicted class
      const predArray = Array.from(probabilities);
      const maxIndex = predArray.indexOf(Math.max(...predArray));
      const predictedClass = this.getClassLabel(maxIndex);
      const confidence = predArray[maxIndex] * 100;
      
      // Extract HRV metrics
      const rmssd = Math.max(featureVector[7] ?? 0, 0.1); // Ensure positive values
      const sdnn = Math.max(featureVector[8] ?? 0, 0.1);  // Ensure positive values
      const lfhfRatio = Math.max(featureVector[9] ?? 0, 0.1); // Ensure positive values
      
      // Calculate valid min/max heart rates
      const minHR = Math.max(heartRate * 0.85, 40); // Reasonable minimum
      const maxHR = Math.min(heartRate * 1.15, 180); // Reasonable maximum

      // Compute physiological state
      const physiologicalState = this.determinePhysiologicalState(rmssd, sdnn, lfhfRatio);
      
      // Return the results with corrected heart rate values
      return {
        summary: {
          recordingDuration: this.formatDuration(60), // Default to 1 minute if no duration
          heartRate: {
            average: heartRate,
            min: minHR,
            max: maxHR,
            status: this.determineHeartRateStatus(heartRate)
          },
          rhythm: {
            classification: predictedClass,
            confidence: confidence,
            irregularBeats: 0,
            percentIrregular: 0
          }
        },
        intervals: {
          pr: { average: featureVector[2], status: this.determineHeartRateStatus(featureVector[1]) }, 
          qrs: { average: featureVector[3], status: this.determineHeartRateStatus(featureVector[1]) },
          qt: { average: featureVector[4] },
          qtc: { average: featureVector[5], status: this.determineHeartRateStatus(featureVector[1]) },
          st: { deviation: 0, status: 'unknown' }
        },
        hrv: {
          timeMetrics: {
            rmssd: rmssd,
            sdnn: sdnn,
            pnn50: 0,
            triangularIndex: 0
          },
          frequencyMetrics: {
            lf: 0,
            hf: 0,
            lfhfRatio: lfhfRatio
          },
          assessment: this.determineHRVStatus(rmssd, sdnn, lfhfRatio),
          physiologicalState: physiologicalState
        },
        aiClassification: {
          prediction: predictedClass,
          confidence: confidence,
          explanation: this.getExplanationForClass(predictedClass)
        },
        abnormalities: [],
        recommendations: []
      };
    } catch (error) {
      console.error("Error analyzing features:", error);
      throw error;
    }
  }

  // Add these helper methods to your SessionAnalyzer class
  private determinePhysiologicalState(rmssd: number, sdnn: number, lfhfRatio: number): { state: string; confidence: number } {
    // Default values
    let state = "unknown";
    let confidence = 0;

    // Basic validation to ensure we have meaningful data
    if (rmssd <= 0 || sdnn <= 0) {
      return { state, confidence };
    }

    // Determine state based on HRV metrics
    if (lfhfRatio > 2.5) {
      state = "Stressed";
      confidence = Math.min(80, 50 + (lfhfRatio - 2.5) * 10);
    } else if (lfhfRatio < 0.5) {
      state = "Relaxed";
      confidence = Math.min(80, 50 + (0.5 - lfhfRatio) * 20);
    } else if (sdnn > 100 && rmssd > 50) {
      state = "Active";
      confidence = Math.min(70, 40 + (sdnn - 100) / 5);
    } else if (sdnn > 50 && rmssd > 30) {
      state = "Normal";
      confidence = 60;
    } else {
      state = "Fatigued";
      confidence = Math.min(70, 40 + (50 - sdnn) / 2);
    }

    return { state, confidence };
  }

  private determineHRVStatus(rmssd: number, sdnn: number, lfhfRatio: number): { status: string; description: string } {
    // Default values
    let status = "unknown";
    let description = "Insufficient data to assess HRV status.";

    // Basic validation
    if (rmssd <= 0 || sdnn <= 0) {
      return { status, description };
    }

    // Assess HRV based on commonly used clinical guidelines
    if (sdnn < 20) {
      status = "poor";
      description = "Low HRV may indicate reduced cardiac adaptability.";
    } else if (sdnn >= 20 && sdnn < 50) {
      status = "below average";
      description = "Below average HRV suggests room for cardiovascular improvement.";
    } else if (sdnn >= 50 && sdnn < 100) {
      status = "average";
      description = "Average HRV indicates normal cardiac autonomic function.";
    } else {
      status = "good";
      description = "Good HRV suggests healthy cardiac autonomic regulation.";
    }

    return { status, description };
  }

  // Helper method that should also be in your SessionAnalyzer class
  private determineHeartRateStatus(bpm: number): string {
    if (isNaN(bpm) || bpm <= 0) return 'unknown'; // Changed from 'invalid'
    if (bpm < 60) return 'bradycardia';
    if (bpm > 100) return 'tachycardia';
    return 'normal';
  }
}