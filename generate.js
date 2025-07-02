const fs = require("fs");

const defaultWidth = 2000;

// Parse command line arguments for --width flag
let inputWidth = null;
let inputSnapToGrid = null;

const args = process.argv.slice(2);

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--width" && i + 1 < args.length) {
    inputWidth = parseInt(args[i + 1], 10);
  } else if (args[i] === "--snap-to-grid" && i + 1 < args.length) {
    inputSnapToGrid = args[i + 1] === "true";
    break;
  }
}

// SVG dimensions: use argument if valid, otherwise fall back to default
const width =
  Number.isFinite(inputWidth) && inputWidth > 0 ? inputWidth : defaultWidth;
const height = width;
const snapToGrid = inputSnapToGrid === true;

const precision = 2;
const tolerance = 1e-6;

const cubesInHeight = 3.5;

// Hexagon parameters - flat top/bottom, pointy left/right
const hexHeight = height / cubesInHeight;
const hexWidth = (hexHeight * 2) / Math.sqrt(3); // Width for flat-top hexagon

// Calculate hexagon points (flat top/bottom orientation) - relative to center
const hexPoints = {
  center: [0, 0],
  left: [-hexWidth / 2, 0],
  topLeft: [-hexWidth / 4, -hexHeight / 2],
  topRight: [hexWidth / 4, -hexHeight / 2],
  right: [hexWidth / 2, 0],
  bottomRight: [hexWidth / 4, hexHeight / 2],
  bottomLeft: [-hexWidth / 4, hexHeight / 2],
};

// Blue polygon: top left, top right, right, center
const bluePoints = [
  hexPoints.topLeft,
  hexPoints.topRight,
  hexPoints.right,
  hexPoints.center,
];

// Second polygon: center, right, bottom right, bottom left
const secondPoints = [
  hexPoints.center,
  hexPoints.right,
  hexPoints.bottomRight,
  hexPoints.bottomLeft,
];

// Calculate spacing for hexagonal tiling
const ySpacing = hexHeight; // Full height spacing as requested
const xSpacing = hexWidth * 0.75; // 3/4 width for proper hexagonal tiling
const colOffset = hexHeight / 2; // Vertical offset for every other column

// Calculate how many hexagons we need
const cols = Math.ceil(width / xSpacing);
const rows = Math.ceil(height / ySpacing);

// Calculate centering offset
const patternWidth = (cols - 1) * xSpacing + hexWidth / 2;
const xOffset = (0 - hexWidth) / 4 / 2;

/**
 * Return true when the polygon’s bounding box has **no positive-area
 * overlap** with the canvas.  Touching an edge or corner counts as outside.
 */
