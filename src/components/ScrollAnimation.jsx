/**
 * ScrollAnimation Component
 * 
 * This is the main component that renders the scroll-based animation
 * using Three.js (via react-three-fiber) and GSAP for scroll synchronization.
 * 
 * ARCHITECTURE OVERVIEW:
 * ======================
 * 
 * 1. RENDERING PIPELINE:
 *    - react-three-fiber creates a WebGL canvas and manages the render loop
 *    - A BufferGeometry holds all vertex positions
 *    - On each frame, we update vertex positions based on scroll progress
 *    - Postprocessing (Bloom) creates the glowing effect
 * 
 * 2. SCROLL SYNCHRONIZATION:
 *    - We track window scroll position and convert to progress (0-1)
 *    - GSAP ScrollTrigger is used for precise scroll synchronization
 *    - Lenis provides smooth scrolling behavior
 * 
 * 3. VERTEX MORPHING:
 *    - All four stages share the SAME BufferGeometry
 *    - The vertexPositions utility generates positions for each stage
 *    - Positions are interpolated during transitions
 * 
 * 4. PERFORMANCE:
 *    - BufferGeometry is updated in-place (no new allocations)
 *    - needsUpdate flag triggers GPU re-upload only when needed
 *    - Postprocessing is optimized with appropriate resolution
 */

import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode, BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { 
  generateVertexPositions, 
  getStageName, 
  VERTEX_COUNT 
} from '../utils/vertexPositions';

/**
 * GLOW EFFECT CONFIGURATION
 * =========================
 * 
 * The glow effect is achieved through multiple layers:
 * 
 * 1. CORE LINE: A thin, bright line at full opacity
 *    - Uses LineBasicMaterial with toneMapped=false to stay bright
 *    - Color: Bright cyan (#00DDFF)
 * 
 * 2. INNER GLOW LAYER: A thicker line with medium opacity
 *    - Uses additive blending to create light accumulation
 *    - Opacity: 0.4-0.6
 *    - Creates the immediate glow around the core
 * 
 * 3. OUTER GLOW LAYER: An even thicker line with low opacity
 *    - Uses additive blending
 *    - Opacity: 0.15-0.25
 *    - Creates the soft, extended halo effect
 * 
 * 4. BLOOM POSTPROCESSING: UnrealBloomPass adds camera-like light bleed
 *    - Threshold: 0 (all bright pixels bloom)
 *    - Strength: 2.5 (intense glow)
 *    - Radius: 1.0 (wide spread)
 * 
 * The combination of geometry-based glow layers + bloom postprocessing
 * creates the multi-layered, ethereal glow seen in the reference image.
 */

// Glow color palette - bright cyan-blue
const GLOW_COLORS = {
  core: '#00DDFF',       // Bright cyan for the core line
  innerGlow: '#00CCFF',  // Slightly softer for inner glow
  outerGlow: '#0099FF',  // More blue for outer glow
};

// Bloom configuration for the postprocessing pass
const BLOOM_CONFIG = {
  luminanceThreshold: 0,    // Allow all bright pixels to bloom (0 = no threshold)
  luminanceSmoothing: 0.4,  // Smooth transition into bloom
  intensity: 2.5,           // Strong bloom intensity
  mipmapBlur: true,         // Better quality blur
};

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

/**
 * GlowLine Component
 * 
 * A single line with glow properties. This component renders one layer
 * of the glow effect. Multiple GlowLine components are stacked to create
 * the multi-layered glow.
 * 
 * @param {Object} props
 * @param {Float32Array} props.positions - Vertex positions array
 * @param {string} props.color - Line color (hex string)
 * @param {number} props.opacity - Line opacity (0-1)
 * @param {boolean} props.additive - Use additive blending for glow effect
 */
function GlowLine({ positions, color, opacity = 1, additive = false }) {
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={VERTEX_COUNT}
          array={positions}
          itemSize={3}
          usage={THREE.DynamicDrawUsage}
        />
      </bufferGeometry>
      <lineBasicMaterial
        color={color}
        transparent={opacity < 1 || additive}
        opacity={opacity}
        blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
        toneMapped={false}
        depthWrite={!additive}
      />
    </line>
  );
}

