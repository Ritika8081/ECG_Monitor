export class NotchFilter {
  z1_1 = 0; z2_1 = 0;
  z1_2 = 0; z2_2 = 0;
  process(input: number) {
    const x1 = input - (-1.56858163 * this.z1_1) - (0.96424138 * this.z2_1);
    let output = 0.96508099 * x1 + (-1.56202714 * this.z1_1) + (0.96508099 * this.z2_1);
    this.z2_1 = this.z1_1; this.z1_1 = x1;
    const x2 = output - (-1.61100358 * this.z1_2) - (0.96592171 * this.z2_2);
    output = 1.0 * x2 + (-1.61854514 * this.z1_2) + (1.0 * this.z2_2);
    this.z2_2 = this.z1_2; this.z1_2 = x2;
    return output;
  }
}

export class ECGFilter {
  z1 = 0; z2 = 0;
  process(input: number) {
    const x1 = input - (-1.47548044 * this.z1) - (0.58691951 * this.z2);
    const output = 0.02785977 * x1 + (0.05571953 * this.z1) + (0.02785977 * this.z2);
    this.z2 = this.z1; this.z1 = x1;
    return output;
  }
}
export class HighPassFilter {
  // State variables
  private z1: number;
  private z2: number;
  private x1: number;

  constructor() {
    this.z1 = 0;
    this.z2 = 0;
    this.x1 = 0;
  }

  // Process input sample through the high-pass filter (0.5 Hz @ 500 Hz)
  process(input: number): number {
    let output = input;

    // High-pass ~0.5 Hz @ fs=500 Hz (Butterworth, 2nd order)
    this.x1 = output - (-1.99822285 * this.z1) - (0.99822443 * this.z2);
    output =
      (0.99911182 * this.x1) +
      (-1.99822364 * this.z1) +
      (0.99911182 * this.z2);

    // Update states
    this.z2 = this.z1;
    this.z1 = this.x1;

    return output;
  }
}
