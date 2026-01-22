import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Import DB test utilities (available in console as window.HeyPhomTests)
import './db/test'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