/**
 * AnimatedLine Component - ENHANCED WITH MULTI-LAYER GLOW
 * 
 * The core 3D element that displays the morphing line geometry.
 * Now includes multiple layers for a realistic glow effect:
 * 
 * LAYER STRUCTURE (back to front):
 * 1. Outer glow layer (thickest, lowest opacity, additive)
 * 2. Inner glow layer (medium thickness, medium opacity, additive)
 * 3. Core line (thin, full opacity)
 * 
 * All layers share the same vertex positions and animate together.
 * The additive blending causes light to accumulate where layers overlap,
 * creating the characteristic glow "bloom" around the line.
 */
function AnimatedLine({ scrollProgress, debug = false }) {
  // Refs for each geometry layer
  const coreGeometryRef = useRef();
  const innerGlowGeometryRef = useRef();
  const outerGlowGeometryRef = useRef();
  
  // Track animation time for animated stages (waves, DNA)
  const timeRef = useRef(0);
  
  /**
   * Create initial vertex positions for the geometry.
   * The initial state is the horizon (scroll progress 0).
   */
  const initialPositions = useMemo(() => {
    return generateVertexPositions(0, 0);
  }, []);
  
  /**
   * Animation frame update - Updates all glow layers simultaneously
   * 
   * All three layers (core, inner glow, outer glow) receive the same
   * vertex positions, ensuring they animate together as one unit.
   */
  useFrame((state, delta) => {
    // Skip if geometries aren't ready
    if (!coreGeometryRef.current) return;
    
    // Increment time for animated stages (waves pulse, DNA rotates)
    timeRef.current += delta;
    
    // Generate new positions based on current scroll and time
    const newPositions = generateVertexPositions(scrollProgress.current, timeRef.current);
    
    // Update all geometry layers with the same positions
    const geometries = [
      coreGeometryRef.current,
      innerGlowGeometryRef.current,
      outerGlowGeometryRef.current,
    ];
    
    geometries.forEach(geometry => {
      if (!geometry) return;
      
      const positionAttribute = geometry.attributes.position;
      
      // Copy new positions to the buffer
      for (let i = 0; i < newPositions.length; i++) {
        positionAttribute.array[i] = newPositions[i];
      }
      
      // Mark for GPU update
      positionAttribute.needsUpdate = true;
    });
  });
  
  return (
    <group>
      {/* 
        LAYER 1: OUTER GLOW (rendered first, furthest back)
        
        This is the outermost, most diffuse glow layer.
        - Very low opacity (0.15) for subtle effect
        - Additive blending makes it accumulate light
        - Creates the extended halo around the line
        
        Note: Even though linewidth doesn't work in WebGL2,
        the bloom postprocessing will spread this layer's light.
      */}
      <line renderOrder={1}>
        <bufferGeometry ref={outerGlowGeometryRef}>
          <bufferAttribute
            attach="attributes-position"
            count={VERTEX_COUNT}
            array={new Float32Array(initialPositions)}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={GLOW_COLORS.outerGlow}
          transparent={true}
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          depthWrite={false}
        />
      </line>
      
      {/* 
        LAYER 2: INNER GLOW (middle layer)
        
        Creates the immediate glow around the core line.
        - Medium opacity (0.4) for visible but soft glow
        - Additive blending adds to the outer glow
        - Positioned at same location as core
      */}
      <line renderOrder={2}>
        <bufferGeometry ref={innerGlowGeometryRef}>
          <bufferAttribute
            attach="attributes-position"
            count={VERTEX_COUNT}
            array={new Float32Array(initialPositions)}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={GLOW_COLORS.innerGlow}
          transparent={true}
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          depthWrite={false}
        />
      </line>
      
      {/* 
        LAYER 3: CORE LINE (rendered last, on top)
        
        The bright, sharp core of the line.
        - Full opacity for maximum brightness
        - toneMapped=false ensures it stays bright for bloom
        - This is the "anchor" that defines the line shape
      */}
      <line renderOrder={3}>
        <bufferGeometry ref={coreGeometryRef}>
          <bufferAttribute
            attach="attributes-position"
            count={VERTEX_COUNT}
            array={initialPositions}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={GLOW_COLORS.core}
          toneMapped={false}
        />
      </line>
    </group>
  );
}

