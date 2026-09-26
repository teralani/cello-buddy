export type WorldLandmark = { x: number; y: number; z: number };

function angleAt(
  first: WorldLandmark,
  vertex: WorldLandmark,
  last: WorldLandmark,
) {
  const firstVector = {
    x: first.x - vertex.x,
    y: first.y - vertex.y,
    z: first.z - vertex.z,
  };
  const lastVector = {
    x: last.x - vertex.x,
    y: last.y - vertex.y,
    z: last.z - vertex.z,
  };
  const denominator = Math.hypot(firstVector.x, firstVector.y, firstVector.z) *
    Math.hypot(lastVector.x, lastVector.y, lastVector.z);

  if (denominator === 0) return 0;
  const cosine = Math.min(1, Math.max(-1,
    (firstVector.x * lastVector.x + firstVector.y * lastVector.y + firstVector.z * lastVector.z) / denominator,
  ));
  return Math.acos(cosine) * (180 / Math.PI);
}

export function computeFeatures(poseLandmarks: WorldLandmark[], handLandmarks: WorldLandmark[]) {
  const shoulder = poseLandmarks[12];
  const elbow = poseLandmarks[14];
  const wrist = poseLandmarks[16];
  const middleMcp = handLandmarks[9];
  const thumbCmc = handLandmarks[1];
  const thumbTip = handLandmarks[4];
  const indexMcp = handLandmarks[5];
  const indexPip = handLandmarks[6];
  const indexTip = handLandmarks[8];
  const pinkyMcp = handLandmarks[17];
  const pinkyPip = handLandmarks[18];
  const pinkyTip = handLandmarks[20];

  return [
    angleAt(shoulder, elbow, wrist),
    Math.atan2(elbow.y - shoulder.y, elbow.x - shoulder.x) * (180 / Math.PI),
    angleAt(elbow, wrist, middleMcp),
    angleAt(wrist, thumbCmc, thumbTip),
    angleAt(indexMcp, indexPip, indexTip),
    angleAt(pinkyMcp, pinkyPip, pinkyTip),
  ];
}