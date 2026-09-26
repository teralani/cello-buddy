export type TapeColor = string;
export type TapePoint = { x: number; y: number; size: number };
export type DualTapePoints = { first: TapePoint; second: TapePoint; length: number };

type Hsv = { hue: number; saturation: number; value: number };
type Component = TapePoint & { width: number; height: number; fillRatio: number };

function hsv(red: number, green: number, blue: number): Hsv {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const maximum = Math.max(r, g, b);
  const difference = maximum - Math.min(r, g, b);
  let hue = 0;
  if (difference > 0) {
    if (maximum === r) hue = ((g - b) / difference) % 6;
    else if (maximum === g) hue = (b - r) / difference + 2;
    else hue = (r - g) / difference + 4;
    hue /= 6;
    if (hue < 0) hue += 1;
  }
  return { hue, saturation: maximum === 0 ? 0 : difference / maximum, value: maximum };
}

function targetHsv(color: TapeColor) {
  const value = color.replace("#", "");
  const expanded = value.length === 3 ? value.split("").map((channel) => channel + channel).join("") : value;
  const parsed = Number.parseInt(expanded, 16);
  if (Number.isNaN(parsed)) return hsv(255, 0, 0);
  return hsv((parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255);
}

function hueDistance(first: number, second: number) {
  return Math.min(Math.abs(first - second), 1 - Math.abs(first - second));
}

function findColorComponents(context: CanvasRenderingContext2D, color: TapeColor): Component[] {
  const width = context.canvas.width;
  const height = context.canvas.height;
  const step = Math.max(2, Math.floor(Math.min(width, height) / 180));
  const columns = Math.ceil(width / step);
  const rows = Math.ceil(height / step);
  const image = context.getImageData(0, 0, width, height);
  const target = targetHsv(color);
  const mask = new Uint8Array(columns * rows);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = Math.min(width - 1, column * step);
      const y = Math.min(height - 1, row * step);
      const offset = (y * width + x) * 4;
      const pixel = hsv(image.data[offset], image.data[offset + 1], image.data[offset + 2]);
      mask[row * columns + column] = pixel.value >= 0.15 && pixel.saturation >= 0.38 && hueDistance(pixel.hue, target.hue) <= 0.13 ? 1 : 0;
    }
  }

  const components: Component[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const start = row * columns + column;
      if (!mask[start]) continue;
      const queue = [{ x: column, y: row }];
      const points: { x: number; y: number }[] = [];
      let minX = column;
      let maxX = column;
      let minY = row;
      let maxY = row;
      mask[start] = 0;
      while (queue.length) {
        const point = queue.pop();
        if (!point) continue;
        points.push(point);
        minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
        for (const [nextX, nextY] of [[point.x - 1, point.y], [point.x + 1, point.y], [point.x, point.y - 1], [point.x, point.y + 1]]) {
          if (nextX < 0 || nextY < 0 || nextX >= columns || nextY >= rows) continue;
          const next = nextY * columns + nextX;
          if (mask[next]) { mask[next] = 0; queue.push({ x: nextX, y: nextY }); }
        }
      }
      const size = points.length * step * step;
      const componentWidth = (maxX - minX + 1) * step;
      const componentHeight = (maxY - minY + 1) * step;
      const fillRatio = points.length / ((maxX - minX + 1) * (maxY - minY + 1));
      if (size >= 8 && size <= width * height * 0.03 && fillRatio >= 0.12 && componentWidth <= width * 0.28 && componentHeight <= height * 0.28) {
        components.push({
          x: points.reduce((sum, point) => sum + point.x * step, 0) / points.length,
          y: points.reduce((sum, point) => sum + point.y * step, 0) / points.length,
          size,
          width: componentWidth,
          height: componentHeight,
          fillRatio,
        });
      }
    }
  }
  return components.sort((first, second) => second.size - first.size).slice(0, 12);
}

export function detectDualTapePoints(context: CanvasRenderingContext2D, firstColor: TapeColor, secondColor: TapeColor, previous: DualTapePoints | null, expectedLength: number | null): DualTapePoints | null {
  const firstCandidates = findColorComponents(context, firstColor);
  const secondCandidates = findColorComponents(context, secondColor);
  const minimumLength = Math.min(context.canvas.width, context.canvas.height) * 0.12;
  const maximumLength = expectedLength ? expectedLength * 1.6 : Math.min(context.canvas.width, context.canvas.height) * 1.2;
  const candidates: { first: TapePoint; second: TapePoint; score: number; length: number }[] = [];

  for (const first of firstCandidates) {
    for (const second of secondCandidates) {
      const length = Math.hypot(second.x - first.x, second.y - first.y);
      if (length < minimumLength || length > maximumLength) continue;
      const lengthError = expectedLength ? Math.abs(length - expectedLength) / expectedLength : 0;
      const motionError = previous ? Math.min(
        Math.hypot(first.x - previous.first.x, first.y - previous.first.y) + Math.hypot(second.x - previous.second.x, second.y - previous.second.y),
        Math.hypot(first.x - previous.second.x, first.y - previous.second.y) + Math.hypot(second.x - previous.first.x, second.y - previous.first.y),
      ) / Math.min(context.canvas.width, context.canvas.height) : 0;
      candidates.push({ first, second, length, score: lengthError * 80 + motionError * 40 - Math.min(first.size, second.size) / (context.canvas.width * context.canvas.height) * 100 });
    }
  }
  candidates.sort((first, second) => first.score - second.score);
  if (!candidates[0]) return null;
  const selected = candidates[0];
  if (previous) {
    const crossed = Math.hypot(selected.first.x - previous.second.x, selected.first.y - previous.second.y) + Math.hypot(selected.second.x - previous.first.x, selected.second.y - previous.first.y);
    const direct = Math.hypot(selected.first.x - previous.first.x, selected.first.y - previous.first.y) + Math.hypot(selected.second.x - previous.second.x, selected.second.y - previous.second.y);
    if (crossed < direct) return { first: selected.second, second: selected.first, length: selected.length };
  }
  return { first: selected.first, second: selected.second, length: selected.length };
}

export function bowAngle(first: TapePoint, second: TapePoint) {
  let angle = Math.atan2(second.y - first.y, second.x - first.x) * (180 / Math.PI);
  if (angle > 90) angle -= 180;
  if (angle <= -90) angle += 180;
  return angle;
}

export function angleDelta(current: number, baseline: number) {
  let delta = current - baseline;
  if (delta > 90) delta -= 180;
  if (delta <= -90) delta += 180;
  return delta;
}

export function bowPlacement(midpoint: TapePoint, bridgeY: number | null, fingerboardY: number | null) {
  if (bridgeY === null || fingerboardY === null) return "uncalibrated";
  return Math.abs(midpoint.y - bridgeY) <= Math.abs(midpoint.y - fingerboardY) ? "bridge side" : "fingerboard side";
}