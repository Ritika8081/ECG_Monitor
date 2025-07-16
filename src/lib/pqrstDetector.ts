export interface PQRSTPoint {
  index: number;
  amplitude: number;
  type: 'P' | 'Q' | 'R' | 'S' | 'T';
  // Add absolute time position so we can track this point even as data moves
  absolutePosition: number;
}

export class PQRSTDetector {
  private windowSize: number;
  private sampleRate: number;
  private lastPointsMap: Map<string, PQRSTPoint[]> = new Map();

  constructor(sampleRate: number = 500) {
    this.windowSize = Math.floor(sampleRate * 0.2); // 200ms window
    this.sampleRate = sampleRate;
  }

  detectWaves(data: number[], rPeaks: number[], currentIndex: number = 0): PQRSTPoint[] {
    const pqrstPoints: PQRSTPoint[] = [];
    
    // Only process the most recent peaks (last 3-5 complexes)
    const recentPeaks = rPeaks.slice(-5);
    
    // Process each R peak to find the surrounding PQST points
    recentPeaks.forEach(rPeakIndex => {
      if (rPeakIndex < this.windowSize || rPeakIndex >= data.length - this.windowSize) {
        return; // Skip if too close to the edges
      }

      // Add the R peak
      pqrstPoints.push({
        index: rPeakIndex,
        amplitude: data[rPeakIndex],
        type: 'R',
        absolutePosition: currentIndex + rPeakIndex
      });

      // Look for Q - the minimum before R in a window
      let qIndex = rPeakIndex;
      let qValue = data[rPeakIndex];
      for (let i = rPeakIndex - 1; i >= Math.max(0, rPeakIndex - Math.floor(this.sampleRate * 0.05)); i--) {
        if (data[i] < qValue) {
          qValue = data[i];
          qIndex = i;
        }
      }
      pqrstPoints.push({
        index: qIndex,
        amplitude: qValue,
        type: 'Q',
        absolutePosition: currentIndex + qIndex
      });

      // Look for P - the local maximum before Q in a wider window
      let pWindow = Math.floor(this.sampleRate * 0.2);
      let pIndex = Math.max(0, qIndex - pWindow);
      let pValue = data[pIndex];
      for (let i = Math.max(0, qIndex - pWindow); i < qIndex; i++) {
        if (data[i] > pValue) {
          pValue = data[i];
          pIndex = i;
        }
      }
      pqrstPoints.push({
        index: pIndex,
        amplitude: pValue,
        type: 'P',
        absolutePosition: currentIndex + pIndex
      });

      // Look for S - the minimum after R in a window
      let sIndex = rPeakIndex;
      let sValue = data[rPeakIndex];
      for (let i = rPeakIndex + 1; i <= Math.min(data.length - 1, rPeakIndex + Math.floor(this.sampleRate * 0.05)); i++) {
        if (data[i] < sValue) {
          sValue = data[i];
          sIndex = i;
        }
      }
      pqrstPoints.push({
        index: sIndex,
        amplitude: sValue,
        type: 'S',
        absolutePosition: currentIndex + sIndex
      });

      // Look for T - the local maximum after S in a wider window
      let tWindow = Math.floor(this.sampleRate * 0.25);
      let tIndex = Math.min(data.length - 1, sIndex + tWindow);
      let tValue = data[tIndex];
      for (let i = sIndex + 1; i <= Math.min(data.length - 1, sIndex + tWindow); i++) {
        if (data[i] > tValue) {
          tValue = data[i];
          tIndex = i;
        }
      }
      pqrstPoints.push({
        index: tIndex,
        amplitude: tValue,
        type: 'T',
        absolutePosition: currentIndex + tIndex
      });
    });

    return pqrstPoints;
  }

  // Creates visualization data for all PQRST points
  generateWaveVisualization(data: number[], pqrstPoints: PQRSTPoint[]): {
    pLine: number[];
    qLine: number[];
    rLine: number[];
    sLine: number[];
    tLine: number[];
  } {
    const pLine = new Array(data.length).fill(0);
    const qLine = new Array(data.length).fill(0);
    const rLine = new Array(data.length).fill(0);
    const sLine = new Array(data.length).fill(0);
    const tLine = new Array(data.length).fill(0);

    pqrstPoints.forEach(point => {
      if (point.index >= 0 && point.index < data.length) {
        switch (point.type) {
          case 'P':
            pLine[point.index] = point.amplitude;
            break;
          case 'Q':
            qLine[point.index] = point.amplitude;
            break;
          case 'R':
            rLine[point.index] = point.amplitude;
            break;
          case 'S':
            sLine[point.index] = point.amplitude;
            break;
          case 'T':
            tLine[point.index] = point.amplitude;
            break;
        }
      }
    });

    return { pLine, qLine, rLine, sLine, tLine };
  }
}