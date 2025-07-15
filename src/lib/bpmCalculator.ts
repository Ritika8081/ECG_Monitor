export class BPMCalculator {
  private bpmWindow: number[] = [];
  private bpmSmooth: number | null = null;
  private sampleRate: number;
  private windowSize: number;
  private minBPM: number;
  private maxBPM: number;
  private refractoryPeriod: number;

  constructor(
    sampleRate: number = 500,
    windowSize: number = 5,
    minBPM: number = 40,
    maxBPM: number = 200
  ) {
    this.sampleRate = sampleRate;
    this.windowSize = windowSize;
    this.minBPM = minBPM;
    this.maxBPM = maxBPM;
    this.refractoryPeriod = Math.floor(sampleRate * 0.2); // 200ms refractory period
  }

  /**
   * Detect peaks in ECG data
   * @param data - Array of ECG values
   * @returns Array of peak indices
   */
  detectPeaks(data: number[]): number[] {
    const threshold = 0.5 * Math.max(...data.map(Math.abs));
    let lastPeak = -this.refractoryPeriod;
    const peaks: number[] = [];

    for (let i = 1; i < data.length - 1; i++) {
      const currentValue = data[i];
      const prevValue = data[i - 1];
      const nextValue = data[i + 1];

      // Check if current point is a peak
      if (
        currentValue > threshold &&
        currentValue > prevValue &&
        currentValue >= nextValue
      ) {
        // Check refractory period
        if (i - lastPeak >= this.refractoryPeriod) {
          peaks.push(i);
          lastPeak = i;
        }
      }
    }

    return peaks;
  }

  /**
   * Calculate BPM from peak intervals
   * @param peaks - Array of peak indices
   * @returns BPM value or null if invalid
   */
  calculateBPMFromPeaks(peaks: number[]): number | null {
    if (peaks.length < 2) return null;

    // Calculate intervals between consecutive peaks
    const intervals = peaks.slice(1).map((peak, index) => peak - peaks[index]);
    
    // Average interval
    const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    // Convert to BPM
    const bpm = (60 * this.sampleRate) / averageInterval;

    // Validate BPM range
    if (bpm < this.minBPM || bpm > this.maxBPM) {
      return null;
    }

    return bpm;
  }

  /**
   * Smooth BPM using moving average and rate limiting
   * @param newBPM - New BPM value
   * @returns Smoothed BPM
   */
  smoothBPM(newBPM: number): number {
    // Add to sliding window
    this.bpmWindow.push(newBPM);
    if (this.bpmWindow.length > this.windowSize) {
      this.bpmWindow.shift();
    }

    // Calculate moving average
    const windowAverage = this.bpmWindow.reduce((sum, bpm) => sum + bpm, 0) / this.bpmWindow.length;

    // Apply rate limiting for smooth transitions
    if (this.bpmSmooth === null) {
      this.bpmSmooth = windowAverage;
    } else {
      const maxChange = 2; // Maximum BPM change per update
      const difference = windowAverage - this.bpmSmooth;
      const limitedChange = Math.sign(difference) * Math.min(maxChange, Math.abs(difference));
      this.bpmSmooth += limitedChange;
    }

    return this.bpmSmooth;
  }

  /**
   * Complete BPM calculation pipeline
   * @param data - ECG data array
   * @returns Smoothed BPM or null
   */
  computeBPM(data: number[]): number | null {
    const peaks = this.detectPeaks(data);
    const rawBPM = this.calculateBPMFromPeaks(peaks);
    
    if (rawBPM === null) return null;
    
    return this.smoothBPM(rawBPM);
  }

  /**
   * Generate peak visualization data
   * @param data - ECG data array
   * @param peaks - Peak indices
   * @returns Array for peak visualization
   */
  generatePeakVisualization(data: number[], peaks: number[]): number[] {
    const peakData = new Array(data.length).fill(0);
    
    peaks.forEach(peakIndex => {
      const peakValue = data[peakIndex];
      // Create peak markers (small spikes above the actual peak)
      for (let j = peakIndex - 10; j <= peakIndex + 10; j++) {
        if (j >= 0 && j < data.length) {
          peakData[j] = peakValue + 0.03; // Slight offset above peak
        }
      }
    });

    return peakData;
  }

  /**
   * Reset calculator state
   */
  reset(): void {
    this.bpmWindow = [];
    this.bpmSmooth = null;
  }

  /**
   * Get current BPM statistics
   */
  getStats(): {
    currentBPM: number | null;
    averageBPM: number | null;
    windowSize: number;
    sampleCount: number;
  } {
    const averageBPM = this.bpmWindow.length > 0 
      ? this.bpmWindow.reduce((sum, bpm) => sum + bpm, 0) / this.bpmWindow.length 
      : null;

    return {
      currentBPM: this.bpmSmooth,
      averageBPM,
      windowSize: this.windowSize,
      sampleCount: this.bpmWindow.length
    };
  }
}