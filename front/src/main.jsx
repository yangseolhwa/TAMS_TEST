import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'  // 추가

const queryClient = new QueryClient()  // 추가

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>  {/* 추가 */}
      <App />
      <Toaster 
        position="top-right"
        containerStyle={{ top: 55 }}
        toastOptions={{
          error: {
            icon: false,
            style: {
              fontSize: '14px',
              fontFamily: 'inherit',
              minWidth: '400px',
            },
          },
        }} />
    </QueryClientProvider>  {/* 추가 */}
  </StrictMode>,
)
