export class BPMCalculator {
  private bpmWindow: number[] = [];
  private bpmSmooth: number | null = null;
  private sampleRate: number;
  private windowSize: number;
  private minBPM: number;
  private maxBPM: number;
  private refractoryPeriod: number;
  private minDistance: number;

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
    this.minDistance = Math.floor(sampleRate * 0.08); // 80ms minimum distance between peaks
  }

  /**
   * Detect peaks in ECG data
   * @param data - Array of ECG values
   * @returns Array of peak indices
   */
  detectPeaks(data: number[]): number[] {
    const peaks: number[] = [];
    const dataLength = data.length;

    // Calculate dynamic threshold based on signal characteristics
    const sortedAmplitudes = [...data].sort((a, b) => b - a);
    const top5Percent = sortedAmplitudes.slice(0, Math.floor(dataLength * 0.05));

    // Use a higher threshold - 50% of the average of top 5% amplitudes
    // This ensures we only get the true R peaks
    const dynamicThreshold =
      top5Percent.length > 0
        ? (top5Percent.reduce((sum, val) => sum + val, 0) / top5Percent.length) * 0.5
        : 0.2; // Fallback

    // R peaks should be positive, so use a direct threshold rather than absolute value
    const threshold = Math.max(0.1, dynamicThreshold);

    console.log('R-peak detection using threshold:', threshold);

    // Look for peaks that exceed the threshold and are local maxima
    for (let i = this.minDistance; i < dataLength - this.minDistance; i++) {
      // Skip if not above threshold (R peaks are positive deflections)
      if (data[i] < threshold) continue;

      // Check if this is a local maximum
      let isPeak = true;
      for (let j = Math.max(0, i - this.minDistance); j <= Math.min(dataLength - 1, i + this.minDistance); j++) {
        if (j !== i && data[j] > data[i]) {
          isPeak = false;
          break;
        }
      }

      if (isPeak) {
        peaks.push(i);

        // Skip ahead to avoid detecting the same peak twice
        i += this.minDistance;
      }
    }

    // Further filtering - keep only the highest peaks if there are too many
    if (peaks.length > 20) {
      // Sort peaks by amplitude
      const peaksByAmplitude = [...peaks].sort((a, b) => data[b] - data[a]);
      // Keep only the top peaks
      const topPeaks = peaksByAmplitude.slice(0, 20);
      // Re-sort by position
      peaks.length = 0;
      peaks.push(...topPeaks.sort((a, b) => a - b));
    }

    return this.filterPeaksByRate(peaks);
  }

  /**
   * Filter peaks by refractory period to avoid double-counting
   * @param peaks - Array of peak indices
   * @returns Filtered array of peak indices
   */
  private filterPeaksByRate(peaks: number[]): number[] {
    if (peaks.length === 0) return [];
    const filtered: number[] = [];
    let lastPeak = -Infinity;
    for (const peak of peaks) {
      if (peak - lastPeak >= this.refractoryPeriod) {
        filtered.push(peak);
        lastPeak = peak;
      }
    }
    return filtered;
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