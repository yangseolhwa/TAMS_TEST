import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'
import { Toaster } from 'react-hot-toast'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,  // 5분
    },
  },
})

createRoot(document.getElementById('root')).render(
  // <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        containerStyle={{ top: 55 }}
        toastOptions={{
          error: {
            style: {
              fontSize: '14px',
              fontFamily: 'inherit',
              // minWidth: '400px',
            },
          },
        }}
      />
    </QueryClientProvider>
  // </StrictMode>,
)