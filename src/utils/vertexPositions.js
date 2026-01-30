/**
 * Vertex Position Generator
 * 
 * This module is the CORE of the animation system. It provides functions
 * to generate vertex positions for each of the four animation stages:
 * 
 * 1. Horizon: A smooth horizontal line
 * 2. Cracks: Jagged, fractured line segments branching from center
 * 3. Waves: Oscillating waveform pattern
 * 4. DNA Helix: Rotating double helix structure
 * 
 * ARCHITECTURE PRINCIPLE:
 * All stages use the SAME number of vertices. This allows smooth
 * interpolation between stages using GSAP. The vertices are simply
 * repositioned to form different shapes.
 * 
 * VERTEX COUNT:
 * We use 200 vertices which provides enough detail for all stages
 * while maintaining good performance.
 */

// Number of vertices used across all stages (must be consistent)
export const VERTEX_COUNT = 200;

// Animation dimensions
// ANIMATION_HEIGHT is fixed, width will be calculated based on viewport
export const ANIMATION_HEIGHT = 4;

// Default animation width (used if viewport width not provided)
export const DEFAULT_ANIMATION_WIDTH = 12;

// Store current viewport-aware animation width
let currentAnimationWidth = DEFAULT_ANIMATION_WIDTH;

/**
 * Calculate the visible width at a given camera distance
 * 
 * For a perspective camera, the visible width at distance z is:
 * width = 2 * z * tan(fov/2) * aspectRatio
 * 
 * @param {number} fov - Camera field of view in degrees
 * @param {number} cameraZ - Camera distance from origin
 * @param {number} aspectRatio - Viewport width / height
 * @returns {number} Visible width at the z=0 plane
 */
export function calculateVisibleWidth(fov, cameraZ, aspectRatio) {
  const fovRad = (fov * Math.PI) / 180;
  const height = 2 * Math.abs(cameraZ) * Math.tan(fovRad / 2);
  return height * aspectRatio;
}

/**
 * Update the animation width based on viewport dimensions
 * Call this when viewport changes or on initial setup
 * 
 * @param {number} width - New animation width
 */
export function setAnimationWidth(width) {
  currentAnimationWidth = width;
}

/**
 * Get the current animation width
 * @returns {number} Current animation width
 */
export function getAnimationWidth() {
  return currentAnimationWidth;
}

/**
 * Seeded random number generator for deterministic crack patterns
 * 
 * This ensures the crack pattern is the same every time, which is
 * essential for smooth interpolation. Using Math.random() would
 * create different patterns on each call, breaking the animation.
 * 
 * Uses a simple LCG (Linear Congruential Generator) algorithm.
 * 
 * @param {number} seed - Initial seed value
 * @returns {function} A function that returns pseudo-random numbers 0-1
 */
