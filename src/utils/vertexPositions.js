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

// Animation aspect ratio (horizontal spread)
export const ANIMATION_WIDTH = 12;
export const ANIMATION_HEIGHT = 4;

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
  
  for (let i = 0; i < VERTEX_COUNT; i++) {
    // Map index to x position across the width
    const x = (i / (VERTEX_COUNT - 1)) * ANIMATION_WIDTH - ANIMATION_WIDTH / 2;
    
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
 * Creates a complex fractured line pattern that branches outward from
 * the center horizontal line. The pattern resembles lightning or
 * stress fractures in glass.
 * 
 * CRACK PATTERN ALGORITHM:
 * ========================
 * 
 * The pattern is built in layers:
 * 
 * 1. CENTRAL SPINE (40% of vertices):
 *    - A jagged horizontal line at y≈0
 *    - Has sharp peaks and valleys (not smooth)
 *    - Creates the "fractured center" look
 * 
 * 2. PRIMARY CRACKS (30% of vertices):
 *    - Major branches extending up/down from the spine
 *    - 6-8 primary cracks distributed across width
 *    - Angles between 30° and 80° from horizontal
 *    - Length varies for visual interest
 * 
 * 3. SECONDARY CRACKS (30% of vertices):
 *    - Smaller branches from primary cracks
 *    - Shorter length, more varied angles
 *    - Creates fractal-like complexity
 * 
 * Visual representation:
 *        ╱     ╲
 *       ╱   ╲   ╲
 *      ╱  ╲  ╲   │
 *   ──╱────╲──╲──┼────
 *     │  ╲   ╲  ╲│  ╱
 *     ╲   ╲   ╲  ╱ ╱
 *      ╲   ╲     ╱
 * 
 * @param {number} time - Current animation time (for subtle movement)
 * @returns {Float32Array} Array of vertex positions
 */
export function generateCrackPositions(time = 0) {
  const positions = new Float32Array(VERTEX_COUNT * 3);
  
  // Create seeded random for deterministic pattern
  const random = createSeededRandom(42);
  
  // Vertex allocation
  const SPINE_VERTICES = Math.floor(VERTEX_COUNT * 0.4);    // 80 vertices
  const PRIMARY_VERTICES = Math.floor(VERTEX_COUNT * 0.3);  // 60 vertices
  const SECONDARY_VERTICES = VERTEX_COUNT - SPINE_VERTICES - PRIMARY_VERTICES; // 60 vertices
  
  let vertexIndex = 0;
  
  // ===========================================
  // LAYER 1: CENTRAL SPINE (jagged horizontal)
  // ===========================================
  // This creates the fractured center line with sharp peaks
  
  for (let i = 0; i < SPINE_VERTICES; i++) {
    const t = i / (SPINE_VERTICES - 1); // 0 to 1
    const x = t * ANIMATION_WIDTH - ANIMATION_WIDTH / 2;
    
    // Distance from center (for intensity falloff at edges)
    const centerDist = Math.abs(t - 0.5) * 2; // 0 at center, 1 at edges
    const intensity = 1 - centerDist * 0.3; // Stronger at center
    
    // Create sharp, jagged pattern using multiple frequencies
    // High frequency = sharp peaks, low frequency = overall shape
    const noise1 = Math.sin(t * Math.PI * 15 + random() * 2) * 0.3;
    const noise2 = Math.sin(t * Math.PI * 31 + random() * 3) * 0.15;
    const noise3 = Math.sin(t * Math.PI * 47 + random() * 5) * 0.08;
    
    // Add some randomness for organic feel
    const randomOffset = (random() - 0.5) * 0.1;
    
    // Combine noises with intensity falloff
    const y = (noise1 + noise2 + noise3 + randomOffset) * intensity * ANIMATION_HEIGHT * 0.25;
    
    // Subtle Z depth - fractures "pop" forward at center
    const z = Math.max(0, (0.5 - centerDist) * 0.3) * Math.sin(t * Math.PI * 8) * 0.2;
    
    positions[vertexIndex * 3] = x;
    positions[vertexIndex * 3 + 1] = y;
    positions[vertexIndex * 3 + 2] = z;
    vertexIndex++;
  }
  
  // ===========================================
  // LAYER 2: PRIMARY CRACKS (major branches)
  // ===========================================
  // These are the main fracture lines extending up and down
  
  const NUM_PRIMARY_CRACKS = 8;
  const verticesPerPrimaryCrack = Math.floor(PRIMARY_VERTICES / NUM_PRIMARY_CRACKS);
  
  for (let crackNum = 0; crackNum < NUM_PRIMARY_CRACKS; crackNum++) {
    // Crack origin point on the spine
    const originT = (crackNum + 0.5) / NUM_PRIMARY_CRACKS; // Evenly distributed
    const originX = originT * ANIMATION_WIDTH - ANIMATION_WIDTH / 2;
    const originY = 0; // Start from center line
    
    // Crack direction and properties
    const goesUp = crackNum % 2 === 0; // Alternate up/down
    const baseAngle = goesUp ? Math.PI / 2 : -Math.PI / 2; // 90° or -90°
    const angleVariation = (random() - 0.5) * Math.PI * 0.5; // ±45° variation
    const angle = baseAngle + angleVariation;
    
    // Crack length (varies for visual interest)
    const length = (0.5 + random() * 0.8) * ANIMATION_HEIGHT * 0.5;
    
    // Generate vertices along this crack
    for (let i = 0; i < verticesPerPrimaryCrack; i++) {
      const t = i / (verticesPerPrimaryCrack - 1); // 0 to 1 along crack
      
      // Base position along crack
      let x = originX + Math.cos(angle) * length * t;
      let y = originY + Math.sin(angle) * length * t;
      
      // Add jaggedness (cracks aren't perfectly straight)
      const jaggedness = (random() - 0.5) * 0.15 * (1 - t * 0.5); // Less jagged at tips
      x += jaggedness;
      y += jaggedness * 0.5;
      
      // Subtle Z for depth
      const z = (random() - 0.5) * 0.1;
      
      positions[vertexIndex * 3] = x;
      positions[vertexIndex * 3 + 1] = y;
      positions[vertexIndex * 3 + 2] = z;
      vertexIndex++;
    }
  }
  
  // ===========================================
  // LAYER 3: SECONDARY CRACKS (sub-branches)
  // ===========================================
  // Smaller cracks branching from primary cracks
  
  const NUM_SECONDARY_CRACKS = 12;
  const verticesPerSecondaryCrack = Math.floor(SECONDARY_VERTICES / NUM_SECONDARY_CRACKS);
  
  for (let crackNum = 0; crackNum < NUM_SECONDARY_CRACKS; crackNum++) {
    // Secondary cracks branch from various points
    const originT = random(); // Random position along width
    const originX = originT * ANIMATION_WIDTH - ANIMATION_WIDTH / 2;
    
    // Start from slightly off-center (branching from primary cracks)
    const originY = (random() - 0.5) * ANIMATION_HEIGHT * 0.3;
    
    // More varied angles for secondary cracks
    const angle = (random() - 0.5) * Math.PI * 1.2; // ±108° from horizontal
    
    // Shorter length than primary cracks
    const length = (0.2 + random() * 0.4) * ANIMATION_HEIGHT * 0.4;
    
    for (let i = 0; i < verticesPerSecondaryCrack; i++) {
      const t = i / (verticesPerSecondaryCrack - 1);
      
      // Position along crack with more jaggedness
      let x = originX + Math.cos(angle) * length * t;
      let y = originY + Math.sin(angle) * length * t;
      
      // More jagged for secondary cracks
      const jaggedness = (random() - 0.5) * 0.2;
      x += jaggedness;
      y += jaggedness;
      
      const z = (random() - 0.5) * 0.05;
      
      positions[vertexIndex * 3] = x;
      positions[vertexIndex * 3 + 1] = y;
      positions[vertexIndex * 3 + 2] = z;
      vertexIndex++;
    }
  }
  
  // Fill any remaining vertices (edge case handling)
  while (vertexIndex < VERTEX_COUNT) {
    const t = vertexIndex / VERTEX_COUNT;
    positions[vertexIndex * 3] = t * ANIMATION_WIDTH - ANIMATION_WIDTH / 2;
    positions[vertexIndex * 3 + 1] = (random() - 0.5) * ANIMATION_HEIGHT * 0.2;
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
 * Visual representation:
 *     ╱╲    ╱╲    ╱╲
 *    ╱  ╲  ╱  ╲  ╱  ╲
 * ──╱────╲╱────╲╱────╲──
 *   ╲    ╱╲    ╱╲    ╱
 *    ╲  ╱  ╲  ╱  ╲  ╱
 * 
 * @param {number} time - Current animation time (drives wave motion)
 * @returns {Float32Array} Array of vertex positions
 */
export function generateWavePositions(time = 0) {
  const positions = new Float32Array(VERTEX_COUNT * 3);
  
  for (let i = 0; i < VERTEX_COUNT; i++) {
    const x = (i / (VERTEX_COUNT - 1)) * ANIMATION_WIDTH - ANIMATION_WIDTH / 2;
    
    // Normalized position (0 to 1)
    const t = i / (VERTEX_COUNT - 1);
    
    // Multiple frequencies create more complex waveform
    // Primary wave
    const wave1 = Math.sin(t * Math.PI * 8 + time * 2) * 0.5;
    // Secondary wave (faster, smaller)
    const wave2 = Math.sin(t * Math.PI * 16 + time * 3) * 0.25;
    // Tertiary wave (fastest, smallest - adds detail)
    const wave3 = Math.sin(t * Math.PI * 32 + time * 4) * 0.1;
    
    // Envelope: reduce amplitude at edges for cleaner look
    const envelope = Math.sin(t * Math.PI);
    
    const y = (wave1 + wave2 + wave3) * envelope * ANIMATION_HEIGHT * 0.35;
    
    // Z creates subtle depth variation
    const z = Math.sin(t * Math.PI * 4 + time) * 0.2;
    
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
 * Visual representation (side view):
 *    ╭─────╮   ╭─────╮
 *   ╱       ╲ ╱       ╲
 *  ╱    ╳    ╳    ╳    ╲
 *  ╲       ╱ ╲       ╱
 *   ╲─────╯   ╲─────╯
 * 
 * The helix is formed by two intertwining sine waves offset by π.
 * We alternate vertices between the two strands to create the
 * illusion of intertwining strands with a single line.
 * 
 * @param {number} time - Current animation time (drives rotation)
 * @returns {Float32Array} Array of vertex positions
 */
export function generateDNAHelixPositions(time = 0) {
  const positions = new Float32Array(VERTEX_COUNT * 3);
  
  // Helix parameters
  const rotationsVisible = 2.5; // Number of full rotations visible
  const helixRadius = 0.8; // Radius of the helix
  const rotationSpeed = 1.5; // How fast the helix rotates
  
  for (let i = 0; i < VERTEX_COUNT; i++) {
    // Progress along the helix (0 to 1)
    const t = i / (VERTEX_COUNT - 1);
    
    // X position spans the width
    const x = t * ANIMATION_WIDTH - ANIMATION_WIDTH / 2;
    
    // Angle along the helix (includes rotation over time)
    const angle = t * Math.PI * 2 * rotationsVisible + time * rotationSpeed;
    
    // Alternate between the two strands of the helix
    // Even vertices on strand 1, odd vertices on strand 2
    const strandOffset = (i % 2 === 0) ? 0 : Math.PI;
    
    // Y position follows sine wave (creates up/down oscillation)
    const y = Math.sin(angle + strandOffset) * helixRadius;
    
    // Z position follows cosine wave (creates depth, the 3D effect)
    const z = Math.cos(angle + strandOffset) * helixRadius * 0.5;
    
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
