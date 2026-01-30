import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * Main entry point for the React application.
 * 
 * This initializes the React 18 concurrent rendering mode which is optimal
 * for Three.js animations as it allows React to prioritize and batch updates
 * efficiently during rapid animation loops.
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
