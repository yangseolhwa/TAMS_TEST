import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import LoginPage from './components/Login/LoginPage'
import DefaultLayout from './layouts/DefaultLayout/DefaultLayout'
import AdminMyAssetsPage from './pages/admin/MyAssets/AdminMyAssetsPage'
import AdminRequestPage from './pages/admin/Request/AdminRequestPage'
import AdminRequestHistoryPage from './pages/admin/RequestHistory/AdminRequestHistoryPage'
import AdminAssetHistoryPage from './pages/admin/AssetHistory/AdminAssetHistoryPage'
import AdminPcAssetsPage from './pages/admin/PcAssets/AdminPcAssetsPage'
import AdminSwAssetsPage from './pages/admin/SwAssets/AdminSwAssetsPage'
import AdminAssetAssignPage from './pages/admin/AssetAssign/AdminAssetAssignPage'
import UserMyAssetsPage from './pages/user/MyAssets/UserMyAssetsPage'
import UserRequestPage from './pages/user/Request/UserRequestPage'
import UserRequestHistoryPage from './pages/user/RequestHistory/UserRequestHistoryPage'
import UserAssetAssignPage from './pages/user/AssetAssign/UserAssetAssignPage'
import DfDashboardPage from './pages/df/DfDashboardPage'
import DfAssetsListPage from './pages/df/DfAssetsListPage'
import DfAssetsByProjectPage from './pages/df/DfAssetsByProjectPage'
import DfAssetsRegisterPage from './pages/df/DfAssetsRegisterPage'
import DfAssetsHistoryPage from './pages/df/DfAssetsHistoryPage'

function App() {
  const [role, setRole] = useState(sessionStorage.getItem('role'))
  const [name, setName] = useState(sessionStorage.getItem('userName'))

  const handleLoginSuccess = (role, name) => {
    sessionStorage.setItem('role',     role)
    sessionStorage.setItem('userName', name)
    setRole(role)
    setName(name)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('role')
    sessionStorage.removeItem('userName')
    setRole(null)
    setName(null)
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

        <Route element={<DefaultLayout role={role} name={name} onLogout={handleLogout} />}>
          {/* Admin */}
          <Route path="/admin/my-assets"             element={role === 'admin' ? <AdminMyAssetsPage />         : <Navigate to="/login" replace />} />
          <Route path="/admin/my-assets/request"     element={role === 'admin' ? <AdminRequestPage />          : <Navigate to="/login" replace />} />
          <Route path="/admin/my-assets/assign"      element={role === 'admin' ? <AdminAssetAssignPage />      : <Navigate to="/login" replace />} />
          <Route path="/admin/my-assets/request-history" element={role === 'admin' ? <AdminRequestHistoryPage /> : <Navigate to="/login" replace />} />
          <Route path="/admin/my-assets/history"     element={role === 'admin' ? <AdminAssetHistoryPage />     : <Navigate to="/login" replace />} />
          <Route path="/admin/pc-assets"             element={role === 'admin' ? <AdminPcAssetsPage />         : <Navigate to="/login" replace />} />
          <Route path="/admin/sw-assets"             element={role === 'admin' ? <AdminSwAssetsPage />         : <Navigate to="/login" replace />} />
          <Route path="/admin/df-assets/dashboard"   element={role === 'admin' ? <DfDashboardPage    role={role} /> : <Navigate to="/login" replace />} />
          <Route path="/admin/df-assets/list"        element={role === 'admin' ? <DfAssetsListPage   role={role} /> : <Navigate to="/login" replace />} />
          <Route path="/admin/df-assets/by-project"  element={role === 'admin' ? <DfAssetsByProjectPage role={role} /> : <Navigate to="/login" replace />} />
          <Route path="/admin/df-assets/register"    element={role === 'admin' ? <DfAssetsRegisterPage role={role} /> : <Navigate to="/login" replace />} />
          <Route path="/admin/df-assets/history"     element={role === 'admin' ? <DfAssetsHistoryPage role={role} /> : <Navigate to="/login" replace />} />

          {/* User */}
          <Route path="/user/my-assets"             element={role === 'user' ? <UserMyAssetsPage />         : <Navigate to="/login" replace />} />
          <Route path="/user/my-assets/request"     element={role === 'user' ? <UserRequestPage />          : <Navigate to="/login" replace />} />
          <Route path="/user/my-assets/history"     element={role === 'user' ? <UserRequestHistoryPage />   : <Navigate to="/login" replace />} />
          <Route path="/user/df-assets/dashboard"   element={role === 'user' ? <DfDashboardPage    role={role} /> : <Navigate to="/login" replace />} />
          <Route path="/user/df-assets/list"        element={role === 'user' ? <DfAssetsListPage   role={role} /> : <Navigate to="/login" replace />} />
          <Route path="/user/df-assets/by-project"  element={role === 'user' ? <DfAssetsByProjectPage role={role} /> : <Navigate to="/login" replace />} />
          <Route path="/user/df-assets/register"    element={role === 'user' ? <DfAssetsRegisterPage role={role} /> : <Navigate to="/login" replace />} />
          <Route path="/user/df-assets/history"     element={role === 'user' ? <DfAssetsHistoryPage role={role} /> : <Navigate to="/login" replace />} />
          <Route path="/user/my-assets/assign"      element={role === 'user' ? <UserAssetAssignPage /> : <Navigate to="/login" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App