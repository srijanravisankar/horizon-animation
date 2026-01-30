import React from 'react';
import ScrollAnimation from './components/ScrollAnimation';

/**
 * Main App Component
 * 
 * This is the root component that renders the scroll-based animation.
 * The animation transforms through four stages as the user scrolls:
 * 
 * 1. Horizon (0-25%): A calm, glowing horizontal line
 * 2. Cracks (25-50%): The line fractures into jagged segments
 * 3. Waves (50-75%): Transforms into an animated waveform
 * 4. DNA Helix (75-100%): Morphs into a rotating double helix
 * 
 * Architecture Notes:
 * - All stages share the SAME BufferGeometry (vertex position morphing)
 * - GSAP handles smooth interpolation between vertex configurations
 * - Three.js provides WebGL rendering with postprocessing for glow
 * - react-three-fiber simplifies Three.js integration with React
 */
function App() {
  return (
    <div className="scroll-container">
      {/* The Three.js canvas is fixed position and covers the viewport */}
      <ScrollAnimation />
      
      {/* 
        Scroll spacer creates the scrollable height.
        400vh = 4 viewport heights for 4 animation stages.
        The actual content is the fixed Three.js canvas; this div
        just provides the scrollable "runway" for the animation.
      */}
      <div className="scroll-spacer" aria-hidden="true" />
    </div>
  );
}

export default App;
