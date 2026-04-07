import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import LoginPage from './components/Login/LoginPage'
import DefaultLayout from './layouts/DefaultLayout/DefaultLayout'
import AdminMyAssetsPage from './pages/admin/MyAssets/AdminMyAssetsPage'
import AdminDfAssetsPage from './pages/admin/DfAssets/AdminDfAssetsPage'
import AdminRequestPage from './pages/admin/Request/AdminRequestPage'
import AdminRequestHistoryPage from './pages/admin/RequestHistory/AdminRequestHistoryPage'
import AdminAssetHistoryPage from './pages/admin/AssetHistory/AdminAssetHistoryPage'
import AdminPcAssetsPage from './pages/admin/PcAssets/AdminPcAssetsPage'
import AdminSwAssetsPage from './pages/admin/SwAssets/AdminSwAssetsPage'
import UserMyAssetsPage from './pages/user/MyAssets/UserMyAssetsPage'
import UserDfAssetsPage from './pages/user/DfAssets/UserDfAssetsPage'
import UserRequestPage from './pages/user/Request/UserRequestPage'
import UserRequestHistoryPage from './pages/user/RequestHistory/UserRequestHistoryPage'

function App() {
  const [role, setRole] = useState(sessionStorage.getItem('role'))

  const handleLoginSuccess = (role) => {
    sessionStorage.setItem('role', role)
    setRole(role)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('role')
    setRole(null)
  }

  return (
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              role
                ? <Navigate to={`/${role}/my-assets`} replace />
                : <LoginPage onLoginSuccess={handleLoginSuccess} />
            }
          />

          <Route element={<DefaultLayout role={role} onLogout={handleLogout} />}>
            {/* Admin */}
            <Route path="/admin/my-assets" element={role === 'admin' ? <AdminMyAssetsPage /> : <Navigate to="/login" replace />} />
            <Route path="/admin/df-assets/*" element={role === 'admin' ? <AdminDfAssetsPage /> : <Navigate to="/login" replace />} />
            <Route path="/admin/my-assets/request" element={role === 'admin' ? <AdminRequestPage /> : <Navigate to="/login" replace />} />
            <Route path="/admin/my-assets/request-history" element={role === 'admin' ? <AdminRequestHistoryPage /> : <Navigate to="/login" replace />} />
            <Route path="/admin/my-assets/history" element={role === 'admin' ? <AdminAssetHistoryPage /> : <Navigate to="/login" replace />} />
            <Route path="/admin/pc-assets" element={role === 'admin' ? <AdminPcAssetsPage /> : <Navigate to="/login" replace />} />
            <Route path="/admin/sw-assets" element={role === 'admin' ? <AdminSwAssetsPage /> : <Navigate to="/login" replace />} />

            {/* User */}
            <Route path="/user/my-assets"      element={role === 'user' ? <UserMyAssetsPage />      : <Navigate to="/login" replace />} />
            <Route path="/user/df-assets/*"       element={role === 'user' ? <UserDfAssetsPage />       : <Navigate to="/login" replace />} />
            <Route path="/user/my-assets/request" element={role === 'user' ? <UserRequestPage />        : <Navigate to="/login" replace />} />
            <Route path="/user/my-assets/history" element={role === 'user' ? <UserRequestHistoryPage /> : <Navigate to="/login" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
      
  )
}

export default App
