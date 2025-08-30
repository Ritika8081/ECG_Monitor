import { jsPDF } from "jspdf";
import { ECGIntervals } from "./ecgIntervals";

export function generateEcgPdf(ecgIntervals: ECGIntervals) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("ECG Session Report", 14, 20);

  doc.setFontSize(12);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 30);
  doc.text(`Time: ${new Date().toLocaleTimeString()}`, 14, 36);

  doc.text("Heart Rate:", 14, 46);
  doc.text(
    `${ecgIntervals?.bpm !== undefined ? ecgIntervals.bpm.toFixed(1) : "N/A"} BPM`,
    60,
    46
  );

  doc.text("RR Interval:", 14, 52);
  doc.text(
    `${ecgIntervals?.rr !== undefined ? ecgIntervals.rr.toFixed(0) : "N/A"} ms`,
    60,
    52
  );

  doc.text("PR Interval:", 14, 58);
  doc.text(
    `${ecgIntervals?.pr !== undefined ? ecgIntervals.pr.toFixed(0) : "N/A"} ms`,
    60,
    58
  );

  doc.text("QRS Duration:", 14, 64);
  doc.text(
    `${ecgIntervals?.qrs !== undefined ? ecgIntervals.qrs.toFixed(0) : "N/A"} ms`,
    60,
    64
  );

  doc.text("QTc Interval:", 14, 70);
  doc.text(
    `${ecgIntervals?.qtc !== undefined ? ecgIntervals.qtc.toFixed(0) : "N/A"} ms`,
    60,
    70
  );

  doc.save(`ecg-session-report-${new Date().toISOString().slice(0,10)}.pdf`);
}