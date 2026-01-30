/**
 * Custom Scroll Hook with Lenis
 * 
 * This hook provides smooth scrolling using the Lenis library.
 * Lenis creates a butter-smooth scrolling experience that works
 * well with GSAP ScrollTrigger.
 * 
 * BENEFITS OF LENIS:
 * - Smooth momentum scrolling
 * - Works on all browsers
 * - Touch-friendly for mobile
 * - Integrates with ScrollTrigger
 * 
 * USAGE:
 * Simply call useSmoothScroll() in your App component.
 */

import { useEffect, useRef } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Initialize and manage Lenis smooth scroll
 * 
 * @param {Object} options - Lenis configuration options
 * @returns {Object} - { lenis: Lenis instance, scrollTo: function }
 */
export function useSmoothScroll(options = {}) {
  const lenisRef = useRef(null);
  
  useEffect(() => {
    // Create Lenis instance with default options
    const lenis = new Lenis({
      duration: 1.2, // Duration of scroll animation
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Easing function
      direction: 'vertical', // Scroll direction
      gestureDirection: 'vertical', // Gesture direction
      smooth: true, // Enable smooth scrolling
      mouseMultiplier: 1, // Mouse wheel multiplier
      smoothTouch: false, // Disable smooth on touch (feels more native)
      touchMultiplier: 2, // Touch multiplier
      infinite: false, // Infinite scrolling
      ...options,
    });
    
    lenisRef.current = lenis;
    
    // Connect Lenis to GSAP ScrollTrigger
    // This ensures ScrollTrigger uses Lenis' scroll position
    lenis.on('scroll', ScrollTrigger.update);
    
    // Add Lenis to GSAP's ticker for smooth animation
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    
    // Disable GSAP's internal lag smoothing to prevent conflicts
    gsap.ticker.lagSmoothing(0);
    
    // Cleanup on unmount
    return () => {
      lenis.destroy();
      gsap.ticker.remove(lenis.raf);
    };
  }, [options]);
  
  /**
   * Scroll to a specific target
   * @param {string|number|HTMLElement} target - Scroll target
   * @param {Object} options - Scroll options
   */
  const scrollTo = (target, options = {}) => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(target, options);
    }
  };
  
  return {
    lenis: lenisRef.current,
    scrollTo,
  };
}

/**
 * Get scroll progress as a value from 0 to 1
 * 
 * This utility calculates the current scroll progress based on
 * the document height and viewport height.
 * 
 * @returns {number} Scroll progress (0-1)
 */
export function getScrollProgress() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const docHeight = document.documentElement.scrollHeight;
  const winHeight = window.innerHeight;
  const scrollableHeight = docHeight - winHeight;
  
  if (scrollableHeight <= 0) return 0;
  
  return Math.max(0, Math.min(1, scrollTop / scrollableHeight));
}

/**
 * Create a throttled scroll handler
 * 
 * Throttling prevents the scroll handler from being called
 * too frequently, improving performance.
 * 
 * @param {Function} callback - Function to call on scroll
 * @param {number} limit - Minimum ms between calls
 * @returns {Function} Throttled function
 */
export function throttle(callback, limit = 16) {
  let waiting = false;
  let lastArgs = null;
  
  return function(...args) {
    if (!waiting) {
      callback.apply(this, args);
      waiting = true;
      
      setTimeout(() => {
        waiting = false;
        if (lastArgs) {
          callback.apply(this, lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
}

export default useSmoothScroll;
