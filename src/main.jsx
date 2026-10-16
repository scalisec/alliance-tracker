import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './splash.js';
import './install.js'; // start listening for the install prompt right away

createRoot(document.getElementById('root')).render(<App />);


if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
