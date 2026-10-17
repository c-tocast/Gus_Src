import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerGlobalErrorListeners } from './utils/errorTracker';

// Initialize global window error and promise rejection interceptor (Approach 4A)
registerGlobalErrorListeners();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
