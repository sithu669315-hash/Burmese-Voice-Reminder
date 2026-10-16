import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker for PWA & Screen-Off Android Notifications
if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('App update available');
    },
    onOfflineReady() {
      console.log('App is ready for offline and screen-off use');
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);
