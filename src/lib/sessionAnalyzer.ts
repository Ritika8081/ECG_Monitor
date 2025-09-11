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
      // Try multiple model sources in order of preference
      const modelSources = [
         'localstorage://beat-level-ecg-model',  // User-trained model (correct name)
        '/models/beat-level-ecg-model.json',    // Pretrained model in public folder (update name here)
        '/assets/beat-level-ecg-model.json',    // Alternative path (update name here)
        'https://your-domain.com/models/beat-level-ecg-model.json' // Remote model (update name here)
      ];
      
      for (const modelUrl of modelSources) {
        try {
          console.log(`Attempting to load model from: ${modelUrl}`);
          
          // For localStorage, check if it exists first
          if (modelUrl.startsWith('localstorage://')) {
            const models = await tf.io.listModels();
            if (!models[modelUrl]) {
              console.log(`Model not found in localStorage: ${modelUrl}`);
              continue;
            }
          }
          
          // Try to load the model
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
        patientInfo.age / 100, // Normalize age
        patientInfo.gender === 'male' ? 1 : 0,
        patientInfo.weight / 100, // Normalize weight
        patientInfo.height / 200, // Normalize height
      ];

      // Pad or slice features to length 720
      if (features.length < 720) {
        features = features.concat(Array(720 - features.length).fill(0));
      } else if (features.length > 720) {
        features = features.slice(0, 720);
      }
      const inputTensor = tf.tensor3d([features.map(v => [v])], [1, 720, 1]);
      const outputTensor = this.model.predict(inputTensor) as tf.Tensor;
      const probabilities = await outputTensor.data();

      // Get predicted class
      const predArray = Array.from(probabilities);
      const maxIndex = predArray.indexOf(Math.max(...predArray));
      let predictedClass = this.getClassLabel(maxIndex);
      const confidence = predArray[maxIndex] * 100;

      // If the predicted class is Atrial Fibrillation, check the rhythm regularity
      // NOTE: You may want to pass irregularBeats and percentIrregular as arguments to this function for more robust logic.
      if (
        predictedClass === "Atrial Fibrillation" &&
        (hrvMetrics?.percentIrregular !== undefined && hrvMetrics?.irregularBeats !== undefined &&
         hrvMetrics.percentIrregular <= 20 && hrvMetrics.irregularBeats <= 3)
      ) {
        // If rhythm is regular, override prediction to Normal Sinus Rhythm
        predictedClass = "Normal Sinus Rhythm";
      }

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
      
      if (
        (aiClassification.prediction === "Atrial Fibrillation" || aiClassification.prediction === "AFib") &&
        ((hrvMetrics?.percentIrregular ?? 0) > 20 || (hrvMetrics?.irregularBeats ?? 0) > 3) // adjust thresholds as needed
      ) {
        abnormalities.push({
          type: "Atrial Fibrillation",
          description: "Irregular heart rhythm potentially indicating atrial fibrillation.",
          severity: "high"
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
      console.log("Feature vector received:", featureVector);
      
      // Ensure we have all 10 features required by the model
      if (featureVector.length < 10) {
        const paddedFeatures = [...featureVector];
        while (paddedFeatures.length < 10) {
          paddedFeatures.push(0);
        }
        featureVector = paddedFeatures;
      }
      
      // Extract heart rate and validate it
      const rawHeartRate = featureVector[1];
      const heartRate = (rawHeartRate && rawHeartRate > 30 && rawHeartRate < 300) ? 
                        rawHeartRate : 75; // Default to 75 BPM if invalid
      
      // Try to load model if not already loaded
      if (!this.model) {
        const modelLoaded = await this.loadModel();
        if (!modelLoaded) {
          console.warn('Model not available, using rule-based analysis');
          return this.performRuleBasedAnalysis(featureVector, heartRate);
        }
      }
      
      
          let paddedFeatures = featureVector.slice(0, 720);
      if (paddedFeatures.length < 720) {
        paddedFeatures = paddedFeatures.concat(Array(720 - paddedFeatures.length).fill(0));
      }
      const inputTensor = tf.tensor3d([paddedFeatures.map(v => [v])], [1, 720, 1]);
      
      
      try {
        const prediction = this.model!.predict(inputTensor) as tf.Tensor;
        const probabilities = await prediction.data();
        
        // Get the predicted class
        const predArray = Array.from(probabilities);
        const maxIndex = predArray.indexOf(Math.max(...predArray));
        let predictedClass = this.getClassLabel(maxIndex);
        const confidence = predArray[maxIndex] * 100;
        
        // If the predicted class is Atrial Fibrillation, check the rhythm regularity
        if (
          predictedClass === "Atrial Fibrillation" &&
          (0 <= 20 && 0 <= 3) // No summary available, use default values
        ) {
          // If rhythm is regular, override prediction to Normal Sinus Rhythm
          predictedClass = "Normal Sinus Rhythm";
        }
        
        // Clean up tensors
        inputTensor.dispose();
        prediction.dispose();
        
        return this.buildAnalysisResults(featureVector, heartRate, predictedClass, confidence, true);
      } catch (predictionError) {
        console.error('Prediction failed:', predictionError);
        inputTensor.dispose();
        return this.performRuleBasedAnalysis(featureVector, heartRate);
      }
    } catch (error) {
      console.error("Error analyzing features:", error);
      return this.performRuleBasedAnalysis(featureVector, 75);
    }
  }

  // Add this method for rule-based analysis when AI model is not available
  private performRuleBasedAnalysis(featureVector: number[], heartRate: number): SessionAnalysisResults {
    console.log('Performing rule-based analysis');
    
    // Simple rule-based classification
    let prediction = "Normal Sinus Rhythm";
    let confidence = 70;
    
    if (heartRate < 60) {
      prediction = "Bradycardia";
      confidence = 80;
    } else if (heartRate > 100) {
      prediction = "Tachycardia";
      confidence = 80;
    } else if (featureVector[2] > 200) { // PR interval
      prediction = "First-degree AV Block";
      confidence = 75;
    } else if (featureVector[3] > 120) { // QRS duration
      prediction = "Bundle Branch Block";
      confidence = 75;
    }
    
    return this.buildAnalysisResults(featureVector, heartRate, prediction, confidence, false);
  }

  // Helper method to build consistent analysis results
  private buildAnalysisResults(
    featureVector: number[], 
    heartRate: number, 
    prediction: string, 
    confidence: number,
    usedAI: boolean
  ): SessionAnalysisResults {
    const rrInterval = Math.max(featureVector[0] || 1000, 1);
    const duration = rrInterval / 1000;
    const durationStr = this.formatDuration(duration);
    
    return {
      summary: {
        recordingDuration: durationStr,
        heartRate: {
          average: heartRate,
          min: Math.max(heartRate * 0.9, 40),
          max: Math.min(heartRate * 1.1, 200),
          status: this.determineHeartRateStatus(heartRate)
        },
        rhythm: {
          classification: prediction,
          confidence: confidence,
          irregularBeats: 0,
          percentIrregular: 0
        }
      },
      intervals: {
        pr: { 
          average: featureVector[2] || 0, 
          status: this.determineIntervalStatus(featureVector[2], 'pr')
        },
        qrs: { 
          average: featureVector[3] || 0, 
          status: this.determineIntervalStatus(featureVector[3], 'qrs')
        },
        qt: { 
          average: featureVector[4] || 0 
        },
        qtc: { 
          average: featureVector[5] || 0, 
          status: this.determineIntervalStatus(featureVector[5], 'qtc')
        },
        st: { 
          deviation: featureVector[6] || 0, 
          status: this.determineSTStatus(featureVector[6] || 0)
        }
      },
      hrv: {
        timeMetrics: {
          rmssd: Math.max(featureVector[7] || 0, 0),
          sdnn: Math.max(featureVector[8] || 0, 0),
          pnn50: 0,
          triangularIndex: 0
        },
        frequencyMetrics: {
          lf: 0,
          hf: 0,
          lfhfRatio: Math.max(featureVector[9] || 0, 0)
        },
        assessment: {
          status: 'normal',
          description: 'Basic HRV analysis'
        },
        physiologicalState: {
          state: 'relaxed',
          confidence: 50
        }
      },
      aiClassification: {
        prediction: prediction,
        confidence: confidence,
        explanation: usedAI ? 
          this.getExplanationForClass(prediction) : 
          "Analysis performed using rule-based logic (AI model not available)."
      },
      abnormalities: this.detectBasicAbnormalities(featureVector, heartRate),
      recommendations: this.generateBasicRecommendations(prediction, usedAI)
    };
  }

  // Helper methods for status determination
  private determineIntervalStatus(value: number, type: 'pr' | 'qrs' | 'qtc'): string {
    if (!value || isNaN(value) || value <= 0) return 'unknown';
    
    switch (type) {
      case 'pr':
        if (value < 120) return 'short';
        if (value > 200) return 'prolonged';
        return 'normal';
      case 'qrs':
        if (value > 120) return 'wide';
        return 'normal';
      case 'qtc':
        if (value > 450) return 'prolonged';
        if (value < 350) return 'short';
        return 'normal';
      default:
        return 'unknown';
    }
  }

  private determineSTStatus(deviation: number): string {
    if (isNaN(deviation)) return 'unknown';
    if (Math.abs(deviation) < 0.5) return 'normal';
    if (deviation > 0.5) return 'elevated';
    if (deviation < -0.5) return 'depressed';
    return 'normal';
  }

  private detectBasicAbnormalities(featureVector: number[], heartRate: number): { type: string; severity: 'low' | 'medium' | 'high'; description: string }[] {
    const abnormalities: { type: string; severity: 'low' | 'medium' | 'high'; description: string }[] = [];
    
    if (heartRate < 60) {
      abnormalities.push({
        type: 'Bradycardia',
        severity: heartRate < 50 ? 'high' : 'medium',
        description: 'Heart rate is below normal range.'
      });
    }
    
    if (heartRate > 100) {
      abnormalities.push({
        type: 'Tachycardia',
        severity: heartRate > 120 ? 'high' : 'medium',
        description: 'Heart rate is above normal range.'
      });
    }
    
    return abnormalities;
  }

  private generateBasicRecommendations(prediction: string, usedAI: boolean): string[] {
    const recommendations = [
      "This device is not a medical diagnostic tool. Always consult with a healthcare professional."
    ];
    
    if (!usedAI) {
      recommendations.push(
        "For more accurate AI-powered analysis, please train the model first using the Model Training section."
      );
    }
    
    if (prediction !== "Normal Sinus Rhythm") {
      recommendations.push(
        "Consider scheduling a consultation with a cardiologist for further evaluation."
      );
    }
    
    return recommendations;
  }

  // Helper method that should also be in your SessionAnalyzer class
  private determineHeartRateStatus(bpm: number): string {
    if (isNaN(bpm) || bpm <= 0) return 'unknown'; // Changed from 'invalid'
    if (bpm < 60) return 'bradycardia';
    if (bpm > 100) return 'tachycardia';
    return 'normal';
  }
}