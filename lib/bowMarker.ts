import { AR, type ArucoDetector, type ArucoImage } from "@/lib/vendor/js-aruco2/aruco.js";
import { CV } from "@/lib/vendor/js-aruco2/cv.js";

/* Bow tracking with a single printed ArUco marker instead of coloured tape.
   The marker is id 0 of OpenCV's DICT_4X4_50 (public/markers/aruco_4x4_0.png,
   regenerate with scripts/generate_aruco.py). Stick it on the bow so the top
   edge of the marker runs along the stick: the bow angle is read from that
   edge, and the marker centre is used for bridge/fingerboard placement.

   Detection itself runs in workers/markerWorker.ts, which crops and zooms a
   window around the last known position so a small, blurry marker far from
   the camera still gets enough pixels. This module holds the pure detection
   step and the geometry helpers. Nothing renders it right now: the practice
   and model-test cameras use the tape tracking in lib/bowVision.ts. */

export type MarkerPoint = { x: number; y: number };
export type BowMarker = {
  id: number;
  /* Four corners in image pixels, clockwise from the marker's top-left. */
  corners: MarkerPoint[];
  center: MarkerPoint;
  /* Degrees, 0 = marker top edge pointing right, positive = clockwise on screen. */
  angle: number;
};

export const BOW_MARKER_ID = 0;

/* The 50 codes of OpenCV's DICT_4X4_50, one 16-bit value per marker, read row
   by row from the 4x4 inner grid. Exported from cv2.aruco so ids match OpenCV. */
const OPENCV_DICT_4X4_50 = [
  0xb532, 0x0f9a, 0x332d, 0x9946, 0x549e, 0x79cd, 0x9e2e, 0xc4f2, 0xfeda, 0xcf56,
  0xf991, 0x11a7, 0x0eb7, 0x2a0f, 0x24b1, 0x263e, 0x4665, 0x6600, 0x6c5e, 0x76af,
  0x868b, 0xb02b, 0xccd5, 0xdd82, 0xfe47, 0x9471, 0xace4, 0xa554, 0x2123, 0x346f,
  0x4415, 0x57b2, 0x9ecf, 0xf0cb, 0x08ae, 0x0929, 0x1875, 0x04ff, 0x0df6, 0x1c5a,
  0x1718, 0x2a28, 0x328c, 0x38b2, 0x24e8, 0x2eeb, 0x2d3f, 0x4b64, 0x502e, 0x5013,
];

const DICTIONARY_NAME = "OPENCV_4X4_50";

/* Codes in this dictionary differ by at least 4 bits in every rotation, and
   js-aruco2 accepts distances strictly below tau. tau = 3 lets a blurry read
   be off by 2 bits, which is more lenient than OpenCV's default of 1 but safe
   here because only one marker id is ever accepted. */
if (!AR.DICTIONARIES[DICTIONARY_NAME]) {
  AR.DICTIONARIES[DICTIONARY_NAME] = { nBits: 16, tau: 3, codeList: OPENCV_DICT_4X4_50 };
}

/* Adaptive-threshold passes tried in order until one finds the marker. The
   small kernel is the library default and works for crisp markers; the wider
   kernels with a lower contrast threshold pick up soft-edged, low contrast
   markers that are far away or motion blurred (OpenCV's detector sweeps
   window sizes the same way). Tuned on synthetic frames: see the worker for
   how the image is first rescaled so the marker is 56 to 96 px across, which
   is the size range these passes were chosen for. */
const THRESHOLD_PASSES: { kernel: number; threshold: number }[] = [
  { kernel: 2, threshold: 7 },
  { kernel: 4, threshold: 5 },
  { kernel: 8, threshold: 4 },
];

/* Squares with an edge shorter than this (in the analysed image) are ignored.
   The library default of 10 drops far markers, and a 6-cell marker cannot be
   read below about 6 px anyway. */
const MIN_EDGE_PX = 6;
const WARP_SIZE = 49;

let detector: ArucoDetector | null = null;

function getDetector() {
  detector ??= new AR.Detector({ dictionaryName: DICTIONARY_NAME });
  return detector;
}

/* Finds the bow marker in an RGBA image (a canvas ImageData or anything with
   the same shape) and returns it in that image's pixel coordinates, or null.
   If the same id shows up more than once, the cleanest read (lowest Hamming
   distance) wins. */
export function detectMarkerInImage(image: ArucoImage, markerId = BOW_MARKER_ID): BowMarker | null {
  if (!image.width || !image.height) return null;
  const aruco = getDetector();
  CV.grayscale(image, aruco.grey);

  for (const pass of THRESHOLD_PASSES) {
    CV.adaptiveThreshold(aruco.grey, aruco.thres, pass.kernel, pass.threshold);
    const contours = CV.findContours(aruco.thres, aruco.binary);
    let candidates = aruco.findCandidates(contours, image.width * 0.01, 0.05, MIN_EDGE_PX);
    if (!candidates.length) continue;
    candidates = aruco.notTooNear(aruco.clockwiseCorners(candidates), 10);
    const match = aruco
      .findMarkers(aruco.grey, candidates, WARP_SIZE)
      .filter((marker) => marker.id === markerId)
      .sort((first, second) => first.hammingDistance - second.hammingDistance)[0];
    if (match) return markerFromCorners(match.id, match.corners);
  }
  return null;
}

export function markerFromCorners(id: number, points: MarkerPoint[]): BowMarker {
  const corners = points.map((corner) => ({ x: corner.x, y: corner.y }));
  return {
    id,
    corners,
    center: {
      x: corners.reduce((sum, corner) => sum + corner.x, 0) / corners.length,
      y: corners.reduce((sum, corner) => sum + corner.y, 0) / corners.length,
    },
    angle: bowAngle(corners),
  };
}

/* Maps a marker between coordinate spaces (offset first, then scale), e.g.
   from a zoomed crop back to the full frame, or from the frame to the overlay. */
export function transformMarker(
  marker: BowMarker,
  scaleX: number,
  scaleY: number,
  offsetX = 0,
  offsetY = 0,
): BowMarker {
  const map = (point: MarkerPoint) => ({ x: (point.x + offsetX) * scaleX, y: (point.y + offsetY) * scaleY });
  return { ...marker, corners: marker.corners.map(map), center: map(marker.center) };
}

/* Longest side of the marker in pixels; a handy measure of its on-screen size. */
export function markerSize(marker: BowMarker) {
  return Math.max(
    ...marker.corners.map((corner, index) => {
      const next = marker.corners[(index + 1) % marker.corners.length];
      return Math.hypot(next.x - corner.x, next.y - corner.y);
    }),
  );
}

/* Angle of the marker's top edge (corner 0 to corner 1) in degrees. */
export function bowAngle(corners: MarkerPoint[]) {
  return Math.atan2(corners[1].y - corners[0].y, corners[1].x - corners[0].x) * (180 / Math.PI);
}

export function bowPlacement(center: MarkerPoint, bridgeY: number | null, fingerboardY: number | null) {
  if (bridgeY === null || fingerboardY === null) return "uncalibrated";
  return Math.abs(center.y - bridgeY) <= Math.abs(center.y - fingerboardY) ? "bridge side" : "fingerboard side";
}
