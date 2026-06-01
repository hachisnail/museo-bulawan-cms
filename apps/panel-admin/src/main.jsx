import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/authContext.jsx'
import { SSEProvider } from './context/sseContext.jsx'
import App from './App.jsx'
import './index.css'

// --- Umami Analytics ---
// Set VITE_UMAMI_URL and VITE_UMAMI_WEBSITE_ID in your .env to enable tracking.
const umamiUrl = import.meta.env.VITE_UMAMI_URL;
const umamiWebsiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;

if (umamiUrl && umamiWebsiteId) {
    const script = document.createElement('script');
    script.defer = true;
    script.src = `${umamiUrl}/script.js`;
    script.dataset.websiteId = umamiWebsiteId;
    document.head.appendChild(script);
    console.log('[Umami] Loaded for website:', umamiWebsiteId);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SSEProvider>
          <App />
        </SSEProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)