/**
 * BackgroundParticles Component
 * 
 * Adds subtle, floating particles in the background for atmosphere.
 * These create a nebula-like effect that enhances the ethereal quality.
 * 
 * The particles are:
 * - Small points with low opacity
 * - Slowly drifting/floating
 * - Scattered across the viewport
 */
function BackgroundParticles({ count = 100 }) {
  const particlesRef = useRef();
  
  // Generate random particle positions
  const particlePositions = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Spread particles across the scene
      positions[i * 3] = (Math.random() - 0.5) * 20;     // x: -10 to 10
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10; // y: -5 to 5
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5;  // z: -2.5 to 2.5
    }
    return positions;
  }, [count]);
  
  // Animate particles with subtle drift
  useFrame((state, delta) => {
    if (!particlesRef.current) return;
    
    const positions = particlesRef.current.attributes.position.array;
    
    for (let i = 0; i < count; i++) {
      // Slow upward drift with slight horizontal movement
      positions[i * 3] += Math.sin(state.clock.elapsedTime + i) * 0.001;
      positions[i * 3 + 1] += delta * 0.02;
      
      // Reset particles that drift too high
      if (positions[i * 3 + 1] > 5) {
        positions[i * 3 + 1] = -5;
      }
    }
    
    particlesRef.current.attributes.position.needsUpdate = true;
  });
  
  return (
    <points>
      <bufferGeometry ref={particlesRef}>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particlePositions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#4488aa"
        size={0.03}
        transparent={true}
        opacity={0.4}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        depthWrite={false}
        sizeAttenuation={true}
      />
    </points>
  );
}

/**
 * Scene Component - ENHANCED WITH OPTIMIZED BLOOM
 * 
 * Contains the 3D scene setup including:
 * - Background particles for atmosphere
 * - The animated line geometry with multi-layer glow
 * - Camera positioning
 * - Postprocessing effects (enhanced Bloom for intense glow)
 * 
 * BLOOM EFFECT EXPLANATION:
 * =========================
 * 
 * The UnrealBloomPass works by:
 * 1. Extracting bright pixels (above luminanceThreshold)
 * 2. Blurring the extracted bright areas
 * 3. Adding the blurred result back to the original image
 * 
 * Our configuration:
 * - luminanceThreshold: 0 (all our bright lines trigger bloom)
 * - luminanceSmoothing: 0.4 (smooth falloff into bloom)
 * - intensity: 2.5 (strong glow effect)
 * - mipmapBlur: true (high quality blur with good performance)
 * 
 * Combined with the multi-layer geometry glow, this creates
 * the ethereal, camera-like light bleed effect.
 */
function Scene({ scrollProgress, debug }) {
  const { camera, gl } = useThree();
  
  // Position camera and configure renderer for optimal glow
  useEffect(() => {
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);
    
    // Configure renderer for better glow rendering
    // ACES Filmic tone mapping provides cinematic color response
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.2; // Slightly brighter exposure
    gl.outputColorSpace = THREE.SRGBColorSpace;
  }, [camera, gl]);
  
  return (
    <>
      {/* Subtle ambient light for atmosphere */}
      <ambientLight intensity={0.05} />
      
      {/* Background particles for nebula-like atmosphere */}
      <BackgroundParticles count={80} />
      
      {/* The morphing line animation with multi-layer glow */}
      <AnimatedLine scrollProgress={scrollProgress} debug={debug} />
      
      {/* 
        POSTPROCESSING - ENHANCED BLOOM
        
        The Bloom effect creates the "light bleed" around bright elements.
        This is the final layer that makes the glow feel like real light.
        
        Parameters (tuned for reference image):
        - luminanceThreshold: 0 (all bright pixels bloom - our line is bright)
        - luminanceSmoothing: 0.4 (smooth transition prevents harsh cutoff)
        - intensity: 2.5 (strong enough to create visible halo)
        - mipmapBlur: true (uses mipmaps for blur - faster and smoother)
        
        The combination of:
        1. Multi-layer geometry (inner/outer glow lines)
        2. Additive blending on glow layers
        3. Bloom postprocessing
        
        Creates the layered, ethereal glow matching the reference image.
      */}
      <EffectComposer>
        <Bloom
          luminanceThreshold={BLOOM_CONFIG.luminanceThreshold}
          luminanceSmoothing={BLOOM_CONFIG.luminanceSmoothing}
          intensity={BLOOM_CONFIG.intensity}
          mipmapBlur={BLOOM_CONFIG.mipmapBlur}
        />
      </EffectComposer>
    </>
  );
}