function createSeededRandom(seed) {
  let state = seed;
  return function() {
    // LCG parameters (same as glibc)
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * Interpolate between two values using a progress factor
 * @param {number} start - Starting value
 * @param {number} end - Ending value
 * @param {number} progress - Interpolation progress (0-1)
 * @returns {number} Interpolated value
 */
export function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

/**
 * Smoothstep function for smoother transitions
 * @param {number} x - Input value (0-1)
 * @returns {number} Smoothed value (0-1)
 */
export function smoothstep(x) {
  return x * x * (3 - 2 * x);
}

/**
 * Smoother step function (Ken Perlin's improved version)
 * Provides even smoother transitions with zero first and second derivatives at edges
 * @param {number} x - Input value (0-1)
 * @returns {number} Smoothed value (0-1)
 */
export function smootherstep(x) {
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/**
 * Ease out cubic - starts fast, ends slow
 * Good for crack appearance (dramatic start, gentle settle)
 * @param {number} x - Input value (0-1)
 * @returns {number} Eased value (0-1)
 */
export function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}

/**
 * Ease in out cubic - slow start and end, fast middle
 * Good for smooth transitions
 * @param {number} x - Input value (0-1)
 * @returns {number} Eased value (0-1)
 */
export function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Generate vertex positions for the HORIZON stage
 * 
 * Creates a simple horizontal line from left to right across the viewport.
 * The line is centered vertically (y = 0) and spans the full width.
 * 
 * Visual representation:
 * ─────────────────────────────────────
 * 
 * @param {number} time - Current animation time (unused for horizon)
 * @returns {Float32Array} Array of vertex positions [x1, y1, z1, x2, y2, z2, ...]
 */
export function generateHorizonPositions(time = 0) {
  const positions = new Float32Array(VERTEX_COUNT * 3);
  const width = currentAnimationWidth;
  
  for (let i = 0; i < VERTEX_COUNT; i++) {
    // Map index to x position across the FULL viewport width
    const x = (i / (VERTEX_COUNT - 1)) * width - width / 2;
    
    // Y position is 0 (centered) with a very subtle sine wave for "living" effect
    const y = Math.sin(x * 0.5 + time * 0.5) * 0.02;
    
    // Z is 0 (flat on the plane)
    const z = 0;
    
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }
  
  return positions;
}

/**
 * Generate vertex positions for the CRACKS stage
 * 
 * Creates CLEAN, ORGANIZED cracks that look like real wall/concrete cracks.
 * This is a simple, intentional pattern - not chaotic tangles.
 * 
 * CLEAN CRACK PATTERN:
 * ====================
 * 
 * Visual representation (UNIFORMLY distributed across width):
 *    /        /        /        /        /        /
 *   ─────────────────────────────────────────────────  (main horizontal line)
 *       \        \        \        \        \
 * 
 * Key features:
 * - 10 cracks total, evenly distributed across full width
 * - Alternating up/down pattern
 * - SMALL crack length (only 0.15 of height)
 * - Clean, straight lines with minimal curve
 * - Uniform distribution from left edge to right edge
 * 
 * @param {number} time - Current animation time (unused - static cracks)
 * @returns {Float32Array} Array of vertex positions
 */
export function generateCrackPositions(time = 0) {
  const positions = new Float32Array(VERTEX_COUNT * 3);
  const width = currentAnimationWidth;
  
  // Vertex allocation - more vertices for main line, fewer for cracks
  const MAIN_LINE_VERTICES = Math.floor(VERTEX_COUNT * 0.50);  // 100 vertices for main line
  const CRACK_VERTICES = VERTEX_COUNT - MAIN_LINE_VERTICES;     // 100 vertices for all cracks
  
  let vertexIndex = 0;
  
  // ===========================================
  // LAYER 1: MAIN HORIZONTAL LINE (clean, almost straight)
  // ===========================================
  
  for (let i = 0; i < MAIN_LINE_VERTICES; i++) {
    const t = i / (MAIN_LINE_VERTICES - 1); // 0 to 1
    const x = t * width - width / 2;
    
    // VERY subtle variation (almost invisible)
    const y = Math.sin(t * Math.PI * 2) * 0.005;
    
    positions[vertexIndex * 3] = x;
    positions[vertexIndex * 3 + 1] = y;
    positions[vertexIndex * 3 + 2] = 0;
    vertexIndex++;
  }
  
  // ===========================================
  // LAYER 2: CRACK BRANCHES (uniformly distributed)
  // ===========================================
  // Define specific crack zones spread EVENLY across the full width
  // Format: { xPercent: position along width (0-1), angle: degrees, lengthFactor: relative size }
  
  const crackZones = [
    // Left side cracks (0% - 33%)
    { xPercent: 0.08, angle: 40, lengthFactor: 0.12 },   // far left, up
    { xPercent: 0.18, angle: -35, lengthFactor: 0.10 },  // left, down
    { xPercent: 0.28, angle: 45, lengthFactor: 0.11 },   // left-center, up
    
    // Center cracks (33% - 66%)
    { xPercent: 0.40, angle: -40, lengthFactor: 0.12 },  // center-left, down
    { xPercent: 0.52, angle: 35, lengthFactor: 0.10 },   // center, up
    { xPercent: 0.62, angle: -45, lengthFactor: 0.11 },  // center-right, down
    
    // Right side cracks (66% - 100%)
    { xPercent: 0.72, angle: 42, lengthFactor: 0.10 },   // right-center, up
    { xPercent: 0.82, angle: -38, lengthFactor: 0.12 },  // right, down
    { xPercent: 0.92, angle: 48, lengthFactor: 0.11 },   // far right, up
  ];
  
  const NUM_CRACKS = crackZones.length;
  const verticesPerCrack = Math.floor(CRACK_VERTICES / NUM_CRACKS);
  
  for (let crackNum = 0; crackNum < NUM_CRACKS; crackNum++) {
    const zone = crackZones[crackNum];
    
    // Calculate origin position
    const originX = zone.xPercent * width - width / 2;
    const originY = 0;
    
    // Convert angle to radians
    const angleRad = (zone.angle * Math.PI) / 180;
    
    // Crack length - SMALL! Only 10-12% of ANIMATION_HEIGHT
    const crackLength = ANIMATION_HEIGHT * zone.lengthFactor;
    
    for (let i = 0; i < verticesPerCrack; i++) {
      const t = i / (verticesPerCrack - 1); // 0 to 1 along crack
      
      // Straight line from origin
      const x = originX + Math.cos(angleRad) * crackLength * t;
      const y = originY + Math.sin(angleRad) * crackLength * t;
      
      positions[vertexIndex * 3] = x;
      positions[vertexIndex * 3 + 1] = y;
      positions[vertexIndex * 3 + 2] = 0;
      vertexIndex++;
    }
  }
  
  // Fill any remaining vertices along the main line
  while (vertexIndex < VERTEX_COUNT) {
    const t = vertexIndex / VERTEX_COUNT;
    const x = t * width - width / 2;
    positions[vertexIndex * 3] = x;
    positions[vertexIndex * 3 + 1] = 0;
    positions[vertexIndex * 3 + 2] = 0;
    vertexIndex++;
  }
  
  return positions;
}

/**
 * Generate vertex positions for the WAVE stage
 * 
 * Creates an oscillating waveform pattern like an audio visualizer.
 * The wave continuously animates based on the time parameter.
 * 
 * IMPROVED WAVE PATTERN:
 * ======================
 * - Full viewport width coverage (edge to edge)
 * - 10-12 wave peaks visible (higher frequency)
 * - Smaller amplitude (more refined look)
 * - Complex waveform with multiple harmonics
 * 
 * Visual representation:
 *  ∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿
 * 
 * @param {number} time - Current animation time (drives wave motion)
 * @returns {Float32Array} Array of vertex positions
 */
export function generateWavePositions(time = 0) {
  const positions = new Float32Array(VERTEX_COUNT * 3);
  const width = currentAnimationWidth;
  
  // Wave parameters - refined for more instances
  const waveFrequency = 10; // Number of complete waves visible (was ~4)
  const baseAmplitude = ANIMATION_HEIGHT * 0.18; // Smaller amplitude (was 0.35)
  
  for (let i = 0; i < VERTEX_COUNT; i++) {
    // Full width coverage from left edge to right edge
    const t = i / (VERTEX_COUNT - 1); // 0 to 1
    const x = t * width - width / 2;
    
    // Multiple wave frequencies for complex waveform (audio visualizer look)
    // Primary wave (dominant)
    const wave1 = Math.sin(t * Math.PI * 2 * waveFrequency + time * 2.5) * 0.6;
    
    // Secondary wave (faster, adds detail)
    const wave2 = Math.sin(t * Math.PI * 2 * waveFrequency * 2 + time * 3.5) * 0.25;
    
    // Tertiary wave (even faster, subtle harmonics)
    const wave3 = Math.sin(t * Math.PI * 2 * waveFrequency * 3 + time * 4.5) * 0.1;
    
    // Quaternary wave (highest frequency, micro-detail)
    const wave4 = Math.sin(t * Math.PI * 2 * waveFrequency * 5 + time * 5) * 0.05;
    
    // Combine waves with envelope (smoother at edges, but less aggressive falloff)
    const envelope = 0.3 + 0.7 * Math.sin(t * Math.PI); // Never goes below 0.3
    
    const y = (wave1 + wave2 + wave3 + wave4) * envelope * baseAmplitude;
    
    // Z creates subtle depth variation - follows wave pattern
    const z = Math.sin(t * Math.PI * waveFrequency + time * 1.5) * 0.15;
    
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }
  
  return positions;
}

/**
 * Generate vertex positions for the DNA HELIX stage
 * 
 * Creates a rotating double helix structure. The helix continuously
 * rotates based on the time parameter, creating the iconic DNA spin.
 * 
 * HELIX STRUCTURE:
 * ================
 * - Two intertwining strands (the classic DNA double helix)
 * - Full viewport width coverage
 * - 8 complete rotations visible
 * 
 * Visual representation (side view):
 *  ╭─╮ ╭─╮ ╭─╮ ╭─╮ ╭─╮ ╭─╮ ╭─╮ ╭─╮
 *  ╰─╯ ╰─╯ ╰─╯ ╰─╯ ╰─╯ ╰─╯ ╰─╯ ╰─╯
 * 
 * @param {number} time - Current animation time (drives rotation)
 * @returns {Float32Array} Array of vertex positions
 */
export function generateDNAHelixPositions(time = 0) {
  const positions = new Float32Array(VERTEX_COUNT * 3);
  const width = currentAnimationWidth;
  
  // Helix parameters
  const rotationsVisible = 8; // Number of full rotations
  const helixRadius = 0.45; // Vertical amplitude of helix
  const rotationSpeed = 1.2; // Rotation speed
  
  for (let i = 0; i < VERTEX_COUNT; i++) {
    // Progress along the helix (0 to 1)
    const t = i / (VERTEX_COUNT - 1);
    
    // X position spans the full width
    const x = t * width - width / 2;
    
    // Angle along the helix (includes rotation over time)
    const angle = t * Math.PI * 2 * rotationsVisible + time * rotationSpeed;
    
    // Alternate between the two strands of the helix
    // Even vertices on strand 1, odd vertices on strand 2
    const strandOffset = (i % 2 === 0) ? 0 : Math.PI;
    
    // Y position follows sine wave (creates up/down oscillation)
    const y = Math.sin(angle + strandOffset) * helixRadius;
    
    // Z position follows cosine wave (creates depth, the 3D effect)
    const z = Math.cos(angle + strandOffset) * helixRadius * 0.4;
    
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }
  
  return positions;
}

/**
 * Interpolate between two position arrays
 * 
 * This is used to smoothly transition between stages.
 * Uses easeInOutCubic for smooth, natural-feeling transitions.
 * 
 * STAGGERED ANIMATION:
 * Vertices near the center of the animation start transitioning
 * slightly before vertices at the edges. This creates a "spreading"
 * effect that looks more organic than all vertices moving at once.
 * 
 * @param {Float32Array} from - Starting positions
 * @param {Float32Array} to - Target positions
 * @param {number} progress - Interpolation progress (0-1)
 * @param {boolean} staggered - Whether to use staggered animation (default: true)
 * @returns {Float32Array} Interpolated positions
 */
export function interpolatePositions(from, to, progress, staggered = true) {
  const result = new Float32Array(from.length);
  const numVertices = from.length / 3;
  
  for (let i = 0; i < numVertices; i++) {
    // Calculate stagger offset based on vertex position
    // Vertices near center (i near numVertices/2) transition first
    let vertexProgress = progress;
    
    if (staggered) {
      // Distance from center vertex (0 at center, 1 at edges)
      const centerDist = Math.abs(i - numVertices / 2) / (numVertices / 2);
      
      // Stagger amount: center vertices are ahead by up to 0.2 progress
      const staggerAmount = 0.15;
      const staggerOffset = centerDist * staggerAmount;
      
      // Adjust progress for this vertex (center starts earlier)
      vertexProgress = Math.max(0, Math.min(1, (progress - staggerOffset) / (1 - staggerAmount)));
    }
    
    // Apply easing function for smooth transition
    const easedProgress = easeInOutCubic(vertexProgress);
    
    // Interpolate x, y, z
    const baseIndex = i * 3;
    result[baseIndex] = lerp(from[baseIndex], to[baseIndex], easedProgress);
    result[baseIndex + 1] = lerp(from[baseIndex + 1], to[baseIndex + 1], easedProgress);
    result[baseIndex + 2] = lerp(from[baseIndex + 2], to[baseIndex + 2], easedProgress);
  }
  
  return result;
}

/**
 * MAIN FUNCTION: Generate vertex positions based on scroll progress
 * 
 * This is the primary function called on each scroll event.
 * It determines which stage(s) are active and interpolates
 * the vertex positions accordingly.
 * 
 * Scroll Progress Mapping:
 * - 0.00 - 0.25: Horizon stage (100% horizon)
 * - 0.25 - 0.50: Horizon → Cracks transition
 * - 0.50 - 0.75: Cracks → Waves transition
 * - 0.75 - 1.00: Waves → DNA Helix transition
 * 
 * @param {number} scrollProgress - Current scroll position (0-1)
 * @param {number} time - Current animation time for animated stages
 * @returns {Float32Array} Vertex positions for current scroll state
 */
export function generateVertexPositions(scrollProgress, time = 0) {
  // Clamp scroll progress to valid range
  const progress = Math.max(0, Math.min(1, scrollProgress));
  
  // Define stage boundaries
  const STAGE_1_END = 0.25;   // Horizon ends
  const STAGE_2_END = 0.50;   // Cracks ends
  const STAGE_3_END = 0.75;   // Waves ends
  // Stage 4 (DNA) ends at 1.0
  
  // Stage 1: Pure Horizon (0 - 0.25)
  if (progress <= STAGE_1_END) {
    return generateHorizonPositions(time);
  }
  
  // Stage 2: Horizon → Cracks transition (0.25 - 0.50)
  if (progress <= STAGE_2_END) {
    const transitionProgress = (progress - STAGE_1_END) / (STAGE_2_END - STAGE_1_END);
    const horizonPos = generateHorizonPositions(time);
    const crackPos = generateCrackPositions(time);
    return interpolatePositions(horizonPos, crackPos, transitionProgress);
  }
  
  // Stage 3: Cracks → Waves transition (0.50 - 0.75)
  if (progress <= STAGE_3_END) {
    const transitionProgress = (progress - STAGE_2_END) / (STAGE_3_END - STAGE_2_END);
    const crackPos = generateCrackPositions(time);
    const wavePos = generateWavePositions(time);
    return interpolatePositions(crackPos, wavePos, transitionProgress);
  }
  
  // Stage 4: Waves → DNA Helix transition (0.75 - 1.00)
  const transitionProgress = (progress - STAGE_3_END) / (1.0 - STAGE_3_END);
  const wavePos = generateWavePositions(time);
  const dnaPos = generateDNAHelixPositions(time);
  return interpolatePositions(wavePos, dnaPos, transitionProgress);
}

/**
 * Get the current stage name based on scroll progress
 * Useful for debugging and UI display
 * 
 * @param {number} scrollProgress - Current scroll position (0-1)
 * @returns {string} Current stage name
 */
export function getStageName(scrollProgress) {
  if (scrollProgress <= 0.25) return 'Horizon';
  if (scrollProgress <= 0.50) return 'Cracks';
  if (scrollProgress <= 0.75) return 'Waves';
  return 'DNA Helix';
}

/**
 * Get the current stage number (1-4) based on scroll progress
 * 
 * @param {number} scrollProgress - Current scroll position (0-1)
 * @returns {number} Current stage number (1-4)
 */
export function getStageNumber(scrollProgress) {
  if (scrollProgress <= 0.25) return 1;
  if (scrollProgress <= 0.50) return 2;
  if (scrollProgress <= 0.75) return 3;
  return 4;
}

/**
 * Generate vertex colors with CENTER GLOW EFFECT
 * 
 * Creates a color array where vertices near the center (x ≈ 0) are brighter
 * and vertices near the edges are dimmer. This creates a "spotlight" effect
 * that matches the reference image aesthetic.
 * 
 * GLOW FALLOFF:
 * =============
 * - Center (x = 0): Maximum brightness (1.0)
 * - Edges (x = ±width/2): Base brightness (0.4)
 * - Smooth cosine falloff between them
 * 
 * The color is a gradient from bright cyan (center) to dimmer blue (edges):
 * - Center: rgb(0.3, 1.0, 1.0) - bright cyan
 * - Edge: rgb(0.0, 0.5, 0.8) - dimmer blue
 * 
 * @param {Float32Array} positions - Vertex positions array [x,y,z, x,y,z, ...]
 * @param {number} scrollProgress - Current scroll progress (unused, kept for API compatibility)
 * @returns {Float32Array} Color array [r,g,b, r,g,b, ...] for each vertex
 */
export function generateVertexColors(positions, scrollProgress = 1) {
  const numVertices = positions.length / 3;
  const colors = new Float32Array(numVertices * 3); // RGB for each vertex
  
  // Color palette
  const centerColor = { r: 0.3, g: 1.0, b: 1.0 };   // Bright cyan at center
  const edgeColor = { r: 0.0, g: 0.5, b: 0.8 };     // Dimmer blue at edges
  
  // Half width for normalization - use dynamic width
  const halfWidth = currentAnimationWidth / 2;
  
  for (let i = 0; i < numVertices; i++) {
    const x = positions[i * 3]; // Get x position of this vertex
    
    // Calculate normalized distance from center (0 at center, 1 at edges)
    const distFromCenter = Math.abs(x) / halfWidth;
    const normalizedDist = Math.min(1, distFromCenter); // Clamp to 0-1
    
    // Use cosine falloff for smooth, natural-looking gradient
    const glowIntensity = Math.cos(normalizedDist * Math.PI / 2);
    
    // Boost the center intensity for extra glow
    const boostedIntensity = 0.4 + glowIntensity * 0.6; // Range: 0.4 to 1.0
    
    // Interpolate between edge color and center color
    const r = edgeColor.r + (centerColor.r - edgeColor.r) * boostedIntensity;
    const g = edgeColor.g + (centerColor.g - edgeColor.g) * boostedIntensity;
    const b = edgeColor.b + (centerColor.b - edgeColor.b) * boostedIntensity;
    
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  
  return colors;
}

/**
 * Get the glow intensity multiplier for a given x position
 * 
 * Utility function for other components that need center glow calculation.
 * Returns a value from 0.4 (edges) to 1.0 (center).
 * 
 * @param {number} x - X position
 * @returns {number} Glow intensity (0.4 to 1.0)
 */
export function getGlowIntensityAtX(x) {
  const halfWidth = currentAnimationWidth / 2;
  const normalizedDist = Math.min(1, Math.abs(x) / halfWidth);
  const glowIntensity = Math.cos(normalizedDist * Math.PI / 2);
  return 0.4 + glowIntensity * 0.6;
}
