import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { OrderSessionProvider } from './context/OrderSessionContext.jsx'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <OrderSessionProvider>
        <App />
      </OrderSessionProvider>
    </BrowserRouter>
  </React.StrictMode>
)

