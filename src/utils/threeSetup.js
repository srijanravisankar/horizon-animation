/**
 * Three.js Initialization Utilities
 * 
 * This module provides helper functions for initializing Three.js
 * components. While react-three-fiber handles most of this automatically,
 * these utilities are useful for:
 * 
 * 1. Custom configurations
 * 2. Understanding how Three.js works under the hood
 * 3. Direct Three.js usage without react-three-fiber
 * 
 * RENDERING PIPELINE OVERVIEW:
 * ============================
 * 
 * 1. Scene Creation:
 *    - THREE.Scene() creates the container for all 3D objects
 *    - Objects are added to the scene with scene.add(object)
 * 
 * 2. Camera Setup:
 *    - PerspectiveCamera for 3D perspective
 *    - OrthographicCamera for 2D-like view
 *    - Camera position and lookAt determine view
 * 
 * 3. Renderer:
 *    - WebGLRenderer uses GPU for rendering
 *    - Outputs to a canvas element
 *    - Called every frame in animation loop
 * 
 * 4. Postprocessing:
 *    - EffectComposer chains multiple render passes
 *    - Each pass modifies the rendered image
 *    - Final pass outputs to screen
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass';

/**
 * Initialize a Three.js scene with default settings
 * 
 * @returns {THREE.Scene} Configured scene
 */
export function createScene() {
  const scene = new THREE.Scene();
  
  // Set background color (dark blue-black)
  scene.background = new THREE.Color('#030508');
  
  // Optional: Add fog for atmosphere
  // scene.fog = new THREE.FogExp2('#030508', 0.1);
  
  return scene;
}

/**
 * Create a perspective camera configured for the animation
 * 
 * The camera is positioned to see the full width of the animation
 * (approximately 12 units wide) while keeping everything in frame.
 * 
 * @param {number} aspect - Viewport aspect ratio (width / height)
 * @returns {THREE.PerspectiveCamera} Configured camera
 */
export function createCamera(aspect = window.innerWidth / window.innerHeight) {
  // Field of view: 50 degrees is a natural perspective
  // Near/far planes: 0.1 to 100 units covers our scene well
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
  
  // Position camera 8 units back to see the full animation
  camera.position.set(0, 0, 8);
  camera.lookAt(0, 0, 0);
  
  return camera;
}

/**
 * Create a WebGL renderer with optimized settings
 * 
 * PERFORMANCE CONSIDERATIONS:
 * - powerPreference: 'high-performance' uses discrete GPU if available
 * - antialias: Smooths jagged edges (slight performance cost)
 * - alpha: false means opaque background (faster)
 * - pixelRatio: Capped at 2 to prevent performance issues on 4K displays
 * 
 * @param {HTMLCanvasElement} canvas - Optional existing canvas element
 * @returns {THREE.WebGLRenderer} Configured renderer
 */
export function createRenderer(canvas = undefined) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false, // Not needed, slight memory save
  });
  
  // Set size to viewport
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  // Clamp pixel ratio to 2 for performance
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  // Enable tone mapping for better color handling
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  
  // Output encoding for correct colors
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  
  return renderer;
}

/**
 * Setup postprocessing with UnrealBloomPass
 * 
 * The bloom pass creates the glowing effect on bright elements.
 * 
 * HOW BLOOM WORKS:
 * 1. Scene is rendered normally (RenderPass)
 * 2. Bright pixels are extracted based on threshold
 * 3. Extracted bright areas are blurred
 * 4. Blurred bright areas are added back to the original image
 * 5. Result: Bright things "glow"
 * 
 * @param {THREE.WebGLRenderer} renderer - The WebGL renderer
 * @param {THREE.Scene} scene - The scene to render
 * @param {THREE.Camera} camera - The camera to render from
 * @param {Object} bloomConfig - Bloom configuration
 * @returns {EffectComposer} The effect composer for rendering
 */
