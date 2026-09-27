/* Minimal typings for the vendored js-aruco2 image routines. */
export type ArucoPoint = { x: number; y: number };

/* RGBA input, the same shape as a canvas ImageData. */
export type ArucoImage = {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array | number[];
};

/* Single-channel scratch image owned by the detector. */
export interface ArucoImageBuffer {
  width: number;
  height: number;
  data: number[] | Uint8ClampedArray;
}

export const CV: {
  grayscale(src: ArucoImage, dst: ArucoImageBuffer): ArucoImageBuffer;
  /* kernelSize is the box-blur radius; a pixel darker than the local mean by
     more than threshold becomes foreground. */
  adaptiveThreshold(src: ArucoImageBuffer, dst: ArucoImageBuffer, kernelSize: number, threshold: number): ArucoImageBuffer;
  findContours(src: ArucoImageBuffer, binary: unknown[]): ArucoPoint[][];
};
