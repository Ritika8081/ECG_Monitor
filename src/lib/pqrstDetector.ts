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

        // Filter rPeaks to only include valid QRS complexes
        const validRPeaks = rPeaks.filter(peakIndex => this.isValidQRS(data, peakIndex));

        if (validRPeaks.length === 0) {
            console.log('No valid QRS complexes found in', rPeaks.length, 'potential R peaks');
            return [];
        }

        console.log('Found', validRPeaks.length, 'valid QRS complexes out of', rPeaks.length, 'potential R peaks');

        // Only process the most recent peaks (last 5 complexes)
        const recentPeaks = validRPeaks.slice(-5);

        // Process each R peak to find the surrounding PQST points
        recentPeaks.forEach((rPeakIndex, peakIdx) => {
            if (rPeakIndex < 10 || rPeakIndex >= data.length - 10) {
                return; // Skip if too close to the edges
            }

            // Calculate RR interval (distance to previous R peak)
            let rrInterval: number;
            if (peakIdx > 0) {
                // Use actual RR interval if available
                rrInterval = rPeakIndex - recentPeaks[peakIdx - 1];
            } else if (peakIdx < recentPeaks.length - 1) {
                // Use next RR interval if previous not available
                rrInterval = recentPeaks[peakIdx + 1] - rPeakIndex;
            } else {
                // Fallback to default RR interval (approximately 1 second)
                rrInterval = this.sampleRate;
            }

            // Safety check - ensure RR interval is reasonable
            if (rrInterval < this.sampleRate * 0.3) {
                // Too short - probably noise, use minimum interval (300ms)
                rrInterval = this.sampleRate * 0.3;
            } else if (rrInterval > this.sampleRate * 1.5) {
                // Too long - cap at 1.5 seconds
                rrInterval = this.sampleRate * 1.5;
            }

            // Add the R peak
            pqrstPoints.push({
                index: rPeakIndex,
                amplitude: data[rPeakIndex],
                type: 'R',
                absolutePosition: currentIndex + rPeakIndex
            });

            // ---------- Q WAVE DETECTION ----------
            // Look for Q - the minimum before R in an adaptive window (5-10% of RR interval)
            const qWindowSize = Math.floor(rrInterval * 0.1); // 10% of RR interval
            const qWindowStart = Math.max(0, rPeakIndex - qWindowSize);
            const qWindowEnd = rPeakIndex;

            let qIndex = qWindowStart;
            let qValue = data[qWindowStart];

            for (let i = qWindowStart; i < qWindowEnd; i++) {
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

            // ---------- P WAVE DETECTION ----------
            // Look for P - the local maximum before Q (15-25% of RR interval before Q)
            const pWindowSize = Math.floor(rrInterval * 0.25); // 25% of RR interval
            const pWindowStart = Math.max(0, qIndex - pWindowSize);
            const pWindowEnd = Math.max(pWindowStart, qIndex - Math.floor(rrInterval * 0.02)); // Small gap between P and Q

            let pIndex = pWindowStart;
            let pValue = data[pWindowStart];

            for (let i = pWindowStart; i < pWindowEnd; i++) {
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

            // ---------- S WAVE DETECTION ----------
            // Look for S - the minimum after R (5-10% of RR interval after R)
            const sWindowSize = Math.floor(rrInterval * 0.1); // 10% of RR interval
            const sWindowStart = rPeakIndex + 1;
            const sWindowEnd = Math.min(data.length - 1, rPeakIndex + sWindowSize);

            let sIndex = sWindowStart;
            let sValue = data[sWindowStart];

            for (let i = sWindowStart; i <= sWindowEnd; i++) {
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

            // ---------- T WAVE DETECTION ----------
            // Look for T - the local maximum after S (20-40% of RR interval after S)
            const tWindowSize = Math.floor(rrInterval * 0.4); // 40% of RR interval
            const tWindowStart = sIndex + Math.floor(rrInterval * 0.02); // Small gap after S
            const tWindowEnd = Math.min(data.length - 1, sIndex + tWindowSize);

            let tIndex = tWindowStart;
            let tValue = data[tWindowStart];

            for (let i = tWindowStart; i <= tWindowEnd; i++) {
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

    detectDirectWaves(data: number[], currentIndex: number = 0): PQRSTPoint[] {
        const pqrstPoints: PQRSTPoint[] = [];
        const dataLength = data.length;

        // Calculate signal statistics
        const mean = data.reduce((sum, val) => sum + val, 0) / dataLength;
        const sortedData = [...data].sort((a, b) => b - a);
        const topValues = sortedData.slice(0, Math.floor(dataLength * 0.05));
        const maxValue = topValues[0] || 0;

        // If signal is too weak, don't try to detect anything
        if (maxValue < 0.2) {
            console.log('Signal too weak for direct PQRST detection, max value:', maxValue);
            return [];
        }

        // R-peak threshold - use 60% of the maximum value
        const rThreshold = maxValue * 0.6;
        console.log('Direct R-peak detection using threshold:', rThreshold, 'from max', maxValue);

        // Step 1: Find R peaks (high positive deflections)
        const rPeaks: number[] = [];

        for (let i = 30; i < dataLength - 30; i++) {
            // Skip if not above threshold
            if (data[i] < rThreshold) continue;

            // Check if this is a local maximum
            let isPeak = true;
            for (let j = Math.max(0, i - 30); j <= Math.min(dataLength - 1, i + 30); j++) {
                if (j !== i && data[j] > data[i]) {
                    isPeak = false;
                    break;
                }
            }

            if (isPeak) {
                rPeaks.push(i);
                // Skip ahead to avoid detecting the same peak multiple times
                i += 50; // Adjust as needed for your signal
            }
        }

        console.log('Direct detection found', rPeaks.length, 'R peaks');

        // If we found R peaks, use them to detect the full PQRST complex
        if (rPeaks.length > 0) {
            // Use our standard PQRST detection with these R peaks
            return this.detectWaves(data, rPeaks, currentIndex);
        }

        return [];
    }

    private isValidQRS(data: number[], rIndex: number): boolean {
        // Check if this point has the QRS morphology (Q dip before R, S dip after R)
        // Look for Q wave (negative deflection before R)
        let hasQWave = false;
        for (let i = Math.max(0, rIndex - 20); i < rIndex; i++) {
            if (data[i] < 0) {
                hasQWave = true;
                break;
            }
        }

        // Look for S wave (negative deflection after R)
        let hasSWave = false;
        for (let i = rIndex + 1; i < Math.min(data.length, rIndex + 20); i++) {
            if (data[i] < 0) {
                hasSWave = true;
                break;
            }
        }

        // Also check the amplitude of R - it should be significantly positive
        const rAmplitude = data[rIndex];

        // Return true if it has QRS morphology or if the R amplitude is very high
        return (hasQWave && hasSWave) || rAmplitude > 0.5;
    }
}