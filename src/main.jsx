import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { SystemSettingsProvider } from './lib/systemSettings';
import './styles.css';
import './season-interactions.css';
import './responsive-polish.css';
import './password-recovery.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SystemSettingsProvider>
        <App />
      </SystemSettingsProvider>
    </BrowserRouter>
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/balqees-sw.js').catch(() => {}));
}
