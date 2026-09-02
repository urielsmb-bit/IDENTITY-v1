import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

// Styles — imported in layer order matching the original project
import './styles/base.css';
import './styles/chrome.css';
import './styles/themes.css';
import './styles/fuentes.css';
import './styles/profile.css';
import './styles/panels.css';
import './styles/dashboard.css';
import './styles/cuenta.css';
import './styles/guia.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
