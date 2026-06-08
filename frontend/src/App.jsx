import { Navigate, Route, Routes } from 'react-router-dom'
import BillPage from './pages/BillPage/BillPage.jsx'
import CartPage from './pages/CartPage/CartPage.jsx'
import ConfirmPage from './pages/ConfirmPage/ConfirmPage.jsx'
import KitchenPage from './pages/KitchenPage/KitchenPage.jsx'
import MenuPage from './pages/MenuPage/MenuPage.jsx'
import OrderModePage from './pages/OrderModePage/OrderModePage.jsx'
import TrackPage from './pages/TrackPage/TrackPage.jsx'
import WelcomePage from './pages/WelcomePage/WelcomePage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/order" element={<OrderModePage />} />
      <Route path="/menu" element={<MenuPage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/confirm" element={<ConfirmPage />} />
      <Route path="/kitchen" element={<KitchenPage />} />
      <Route path="/track/:orderId" element={<TrackPage />} />
      <Route path="/bill/:orderId" element={<BillPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