function isPolygonOutsideCanvas(points, offsetX, offsetY) {
  // 1.  Bounding box of the translated polygon
  let minX = Infinity,
    minY = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity;

  for (const [dx, dy] of points) {
    const x = dx + offsetX;
    const y = dy + offsetY;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  // 2.  Intersection dimensions with the canvas (0 … width, 0 … height)
  const interWidth = Math.min(maxX, width) - Math.max(minX, 0);
  const interHeight = Math.min(maxY, height) - Math.max(minY, 0);

  // 3.  If either dimension is ≤ 0 (no *area* in common), it’s outside
  return interWidth <= tolerance || interHeight <= tolerance;
}

/**
 * Convert local-space polygon vertices to the most compact SVG path we can
 * manage while staying legal. The output is a relative path using:
 *
 *   m   – initial move
 *   h/v – horizontal / vertical lines
 *   l   – general lines, but omitted when the previous command was m or l
 *   z   – close path
 *
 * We add a space only when two positive numbers must be separated.  Negative
 * signs double as separators, so “12-34” is valid and shorter than “12 -34”.
 */
function pointsToPath(points, offsetX, offsetY) {
  const clamp = (x) => Math.max(0, Math.min(width, x));

  // format to ≤2 dp, strip trailing zeros, strip trailing dot
  const fmt = (n) => {
    const s = (+n.toFixed(precision)).toString();
    return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  };

  /* 1 ─ translate + clamp */
  let abs = points.map(([px, py]) => [clamp(px + offsetX), py + offsetY]);

  if (snapToGrid) {
    abs = abs.map(([px, py]) => [Math.round(px), Math.round(py)]);
  }

  /* 2 ─ build compact 'd' */
  let d = `m${fmt(abs[0][0])} ${fmt(abs[0][1])}`;
  let lastCmd = "m";
  let [prevX, prevY] = abs[0];

  const appendNumbers = (dxStr, dyStr) => {
    // ensure there is *some* separator before dx if the previous token is a number
    if (/\d|\./.test(d[d.length - 1])) {
      if (dxStr[0] !== "-") d += " "; // positive dx needs a space
    }
    d += dxStr;

    // separator between dx and dy (only if dy positive)
    if (dyStr[0] !== "-") d += " ";
    d += dyStr;
  };

  for (let i = 1; i < abs.length; i++) {
    const [x, y] = abs[i];
    let dx = x - prevX;
    let dy = y - prevY;

    // skip edges shrunk to a point by clamping
    if (Math.abs(dx) < tolerance && Math.abs(dy) < tolerance) continue;

    const dxStr = fmt(dx);
    const dyStr = fmt(dy);

    if (Math.abs(dy) < tolerance) {
      // ───── horizontal ─────
      d += `h${dxStr}`;
      lastCmd = "h";
    } else if (Math.abs(dx) < tolerance) {
      // ───── vertical ─────
      d += `v${dyStr}`;
      lastCmd = "v";
    } else {
      // ───── general line ─────
      if (lastCmd === "m" || lastCmd === "l") {
        // implicit 'l' → just numbers
        appendNumbers(dxStr, dyStr);
      } else {
        // need explicit 'l'
        d += `l${dxStr}`;
        if (dyStr[0] !== "-") d += " ";
        d += dyStr;
      }
      lastCmd = "l";
    }

    prevX = x;
    prevY = y;
  }

  d += "z";
  return `    <path d="${d}"/>`;
}

// Function to generate all blue polygon paths
function generateBluePaths() {
  const paths = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Calculate base position
      let x = col * xSpacing + xOffset;
      let y = row * ySpacing;

      // Offset every other column vertically for interlocking
      if (col % 2 === 1) {
        y += colOffset;
      }

      // Skip polygons that are completely outside the canvas
      if (isPolygonOutsideCanvas(bluePoints, x, y)) {
        continue;
      }

      paths.push(pointsToPath(bluePoints, x, y));
    }
  }

  return paths;
}

// Function to generate all brown polygon paths
function generateBrownPaths() {
  const paths = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Calculate base position
      let x = col * xSpacing + xOffset;
      let y = row * ySpacing;

      // Offset every other column vertically for interlocking
      if (col % 2 === 1) {
        y += colOffset;
      }

      // Skip polygons that are completely outside the canvas
      if (isPolygonOutsideCanvas(secondPoints, x, y)) continue;

      paths.push(pointsToPath(secondPoints, x, y));
    }
  }

  return paths;
}

// Generate all paths
const bluePaths = generateBluePaths();
const brownPaths = generateBrownPaths();

// Generate SVG
let svg = `<svg viewBox="0 0 ${width} ${height}"
  xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#fff"/>
  <g fill="#38a8e0">
${bluePaths.join("\n")}
  </g>
  <g fill="#683b11">
${brownPaths.join("\n")}
  </g>
</svg>`;

fs.writeFileSync("./docs/latest/signalwerk.svg", svg);
console.log("Split hexagon tiling pattern drawn as pattern.svg");
console.log(
  `Hexagon dimensions: ${hexWidth.toFixed(1)} x ${hexHeight.toFixed(1)}`,
);
console.log(`Spacing: X=${xSpacing.toFixed(1)}, Y=${ySpacing.toFixed(1)}`);
console.log(`Column offset: ${colOffset.toFixed(1)}`);
console.log(`Grid: ${cols} x ${rows}`);
console.log(
  `Pattern width: ${patternWidth.toFixed(
    1,
  )}, X offset (centering): ${xOffset.toFixed(1)}`,
);
console.log(
  `Generated ${bluePaths.length} blue paths and ${brownPaths.length} brown paths`,
);
