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
}