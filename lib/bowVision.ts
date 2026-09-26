export type TapeColor = "red" | "blue" | "green";
export type TapePoint = { x: number; y: number; size: number };

type PixelPoint = { x: number; y: number };

function matchesColor(red: number, green: number, blue: number, color: TapeColor) {
  const brightest = Math.max(red, green, blue);
  const darkest = Math.min(red, green, blue);
  if (brightest - darkest < 45 || brightest < 105) return false;
  if (color === "red") return red > green * 1.35 && red > blue * 1.35;
  if (color === "blue") return blue > red * 1.25 && blue > green * 1.1;
  return green > red * 1.25 && green > blue * 1.1;
}

export function detectTapePoints(context: CanvasRenderingContext2D, color: TapeColor): TapePoint[] {
  const width = context.canvas.width;
  const height = context.canvas.height;
  const step = Math.max(3, Math.floor(Math.min(width, height) / 160));
  const columns = Math.ceil(width / step);
  const rows = Math.ceil(height / step);
  const image = context.getImageData(0, 0, width, height);
  const mask = new Uint8Array(columns * rows);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = Math.min(width - 1, column * step);
      const y = Math.min(height - 1, row * step);
      const offset = (y * width + x) * 4;
      mask[row * columns + column] = matchesColor(image.data[offset], image.data[offset + 1], image.data[offset + 2], color) ? 1 : 0;
    }
  }

  const components: PixelPoint[][] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const start = row * columns + column;
      if (!mask[start]) continue;
      const queue = [{ x: column, y: row }];
      const component: PixelPoint[] = [];
      mask[start] = 0;
      while (queue.length) {
        const point = queue.pop();
        if (!point) continue;
        component.push(point);
        for (const [nextX, nextY] of [[point.x - 1, point.y], [point.x + 1, point.y], [point.x, point.y - 1], [point.x, point.y + 1]]) {
          if (nextX < 0 || nextY < 0 || nextX >= columns || nextY >= rows) continue;
          const next = nextY * columns + nextX;
          if (mask[next]) { mask[next] = 0; queue.push({ x: nextX, y: nextY }); }
        }
      }
      if (component.length >= 4) components.push(component);
    }
  }

  const blobs = components
    .sort((first, second) => second.length - first.length)
    .slice(0, 8)
    .map((component) => ({
      x: component.reduce((sum, point) => sum + point.x * step, 0) / component.length,
      y: component.reduce((sum, point) => sum + point.y * step, 0) / component.length,
      size: component.length * step * step,
    }));
  if (blobs.length < 2) return [];
  const pair = blobs.find((first, firstIndex) => blobs.slice(firstIndex + 1).some((second) => Math.hypot(first.x - second.x, first.y - second.y) > Math.min(width, height) * 0.12));
  if (!pair) return [];
  const second = blobs.find((candidate) => candidate !== pair && Math.hypot(pair.x - candidate.x, pair.y - candidate.y) > Math.min(width, height) * 0.12);
  return second ? [pair, second] : [];
}

export function bowAngle(first: TapePoint, second: TapePoint) {
  return Math.atan2(second.y - first.y, second.x - first.x) * (180 / Math.PI);
}

export function bowPlacement(midpoint: TapePoint, bridgeY: number | null, fingerboardY: number | null) {
  if (bridgeY === null || fingerboardY === null) return "uncalibrated";
  return Math.abs(midpoint.y - bridgeY) <= Math.abs(midpoint.y - fingerboardY) ? "bridge side" : "fingerboard side";
}
