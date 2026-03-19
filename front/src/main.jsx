import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Toaster } from 'react-hot-toast'

createRoot(document.getElementById('root')).render(
  <StrictMode>
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
  </StrictMode>,
)
