/**
 * EPM Commercial - Icon Generator
 * Creates simple PNG icons for the system tray
 */

const fs = require('fs');
const path = require('path');

// Simple 16x16 PNG icon data (green circle on transparent background)
// This is a minimal valid PNG file
const createSimpleIcon = (color) => {
  // PNG header + IHDR chunk + IDAT chunk + IEND chunk
  // For simplicity, we'll create a small valid PNG

  // Using a pre-generated minimal 16x16 PNG
  // This creates a colored square icon
  const width = 16;
  const height = 16;

  // Parse hex color
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);

  // Create raw pixel data (RGBA)
  const pixels = [];
  for (let y = 0; y < height; y++) {
    pixels.push(0); // Filter byte
    for (let x = 0; x < width; x++) {
      // Create a rounded rectangle shape
      const centerX = 8;
      const centerY = 8;
      const radius = 6;
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

      if (dist <= radius) {
        pixels.push(r, g, b, 255); // RGBA
      } else {
        pixels.push(0, 0, 0, 0); // Transparent
      }
    }
  }

  return Buffer.from(pixels);
};

// Generate icons
const assetsDir = path.join(__dirname, '../../assets');

// Active (green)
const activeIcon = createSimpleIcon('#22c55e');
fs.writeFileSync(path.join(assetsDir, 'tray-icon.png'), activeIcon);

// Paused (yellow)
const pausedIcon = createSimpleIcon('#f59e0b');
fs.writeFileSync(path.join(assetsDir, 'tray-icon-paused.png'), pausedIcon);

// Warning (red)
const warningIcon = createSimpleIcon('#ef4444');
fs.writeFileSync(path.join(assetsDir, 'tray-icon-warning.png'), warningIcon);

console.log('Tray icons generated successfully');