const fs = require("fs");

// SVG dimensions
const width = 2000;
const height = 2000;

// Hexagon parameters - flat top/bottom, pointy left/right
const hexHeight = height / 3.5;
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

// Convert points to SVG polygon format
const bluePointsString = bluePoints
  .map((point) => `${point[0]},${point[1]}`)
  .join(" ");
const secondPointsString = secondPoints
  .map((point) => `${point[0]},${point[1]}`)
  .join(" ");

// Calculate spacing for hexagonal tiling
const ySpacing = hexHeight; // Full height spacing as requested
const xSpacing = hexWidth * 0.75; // 3/4 width for proper hexagonal tiling
const colOffset = hexHeight / 2; // Vertical offset for every other column

// Calculate how many hexagons we need
const cols = Math.ceil(width / xSpacing) + 2;
const rows = Math.ceil(height / ySpacing) + 1;

// Calculate centering offset
const patternWidth = (cols - 1) * xSpacing + hexWidth / 2;
const xOffset = (0 - hexWidth) / 4 / 2;

// Generate SVG with reusable geometry
let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <defs>
    <mask id="canvasMask">
      <rect width="${width}" height="${height}" fill="white" />
    </mask>
    <g id="splitHexagon">
      <polygon points="${bluePointsString}" fill="#38a8e0" />
      <polygon points="${secondPointsString}" fill="#683b11" />
    </g>
  </defs>
  
  <!-- White background -->
  <rect width="${width}" height="${height}" fill="white" />
  
  <!-- Masked hexagon pattern -->
  <g mask="url(#canvasMask)">
`;

// Add hexagonal tiling pattern
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    // Calculate base position
    let x = col * xSpacing + xOffset;
    let y = row * ySpacing;

    // Offset every other column vertically for interlocking
    if (col % 2 === 1) {
      y += colOffset;
    }

    // Skip hexagons that are completely outside the canvas
    if (x > width + hexWidth || y > height + hexHeight) continue;
    if (x + hexWidth < -hexWidth || y + hexHeight < -hexHeight) continue;

    svg += `    <g transform="translate(${x}, ${y})">
      <use href="#splitHexagon" />
    </g>
`;
  }
}

svg += `  </g>
</svg>`;

fs.writeFileSync("./docs/latest/signalwerk.svg", svg);
console.log("Split hexagon tiling pattern drawn as pattern.svg");
console.log(
  `Hexagon dimensions: ${hexWidth.toFixed(1)} x ${hexHeight.toFixed(1)}`,
);
console.log(`Blue polygon points: ${bluePointsString}`);
console.log(`Second polygon points: ${secondPointsString}`);
console.log(`Spacing: X=${xSpacing.toFixed(1)}, Y=${ySpacing.toFixed(1)}`);
console.log(`Column offset: ${colOffset.toFixed(1)}`);
console.log(`Grid: ${cols} x ${rows}`);
console.log(
  `Pattern width: ${patternWidth.toFixed(
    1,
  )}, X offset (centering): ${xOffset.toFixed(1)}`,
);
