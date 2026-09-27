/* Minimal typings for the vendored js-aruco2 detector.
   Only the parts used by lib/bowVision.ts are declared. */
import type { ArucoImage, ArucoImageBuffer, ArucoPoint } from "./cv.js";

export type { ArucoImage, ArucoImageBuffer, ArucoPoint };

export type ArucoDictionaryDefinition = {
  nBits: number;
  /* Candidates are accepted when their Hamming distance is strictly below tau. */
  tau?: number;
  codeList: (number | string | number[])[];
};

export interface ArucoMarker {
  id: number;
  corners: ArucoPoint[];
  hammingDistance: number;
}

export interface ArucoDetector {
  /* Scratch buffers reused between frames. */
  grey: ArucoImageBuffer;
  thres: ArucoImageBuffer;
  binary: unknown[];
  detect(image: ArucoImage): ArucoMarker[];
  findCandidates(contours: ArucoPoint[][], minSize: number, epsilon: number, minLength: number): ArucoPoint[][];
  clockwiseCorners(candidates: ArucoPoint[][]): ArucoPoint[][];
  notTooNear(candidates: ArucoPoint[][], minDist: number): ArucoPoint[][];
  findMarkers(grey: ArucoImageBuffer, candidates: ArucoPoint[][], warpSize: number): ArucoMarker[];
}

export const AR: {
  DICTIONARIES: Record<string, ArucoDictionaryDefinition>;
  Detector: new (config?: { dictionaryName?: string; maxHammingDistance?: number }) => ArucoDetector;
};
