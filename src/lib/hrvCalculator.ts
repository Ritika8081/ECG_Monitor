export class HRVCalculator {
  private rrIntervals: number[] = [];
  private maxIntervals: number = 300; // Keep last 5 minutes at 60 BPM

  /**
   * Add new RR interval
   * @param interval - RR interval in milliseconds
   */
  addRRInterval(interval: number): void {
    if (interval > 300 && interval < 2000) { // Valid RR interval range (30-200 BPM)
      this.rrIntervals.push(interval);
      
      // Keep only recent intervals
      if (this.rrIntervals.length > this.maxIntervals) {
        this.rrIntervals.shift();
      }
    }
  }

  /**
   * Extract RR intervals from peak indices
   * @param peaks - Array of peak indices
   * @param sampleRate - Sampling rate in Hz
   */
  extractRRFromPeaks(peaks: number[], sampleRate: number): void {
    if (peaks.length < 2) return;

    for (let i = 1; i < peaks.length; i++) {
      const rrSamples = peaks[i] - peaks[i - 1];
      const rrMs = (rrSamples / sampleRate) * 1000;
      this.addRRInterval(rrMs);
    }
  }

  /**
   * Calculate RMSSD (Root Mean Square of Successive Differences)
   * Measures short-term HRV
   */
  calculateRMSSD(): number {
    if (this.rrIntervals.length < 2) return 0;

    const differences = this.rrIntervals.slice(1).map((rr, i) => 
      Math.pow(rr - this.rrIntervals[i], 2)
    );

    const meanSquaredDiff = differences.reduce((sum, diff) => sum + diff, 0) / differences.length;
    return Math.sqrt(meanSquaredDiff);
  }

  /**
   * Calculate SDNN (Standard Deviation of NN intervals)
   * Measures overall HRV
   */
  calculateSDNN(): number {
    if (this.rrIntervals.length < 2) return 0;

    const mean = this.rrIntervals.reduce((sum, rr) => sum + rr, 0) / this.rrIntervals.length;
    const variance = this.rrIntervals.reduce((sum, rr) => sum + Math.pow(rr - mean, 2), 0) / this.rrIntervals.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Calculate pNN50
   * Percentage of successive RR intervals that differ by more than 50ms
   */
  calculatePNN50(): number {
    if (this.rrIntervals.length < 2) return 0;

    const differences = this.rrIntervals.slice(1).map((rr, i) => 
      Math.abs(rr - this.rrIntervals[i])
    );

    const nn50Count = differences.filter(diff => diff > 50).length;
    return (nn50Count / differences.length) * 100;
  }

  /**
   * Calculate Triangular Index
   * Approximates geometric measures
   */
  calculateTriangularIndex(): number {
    if (this.rrIntervals.length < 20) return 0;

    // Create histogram with 7.8125ms bins (1/128 second)
    const binWidth = 7.8125;
    const minRR = Math.min(...this.rrIntervals);
    const maxRR = Math.max(...this.rrIntervals);
    const numBins = Math.ceil((maxRR - minRR) / binWidth);
    
    const histogram = new Array(numBins).fill(0);
    
    this.rrIntervals.forEach(rr => {
      const binIndex = Math.floor((rr - minRR) / binWidth);
      if (binIndex >= 0 && binIndex < numBins) {
        histogram[binIndex]++;
      }
    });

    const maxBinCount = Math.max(...histogram);
    return maxBinCount > 0 ? this.rrIntervals.length / maxBinCount : 0;
  }

  /**
   * Simple frequency domain analysis
   * Calculates LF/HF ratio approximation
   */
  calculateLFHFRatio(): { lf: number; hf: number; ratio: number } {
    if (this.rrIntervals.length < 30) {
      return { lf: 0, hf: 0, ratio: 0 };
    }

    // Simplified frequency analysis
    // This is a basic approximation - for accurate FFT, use a proper library
    const differences = this.rrIntervals.slice(1).map((rr, i) => rr - this.rrIntervals[i]);
    
    // Low frequency component (approximate)
    const slowChanges = differences.filter((_, i) => i % 4 === 0); // ~0.04-0.15 Hz approx
    const lf = slowChanges.reduce((sum, val) => sum + Math.abs(val), 0) / slowChanges.length;
    
    // High frequency component (approximate)
    const fastChanges = differences.filter((_, i) => i % 2 === 0); // ~0.15-0.4 Hz approx
    const hf = fastChanges.reduce((sum, val) => sum + Math.abs(val), 0) / fastChanges.length;
    
    const ratio = hf > 0 ? lf / hf : 0;
    
    return { lf, hf, ratio };
  }

  /**
   * Get HRV assessment based on RMSSD
   */
  getHRVAssessment(): { status: string; color: string; description: string } {
    const rmssd = this.calculateRMSSD();
    
    if (rmssd < 20) {
      return {
        status: 'Low',
        color: '#ef4444',
        description: 'Poor autonomic function'
      };
    } else if (rmssd < 50) {
      return {
        status: 'Normal',
        color: '#10b981',
        description: 'Good autonomic balance'
      };
    } else {
      return {
        status: 'High',
        color: '#3b82f6',
        description: 'Excellent autonomic function'
      };
    }
  }

  /**
   * Get all HRV metrics
   */
  getAllMetrics(): {
    rmssd: number;
    sdnn: number;
    pnn50: number;
    triangularIndex: number;
    lfhf: { lf: number; hf: number; ratio: number };
    sampleCount: number;
    assessment: { status: string; color: string; description: string };
  } {
    return {
      rmssd: this.calculateRMSSD(),
      sdnn: this.calculateSDNN(),
      pnn50: this.calculatePNN50(),
      triangularIndex: this.calculateTriangularIndex(),
      lfhf: this.calculateLFHFRatio(),
      sampleCount: this.rrIntervals.length,
      assessment: this.getHRVAssessment()
    };
  }

  /**
   * Reset calculator
   */
  reset(): void {
    this.rrIntervals = [];
  }

  /**
   * Get raw RR intervals for external analysis
   */
  getRRIntervals(): number[] {
    return [...this.rrIntervals];
  }

  /**
   * Get mental state estimation
   */
  getMentalState(): { state: string; confidence: number } {
    const metrics = this.getAllMetrics();
    
    // Default state if we don't have enough data
    if (metrics.sampleCount < 30) {
      return { state: "Analyzing", confidence: 0 };
    }
    
    const RMSSD = metrics.rmssd;
    const SDNN = metrics.sdnn;
    const pNN50 = metrics.pnn50;
    const LF_HF = metrics.lfhf.ratio;
    const entropy = metrics.triangularIndex / 20; // Normalize as a proxy for entropy
    const meanRR = this.rrIntervals.length > 0
      ? this.rrIntervals.reduce((sum, rr) => sum + rr, 0) / this.rrIntervals.length
      : 0;
    const BPM = meanRR > 0 ? 60 / (meanRR / 1000) : 0; // Convert mean RR to BPM
    
    let state = "Neutral";
    let confidence = 0.6; // Default confidence
    
    // Mental state detection algorithm
    if (RMSSD < 25 && SDNN < 50 && BPM > 90) {
      state = "High Stress";
      confidence = 0.7 + (90 - RMSSD) / 100;
    } else if (RMSSD > 40 && pNN50 > 30 && LF_HF < 1.5) {
      state = "Relaxed";
      confidence = 0.7 + (RMSSD - 40) / 100;
    } else if (pNN50 < 10 && LF_HF > 2.0) {
      state = "Focused";
      confidence = 0.7 + (LF_HF - 2.0) / 3;
    } else if (SDNN < 30 && entropy < 0.6) {
      state = "Fatigue";
      confidence = 0.7 + (0.6 - entropy) / 0.5;
    } else {
      state = "Neutral";
      // Calculate confidence based on how close we are to any threshold
      const stressDistance = Math.min(
        Math.abs(RMSSD - 25) / 25,
        Math.abs(SDNN - 50) / 50,
        Math.abs(BPM - 90) / 90
      );
      const relaxedDistance = Math.min(
        Math.abs(RMSSD - 40) / 40,
        Math.abs(pNN50 - 30) / 30,
        Math.abs(LF_HF - 1.5) / 1.5
      );
      const focusedDistance = Math.min(
        Math.abs(pNN50 - 10) / 10,
        Math.abs(LF_HF - 2.0) / 2.0
      );
      const fatigueDistance = Math.min(
        Math.abs(SDNN - 30) / 30,
        Math.abs(entropy - 0.6) / 0.6
      );
      
      // Higher confidence when we're clearly in the neutral state
      confidence = 0.6 + Math.min(stressDistance, relaxedDistance, focusedDistance, fatigueDistance) * 0.4;
    }
    
    // Cap confidence at 0.95
    confidence = Math.min(0.95, confidence);
    
    return { state, confidence };
  }

  /**
   * Get physiological state estimation based on HRV metrics
   */
  getPhysiologicalState(): { state: string; confidence: number } {
    const metrics = this.getAllMetrics();
    
    // Default state if we don't have enough data
    if (metrics.sampleCount < 30) {
      return { state: "Analyzing", confidence: 0 };
    }
    
    const RMSSD = metrics.rmssd;
    const SDNN = metrics.sdnn;
    const pNN50 = metrics.pnn50;
    const LF_HF = metrics.lfhf.ratio;
    const entropy = metrics.triangularIndex / 20; // Normalize as a proxy for entropy
    const meanRR = this.rrIntervals.length > 0
      ? this.rrIntervals.reduce((sum, rr) => sum + rr, 0) / this.rrIntervals.length
      : 0;
    const BPM = meanRR > 0 ? 60 / (meanRR / 1000) : 0; // Convert mean RR to BPM
    
    let state = "Neutral";
    let confidence = 0.6; // Default confidence
    
    // Physiological state detection algorithm
    if (RMSSD < 25 && SDNN < 50 && BPM > 90) {
      state = "High Stress";
      confidence = 0.7 + (90 - RMSSD) / 100;
    } else if (RMSSD > 40 && pNN50 > 30 && LF_HF < 1.5) {
      state = "Relaxed";
      confidence = 0.7 + (RMSSD - 40) / 100;
    } else if (pNN50 < 10 && LF_HF > 2.0) {
      state = "Focused";
      confidence = 0.7 + (LF_HF - 2.0) / 3;
    } else if (SDNN < 30 && entropy < 0.6) {
      state = "Fatigue";
      confidence = 0.7 + (0.6 - entropy) / 0.5;
    } else {
      state = "Neutral";
      // Calculate confidence based on how close we are to any threshold
      const stressDistance = Math.min(
        Math.abs(RMSSD - 25) / 25,
        Math.abs(SDNN - 50) / 50,
        Math.abs(BPM - 90) / 90
      );
      const relaxedDistance = Math.min(
        Math.abs(RMSSD - 40) / 40,
        Math.abs(pNN50 - 30) / 30,
        Math.abs(LF_HF - 1.5) / 1.5
      );
      const focusedDistance = Math.min(
        Math.abs(pNN50 - 10) / 10,
        Math.abs(LF_HF - 2.0) / 2.0
      );
      const fatigueDistance = Math.min(
        Math.abs(SDNN - 30) / 30,
        Math.abs(entropy - 0.6) / 0.6
      );
      
      // Higher confidence when we're clearly in the neutral state
      confidence = 0.6 + Math.min(stressDistance, relaxedDistance, focusedDistance, fatigueDistance) * 0.4;
    }
    
    // Cap confidence at 0.95
    confidence = Math.min(0.95, confidence);
    
    return { state, confidence };
  }
}