/**
 * ScrollAnimation - Main Export Component
 * 
 * This is the primary component that sets up:
 * 1. GSAP ScrollTrigger for scroll tracking
 * 2. The Three.js Canvas with react-three-fiber
 * 3. The Scene with animated geometry and postprocessing
 * 4. UI elements (scroll indicator, stage label)
 * 
 * SCROLL TRACKING:
 * We use a ref (scrollProgressRef) to store the current scroll progress.
 * Using a ref instead of state prevents React re-renders on every scroll,
 * which would be very expensive. The Three.js animation loop reads from
 * this ref directly.
 */
function ScrollAnimation() {
  // Ref to store scroll progress (0-1)
  // Using ref instead of state to avoid re-renders on scroll
  const scrollProgressRef = useRef(0);
  
  // State for UI display (we do use state here for the UI elements)
  const [displayProgress, setDisplayProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('Horizon');
  
  // Debug mode toggle
  const [debug, setDebug] = useState(true); // Set to false for production
  
  /**
   * Setup GSAP ScrollTrigger
   * 
   * ScrollTrigger watches the scroll position and calls our callback.
   * We use it to update the scrollProgressRef which is read by the
   * Three.js animation loop.
   * 
   * The trigger is set up on the '.scroll-spacer' element which has
   * a height of 400vh (4 viewport heights = 4 stages).
   */
  useEffect(() => {
    // Create ScrollTrigger instance
    const trigger = ScrollTrigger.create({
      trigger: '.scroll-spacer',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.5, // Smooth scrubbing (0.5 second lag)
      onUpdate: (self) => {
        // self.progress is 0-1 based on scroll position
        scrollProgressRef.current = self.progress;
        
        // Update UI state (throttled by React's batching)
        setDisplayProgress(Math.round(self.progress * 100));
        setCurrentStage(getStageName(self.progress));
      },
    });
    
    // Cleanup on unmount
    return () => {
      trigger.kill();
    };
  }, []);
  
  /**
   * Handle keyboard shortcut to toggle debug mode
   */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'd' && e.ctrlKey) {
        setDebug(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  return (
    <>
      {/* Fixed container for the Three.js canvas */}
      <div className="canvas-container">
        {/* 
          react-three-fiber Canvas
          
          This creates the WebGL context and manages the render loop.
          
          Properties:
          - camera: Initial camera configuration
          - dpr: Device pixel ratio (clamp to 2 for performance on high-DPI)
          - gl: WebGL context options
          - style: Full viewport coverage
        */}
        <Canvas
          camera={{ 
            position: [0, 0, 8], 
            fov: 50,
            near: 0.1,
            far: 100 
          }}
          dpr={[1, 2]} // Clamp DPR between 1 and 2
          gl={{ 
            antialias: true,
            alpha: false, // Opaque background for better performance
            powerPreference: 'high-performance',
            // Enhanced settings for glow effect
            premultipliedAlpha: true, // Better transparency blending
            preserveDrawingBuffer: false, // Performance optimization
            failIfMajorPerformanceCaveat: false, // Don't fail on low-end devices
          }}
          // Tone mapping is set in Scene component for proper glow rendering
          flat={false} // Enable tone mapping (will be configured in Scene)
          style={{ 
            background: '#030508', // Nearly black with blue tint
            width: '100%',
            height: '100%',
          }}
        >
          {/* Dark blue-black background color */}
          <color attach="background" args={['#030508']} />
          
          {/* The main scene with animation and effects */}
          <Scene scrollProgress={scrollProgressRef} debug={debug} />
        </Canvas>
      </div>
      
      {/* Debug UI - scroll progress indicator */}
      {debug && (
        <>
          <div className="scroll-indicator">
            Scroll: {displayProgress}%
          </div>
          
          <div className="stage-label glow-text">
            Stage: {currentStage}
          </div>
        </>
      )}
    </>
  );
}

export default ScrollAnimation;
