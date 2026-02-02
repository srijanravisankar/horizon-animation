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
    
    // Y position is exactly 0 (perfectly horizontal, no variation)
    // This creates a clean, crisp line without any waviness
    const y = 0;
    
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
 * Creates REALISTIC WALL CRACKS - like cracks in concrete/plaster.
 * 
 * KEY TECHNIQUE: Random walk algorithm - each vertex moves randomly from previous.
 * This guarantees NO straight segments anywhere.
 * 
 * NOW WITH FLOWING ANIMATION - cracks pulse and flow dynamically from the start.
 * 
 * Reference: Real wall crack - rough, jagged texture, no straight lines
 * 
 * @param {number} time - Current animation time (drives flowing motion)
 * @returns {Float32Array} Array of vertex positions
 */
export function generateCrackPositions(time = 0) {
  const positions = new Float32Array(VERTEX_COUNT * 3);
  
  // Full screen width - same as horizon, waves, DNA
  const crackLength = currentAnimationWidth;
  const startX = -crackLength / 2;
  
  // Seeded random for consistent pattern
  const seededRandom = (seed) => {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  
  // Random walk Y values - EVERY vertex has random offset from previous
  let runningY = 0;
  
  // FLOWING ANIMATION: time-based wave that propagates along the crack
  const flowSpeed = 0.6; // How fast the flow moves (slowed down)
  const flowAmplitude = 0.015 * ANIMATION_HEIGHT; // How much the flow affects Y
  
  for (let i = 0; i < VERTEX_COUNT; i++) {
    const t = i / (VERTEX_COUNT - 1);
    const x = startX + t * crackLength;
    
    // Random walk: each vertex moves randomly from previous
    // This guarantees NO straight segments
    const step = (seededRandom(i * 17 + 42) - 0.5) * 0.025 * ANIMATION_HEIGHT;
    runningY += step;
    
    // Occasional bigger jump (10% chance) - creates crack deviations
    if (seededRandom(i * 31 + 7) > 0.90) {
      runningY += (seededRandom(i * 53) - 0.5) * 0.08 * ANIMATION_HEIGHT;
    }
    
    // Gently pull back toward center so it doesn't drift too far
    runningY *= 0.97;
    
    // Keep compact
    runningY = Math.max(-0.1 * ANIMATION_HEIGHT, Math.min(0.1 * ANIMATION_HEIGHT, runningY));
    
    // DYNAMIC FLOW: Add time-based wave motion
    // Multiple frequencies for organic, living crack feel
    const flow1 = Math.sin((t * 8 + time * flowSpeed) * Math.PI * 2) * flowAmplitude;
    const flow2 = Math.sin((t * 12 - time * flowSpeed * 0.7) * Math.PI * 2) * flowAmplitude * 0.6;
    const flow3 = Math.sin((t * 20 + time * flowSpeed * 1.3) * Math.PI * 2) * flowAmplitude * 0.3;
    
    const dynamicY = runningY + flow1 + flow2 + flow3;
    
    positions[i * 3] = x;
    positions[i * 3 + 1] = dynamicY;
    positions[i * 3 + 2] = 0;
  }
  
  return positions;
}

/**
 * Generate vertex positions for the WAVE stage
 * 
 * Creates an AUTHENTIC ECG/HEART RATE MONITOR waveform pattern.
 * Based on real electrocardiogram with proper P-QRS-T wave structure.
 * 
 * REAL ECG WAVE PATTERN:
 * ======================
 * 
 *              ╱╲
 *             ╱  ╲
 *     ╭╮     ╱    ╲      ╭──╮
 *   ──  ────╱      ╲────╱    ╲────────
 *                   ╲  ╱
 *                    ╲╱
 * 
 *   [P]    [Q] [R] [S]    [T]
 * 
 * Key features:
 * - P wave: Small rounded bump (atrial depolarization)
 * - QRS complex: Sharp spike up (R) with small dips before (Q) and after (S)
 * - T wave: Gentle rounded recovery wave
 * - Flat baseline between heartbeats
 * - Scrolls smoothly with time
 * 
 * @param {number} time - Current animation time (drives wave motion)
 * @returns {Float32Array} Array of vertex positions
 */
export function generateWavePositions(time = 0) {
  const positions = new Float32Array(VERTEX_COUNT * 3);
  const width = currentAnimationWidth;
  
  // Seeded random for consistent but varied wave heights
  const seededRandom = (seed) => {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  
  // ECG parameters - TIGHTER spacing
  const numHeartbeats = 7; // More heartbeats for tighter spacing
  const cycleWidth = 1.0 / numHeartbeats; // Width of one heartbeat cycle (0-1)
  const baseAmplitude = ANIMATION_HEIGHT * 0.35; // Base height of R peak
  
  // Pre-generate random heights for each heartbeat (0.4 to 1.0 range)
  const heartbeatHeights = [];
  for (let h = 0; h < numHeartbeats + 2; h++) {
    heartbeatHeights.push(0.4 + seededRandom(h * 7 + 13) * 0.6);
  }
  
  // Scroll speed - slow and steady
  const scrollSpeed = 0.025;
  
  for (let i = 0; i < VERTEX_COUNT; i++) {
    const t = i / (VERTEX_COUNT - 1); // 0 to 1
    const x = t * width - width / 2;
    
    // Add time-based scroll effect
    const scrolledT = (t + time * scrollSpeed) % 1;
    
    // Find which heartbeat cycle we're in and position within it
    const cycleIndex = Math.floor(scrolledT / cycleWidth);
    const cycleT = (scrolledT % cycleWidth) / cycleWidth; // 0 to 1 within cycle
    
    // Get random height multiplier for this heartbeat
    const heightMultiplier = heartbeatHeights[cycleIndex % heartbeatHeights.length];
    const effectiveAmplitude = baseAmplitude * heightMultiplier;
    
    // Start with flat baseline
    let y = 0;
    
    // === P WAVE (small rounded bump) ===
    // Position: 15-25% of cycle (moved later to tighten spacing)
    const pCenter = 0.20;
    const pWidth = 0.05;
    const pDist = Math.abs(cycleT - pCenter);
    if (pDist < pWidth) {
      const pT = 1 - (pDist / pWidth);
      // Smooth rounded shape using cosine
      y += Math.pow(Math.cos((1 - pT) * Math.PI / 2), 2) * effectiveAmplitude * 0.08;
    }
    
    // === QRS COMPLEX (the main spike) ===
    // Q wave: small dip before R (30-33% of cycle)
    const qCenter = 0.32;
    const qWidth = 0.015;
    const qDist = Math.abs(cycleT - qCenter);
    if (qDist < qWidth) {
      const qT = 1 - (qDist / qWidth);
      y -= Math.pow(qT, 1.5) * effectiveAmplitude * 0.12;
    }
    
    // R wave: TALL SHARP spike up (33-40% of cycle)
    const rCenter = 0.37;
    const rWidth = 0.025;
    const rDist = Math.abs(cycleT - rCenter);
    if (rDist < rWidth) {
      const rT = 1 - (rDist / rWidth);
      // Very sharp triangular peak
      y += Math.pow(rT, 1.2) * effectiveAmplitude;
    }
    
    // S wave: sharp dip down after R (40-45% of cycle)
    const sCenter = 0.43;
    const sWidth = 0.02;
    const sDist = Math.abs(cycleT - sCenter);
    if (sDist < sWidth) {
      const sT = 1 - (sDist / sWidth);
      y -= Math.pow(sT, 1.5) * effectiveAmplitude * 0.25;
    }
    
    // === T WAVE (rounded recovery bump) ===
    // Position: 55-70% of cycle
    const tCenter = 0.60;
    const tWidth = 0.08;
    const tDist = Math.abs(cycleT - tCenter);
    if (tDist < tWidth) {
      const tT = 1 - (tDist / tWidth);
      // Smooth rounded shape
      y += Math.pow(Math.cos((1 - tT) * Math.PI / 2), 2) * effectiveAmplitude * 0.15;
    }
    
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = 0;
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
  
  // Per-strand slant parameters
  const strand1Slant = 0.5; // Strand 1 slants upward to right
  const strand2Slant = 0.2; // Strand 2 slants less (creates separation)
  
  for (let i = 0; i < VERTEX_COUNT; i++) {
    // Progress along the helix (0 to 1)
    const t = i / (VERTEX_COUNT - 1);
    
    // Determine which strand (even = strand 1, odd = strand 2)
    const isStrand1 = (i % 2 === 0);
    const slantAmount = isStrand1 ? strand1Slant : strand2Slant;
    
    // X position spans the full width
    const x = t * width - width / 2;
    
    // Angle along the helix (includes rotation over time)
    const angle = t * Math.PI * 2 * rotationsVisible + time * rotationSpeed;
    
    // Alternate between the two strands of the helix
    const strandOffset = isStrand1 ? 0 : Math.PI;
    
    // Y position: slant + sine wave oscillation
    const slantY = (t - 0.5) * slantAmount;
    const y = slantY + Math.sin(angle + strandOffset) * helixRadius;
    
    // Z position follows cosine wave (creates depth, the 3D effect)
    const z = Math.cos(angle + strandOffset) * helixRadius * 0.4;
    
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }
  
  return positions;
}

/**
 * DNA STRAND VERTEX COUNT
 * Used for separate strand geometries
 */
export const DNA_STRAND_VERTEX_COUNT = 100;

/**
 * Generate SEPARATE Strand 1 positions for DNA overlay
 * 
 * Creates an independent geometry for Strand 1 with its own slant.
 * Used as an overlay during the DNA stage for enhanced visuals.
 * 
 * @param {number} time - Current animation time
 * @returns {Float32Array} Strand 1 vertex positions
 */
export function generateDNAStrand1Positions(time = 0) {
  const positions = new Float32Array(DNA_STRAND_VERTEX_COUNT * 3);
  const width = currentAnimationWidth;
  
  const rotationsVisible = 8;
  const helixRadius = 0.45;
  const rotationSpeed = 1.2;
  const slantAmount = 0.6; // Strand 1: more aggressive upward slant
  
  for (let i = 0; i < DNA_STRAND_VERTEX_COUNT; i++) {
    const t = i / (DNA_STRAND_VERTEX_COUNT - 1);
    const x = t * width - width / 2;
    const angle = t * Math.PI * 2 * rotationsVisible + time * rotationSpeed;
    
    // Strand 1: no phase offset
    const slantY = (t - 0.5) * slantAmount;
    const y = slantY + Math.sin(angle) * helixRadius;
    const z = Math.cos(angle) * helixRadius * 0.4;
    
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }
  
  return positions;
}

/**
 * Generate SEPARATE Strand 2 positions for DNA overlay
 * 
 * Creates an independent geometry for Strand 2 with its own slant.
 * Slants differently than Strand 1 for visual separation.
 * 
 * @param {number} time - Current animation time
 * @returns {Float32Array} Strand 2 vertex positions
 */
export function generateDNAStrand2Positions(time = 0) {
  const positions = new Float32Array(DNA_STRAND_VERTEX_COUNT * 3);
  const width = currentAnimationWidth;
  
  const rotationsVisible = 8;
  const helixRadius = 0.45;
  const rotationSpeed = 1.2;
  const slantAmount = 0.25; // Strand 2: less slant (creates divergence)
  
  for (let i = 0; i < DNA_STRAND_VERTEX_COUNT; i++) {
    const t = i / (DNA_STRAND_VERTEX_COUNT - 1);
    const x = t * width - width / 2;
    const angle = t * Math.PI * 2 * rotationsVisible + time * rotationSpeed;
    
    // Strand 2: π phase offset (opposite side of helix)
    const slantY = (t - 0.5) * slantAmount;
    const y = slantY + Math.sin(angle + Math.PI) * helixRadius;
    const z = Math.cos(angle + Math.PI) * helixRadius * 0.4;
    
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }
  
  return positions;
}

/**
 * Get DNA strand endpoint positions for blob rendering
 * 
 * Returns the final vertex position of each strand.
 * Used to position blob spheres at strand endpoints.
 * 
 * @param {number} time - Current animation time
 * @returns {Object} { strand1: {x,y,z}, strand2: {x,y,z} }
 */
export function getDNAStrandEndpoints(time = 0) {
  const width = currentAnimationWidth;
  const rotationsVisible = 8;
  const helixRadius = 0.45;
  const rotationSpeed = 1.2;
  
  // Strand 1 endpoint (t = 1.0)
  const t1 = 1.0;
  const x1 = t1 * width - width / 2;
  const angle1 = t1 * Math.PI * 2 * rotationsVisible + time * rotationSpeed;
  const slant1 = 0.6;
  const slantY1 = (t1 - 0.5) * slant1;
  const y1 = slantY1 + Math.sin(angle1) * helixRadius;
  const z1 = Math.cos(angle1) * helixRadius * 0.4;
  
  // Strand 2 endpoint (t = 1.0)
  const t2 = 1.0;
  const x2 = t2 * width - width / 2;
  const angle2 = t2 * Math.PI * 2 * rotationsVisible + time * rotationSpeed;
  const slant2 = 0.25;
  const slantY2 = (t2 - 0.5) * slant2;
  const y2 = slantY2 + Math.sin(angle2 + Math.PI) * helixRadius;
  const z2 = Math.cos(angle2 + Math.PI) * helixRadius * 0.4;
  
  return {
    strand1: { x: x1, y: y1, z: z1 },
    strand2: { x: x2, y: y2, z: z2 }
  };
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
 * Scroll Progress Mapping (EQUAL 25% per stage):
 * ===============================================
 * 
 * Stage 1 - HORIZON:  0.00 - 0.25 (25%)
 *   - 0.00 - 0.15: Pure horizon
 *   - 0.15 - 0.25: VISIBLE transition to cracks
 * 
 * Stage 2 - CRACKS:   0.25 - 0.50 (25%)
 *   - 0.25 - 0.40: Pure cracks
 *   - 0.40 - 0.50: VISIBLE transition to waves
 * 
 * Stage 3 - WAVES:    0.50 - 0.75 (25%)
 *   - 0.50 - 0.65: Pure waves
 *   - 0.65 - 0.75: VISIBLE transition to DNA
 * 
 * Stage 4 - DNA:      0.75 - 1.00 (25%)
 *   - 0.75 - 1.00: Pure DNA (no transition needed)
 * 
 * Each transition is 10% of total scroll (40% of each stage) - 
 * long enough to clearly see the morphing effect.
 * 
 * @param {number} scrollProgress - Current scroll position (0-1)
 * @param {number} time - Current animation time for animated stages
 * @returns {Float32Array} Vertex positions for current scroll state
 */
export function generateVertexPositions(scrollProgress, time = 0) {
  // Clamp scroll progress to valid range
  const progress = Math.max(0, Math.min(1, scrollProgress));
  
  // Stage boundaries (each stage is exactly 25%)
  const HORIZON_END = 0.25;
  const CRACKS_END = 0.50;
  const WAVES_END = 0.75;
  
  // Transition zones - 10% of total scroll each (40% of each stage)
  // This makes the morphing effect CLEARLY VISIBLE
  const TRANSITION_SIZE = 0.10;
  const HORIZON_TRANS_START = HORIZON_END - TRANSITION_SIZE;  // 0.15
  const CRACKS_TRANS_START = CRACKS_END - TRANSITION_SIZE;    // 0.40
  const WAVES_TRANS_START = WAVES_END - TRANSITION_SIZE;      // 0.65
  
  // ===== STAGE 1: HORIZON (0.00 - 0.25) =====
  if (progress < HORIZON_END) {
    if (progress < HORIZON_TRANS_START) {
      // Pure horizon
      return generateHorizonPositions(time);
    }
    // Transition: Horizon → Cracks (VISIBLE morphing)
    const t = (progress - HORIZON_TRANS_START) / TRANSITION_SIZE;
    return interpolatePositions(
      generateHorizonPositions(time),
      generateCrackPositions(time),
      t
    );
  }
  
  // ===== STAGE 2: CRACKS (0.25 - 0.50) =====
  if (progress < CRACKS_END) {
    if (progress < CRACKS_TRANS_START) {
      // Pure cracks
      return generateCrackPositions(time);
    }
    // Transition: Cracks → Waves (VISIBLE morphing)
    const t = (progress - CRACKS_TRANS_START) / TRANSITION_SIZE;
    return interpolatePositions(
      generateCrackPositions(time),
      generateWavePositions(time),
      t
    );
  }
  
  // ===== STAGE 3: WAVES (0.50 - 0.75) =====
  if (progress < WAVES_END) {
    if (progress < WAVES_TRANS_START) {
      // Pure waves
      return generateWavePositions(time);
    }
    // Transition: Waves → DNA (VISIBLE morphing)
    const t = (progress - WAVES_TRANS_START) / TRANSITION_SIZE;
    return interpolatePositions(
      generateWavePositions(time),
      generateDNAHelixPositions(time),
      t
    );
  }
  
  // ===== STAGE 4: DNA HELIX (0.75 - 1.00) =====
  return generateDNAHelixPositions(time);
}

/**
 * Get the current stage name based on scroll progress
 * Useful for debugging and UI display
 * 
 * @param {number} scrollProgress - Current scroll position (0-1)
 * @returns {string} Current stage name
 */
export function getStageName(scrollProgress) {
  if (scrollProgress < 0.25) return 'Horizon';
  if (scrollProgress < 0.50) return 'Cracks';
  if (scrollProgress < 0.75) return 'Waves';
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
 * Generate vertex colors with ENHANCED CENTER GLOW EFFECT
 * 
 * Creates a color array where vertices near the center (x ≈ 0) are MUCH brighter
 * and vertices near the edges are dimmer. This creates a strong "spotlight" effect
 * that matches the reference image aesthetic.
 * 
 * ENHANCED GLOW FALLOFF:
 * ======================
 * - Center (x = 0): Maximum brightness (1.0) - bright white-cyan
 * - Edges (x = ±width/2): Base brightness - dim blue
 * - Sharp cubic falloff for very pronounced "hot spot" effect at center
 * 
 * The color is a gradient from bright white-cyan (center) to dim blue (edges):
 * - Center: rgb(0.9, 1.0, 1.0) - almost white at the very center
 * - Edge: rgb(0.0, 0.2, 0.5) - dim blue
 * 
 * @param {Float32Array} positions - Vertex positions array [x,y,z, x,y,z, ...]
 * @param {number} scrollProgress - Current scroll progress (unused, kept for API compatibility)
 * @returns {Float32Array} Color array [r,g,b, r,g,b, ...] for each vertex
 */
export function generateVertexColors(positions, scrollProgress = 1) {
  const numVertices = positions.length / 3;
  const colors = new Float32Array(numVertices * 3); // RGB for each vertex
  
  // Color palette - INTENSE NEON BLUE throughout with brighter center
  const centerColor = { r: 0.2, g: 1.0, b: 1.0 };   // Super bright cyan at center
  const edgeColor = { r: 0.0, g: 0.6, b: 1.0 };     // Bright neon blue at edges (still bright!)
  
  // Half width for normalization - use dynamic width
  const halfWidth = currentAnimationWidth / 2;
  
  // Wider hot zone so more of the line is bright
  const hotZoneRadius = 0.4; // Center 40% of each side is "hot"
  
  for (let i = 0; i < numVertices; i++) {
    const x = positions[i * 3]; // Get x position of this vertex
    
    // Calculate normalized distance from center (0 at center, 1 at edges)
    const distFromCenter = Math.abs(x) / halfWidth;
    const normalizedDist = Math.min(1, distFromCenter); // Clamp to 0-1
    
    // Use quadratic falloff - gentler than cubic for wider bright area
    const falloff = 1 - Math.pow(normalizedDist / hotZoneRadius, 2);
    const clampedFalloff = Math.max(0, Math.min(1, falloff));
    
    // HIGH minimum intensity - edges are still bright blue
    // Range: 0.7 at edges to 1.0 at center
    const glowIntensity = 0.7 + clampedFalloff * 0.3;
    
    // Interpolate between edge color and center color
    const r = edgeColor.r + (centerColor.r - edgeColor.r) * glowIntensity;
    const g = edgeColor.g + (centerColor.g - edgeColor.g) * glowIntensity;
    const b = edgeColor.b + (centerColor.b - edgeColor.b) * glowIntensity;
    
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  
  return colors;
}

/**
 * Generate per-vertex colors for glow layers (inner/outer glow)
 * 
 * Similar to generateVertexColors but optimized for the glow layers.
 * Uses the same center-bright falloff so glow is more intense at center.
 * 
 * @param {Float32Array} positions - Vertex positions array
 * @param {string} layer - 'inner' or 'outer' glow layer
 * @returns {Float32Array} Color array with alpha embedded in brightness
 */
export function generateGlowColors(positions, layer = 'inner') {
  const numVertices = positions.length / 3;
  const colors = new Float32Array(numVertices * 3);
  
  // Base colors for glow layers - INTENSE NEON BLUE
  const innerColor = { r: 0.1, g: 0.9, b: 1.0 };    // Super bright cyan for inner glow
  const outerColor = { r: 0.0, g: 0.7, b: 1.0 };    // Bright electric blue for outer glow
  const baseColor = layer === 'inner' ? innerColor : outerColor;
  
  const halfWidth = currentAnimationWidth / 2;
  const hotZoneRadius = 0.5; // Wide hot zone
  
  for (let i = 0; i < numVertices; i++) {
    const x = positions[i * 3];
    const distFromCenter = Math.abs(x) / halfWidth;
    const normalizedDist = Math.min(1, distFromCenter);
    
    // Gentler quadratic falloff
    const falloff = 1 - Math.pow(normalizedDist / hotZoneRadius, 2);
    const clampedFalloff = Math.max(0, Math.min(1, falloff));
    
    // HIGH minimum intensity - whole line glows bright
    // Range: 0.6 at edges to 1.0 at center
    const intensity = 0.6 + clampedFalloff * 0.4;
    
    colors[i * 3] = baseColor.r * intensity;
    colors[i * 3 + 1] = baseColor.g * intensity;
    colors[i * 3 + 2] = baseColor.b * intensity;
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
  // Use quadratic falloff to match generateVertexColors
  const quadraticFalloff = 1 - (normalizedDist * normalizedDist);
  return 0.2 + quadraticFalloff * 0.8;
}