export function setupPostprocessing(renderer, scene, camera, bloomConfig = {}) {
  const {
    threshold = 0.2,    // Brightness threshold for bloom (0-1)
    strength = 2.0,     // Bloom intensity
    radius = 0.5,       // Bloom spread radius
  } = bloomConfig;
  
  // Create the composer
  const composer = new EffectComposer(renderer);
  
  // Pass 1: Render the scene normally
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  
  // Pass 2: Apply bloom to bright areas
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    strength,
    radius,
    threshold
  );
  composer.addPass(bloomPass);
  
  // Pass 3: Output (handles color space conversion)
  const outputPass = new OutputPass();
  composer.addPass(outputPass);
  
  return composer;
}

/**
 * Create a BufferGeometry for line rendering
 * 
 * This creates a geometry with the specified number of vertices
 * that can be updated dynamically. The key is using DynamicDrawUsage
 * which tells the GPU that we'll be updating frequently.
 * 
 * @param {number} vertexCount - Number of vertices
 * @param {Float32Array} initialPositions - Initial vertex positions
 * @returns {THREE.BufferGeometry} The line geometry
 */
export function createLineGeometry(vertexCount, initialPositions = null) {
  const geometry = new THREE.BufferGeometry();
  
  // Create position array if not provided
  const positions = initialPositions || new Float32Array(vertexCount * 3);
  
  // Create the position attribute
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  positionAttribute.usage = THREE.DynamicDrawUsage; // Optimize for updates
  
  geometry.setAttribute('position', positionAttribute);
  
  return geometry;
}

/**
 * Create a line material with glow properties
 * 
 * Note: linewidth > 1 only works on some systems (not WebGL2 on most browsers)
 * For thick, anti-aliased lines, use Line2 from three/examples/jsm/lines
 * 
 * @param {Object} config - Material configuration
 * @returns {THREE.LineBasicMaterial} The line material
 */
export function createLineMaterial(config = {}) {
  const {
    color = '#4fc3dc',
    linewidth = 2,
    opacity = 1.0,
    transparent = false,
  } = config;
  
  return new THREE.LineBasicMaterial({
    color: new THREE.Color(color),
    linewidth,
    opacity,
    transparent,
    toneMapped: false, // Keep bright for bloom
  });
}

/**
 * Update geometry positions efficiently
 * 
 * This function updates the position buffer in-place without
 * creating new objects, which is important for performance.
 * 
 * @param {THREE.BufferGeometry} geometry - The geometry to update
 * @param {Float32Array} newPositions - New position values
 */
export function updateGeometryPositions(geometry, newPositions) {
  const positions = geometry.attributes.position.array;
  
  // Copy new values to the existing array
  for (let i = 0; i < newPositions.length; i++) {
    positions[i] = newPositions[i];
  }
  
  // Tell Three.js the buffer needs to be re-uploaded to GPU
  geometry.attributes.position.needsUpdate = true;
  
  // Optional: Update bounding sphere for frustum culling
  // geometry.computeBoundingSphere();
}

/**
 * Handle window resize
 * 
 * Updates camera aspect ratio and renderer size when the window
 * is resized. Should be called on the 'resize' event.
 * 
 * @param {THREE.Camera} camera - The camera to update
 * @param {THREE.WebGLRenderer} renderer - The renderer to update
 * @param {EffectComposer} composer - Optional effect composer
 */
export function handleResize(camera, renderer, composer = null) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  // Update camera
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  
  // Update renderer
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  // Update composer if present
  if (composer) {
    composer.setSize(width, height);
  }
}

/**
 * Clean up Three.js resources
 * 
 * Important for preventing memory leaks when the component unmounts.
 * Three.js objects need to be explicitly disposed.
 * 
 * @param {Object} resources - Object containing Three.js resources
 */
export function disposeResources({ geometry, material, renderer, composer } = {}) {
  if (geometry) geometry.dispose();
  if (material) material.dispose();
  if (renderer) renderer.dispose();
  if (composer) {
    composer.passes.forEach(pass => {
      if (pass.dispose) pass.dispose();
    });
  }
}
