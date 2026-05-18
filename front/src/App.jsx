import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import LoginPage from './pages/Login/LoginPage'
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
  const [hasLinkedAccount, setHasLinkedAccount] = useState(sessionStorage.getItem('hasLinkedAccount') === 'true')

  const handleLoginSuccess = (role, name, hasLinkedAccount) => {
    sessionStorage.setItem('role',     role)
    sessionStorage.setItem('userName', name)
    sessionStorage.setItem('hasLinkedAccount', String(hasLinkedAccount))
    setRole(role)
    setName(name)
    setHasLinkedAccount(hasLinkedAccount)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('role')
    sessionStorage.removeItem('userName')
    sessionStorage.removeItem('hasLinkedAccount')
    setRole(null)
    setName(null)
    setHasLinkedAccount(false)
  }

  const handleRoleSwitch = async (newRole, newName) => {
    try {
      sessionStorage.setItem('role', newRole)
      sessionStorage.setItem('userName', newName)
      setRole(newRole)
      setName(newName)
      setHasLinkedAccount(true)
    } catch (err) {
      console.error(err.message)
    }
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

        <Route element={<DefaultLayout role={role} name={name} hasLinkedAccount={hasLinkedAccount} onLogout={handleLogout} onRoleSwitch={handleRoleSwitch} />}>
          {/* Admin */}
          <Route path="/admin/my-assets"                 element={!role ? <Navigate to="/login" replace /> : <AdminMyAssetsPage />} />
          <Route path="/admin/my-assets/request"         element={!role ? <Navigate to="/login" replace /> : <AdminRequestPage />} />
          <Route path="/admin/my-assets/assign"          element={!role ? <Navigate to="/login" replace /> : <AdminAssetAssignPage />} />
          <Route path="/admin/my-assets/request-history" element={!role ? <Navigate to="/login" replace /> : <AdminRequestHistoryPage />} />
          <Route path="/admin/my-assets/history"         element={!role ? <Navigate to="/login" replace /> : <AdminAssetHistoryPage />} />
          <Route path="/admin/pc-assets"                 element={!role ? <Navigate to="/login" replace /> : <AdminPcAssetsPage />} />
          <Route path="/admin/sw-assets"                 element={!role ? <Navigate to="/login" replace /> : <AdminSwAssetsPage />} />
          <Route path="/admin/df-assets/dashboard"       element={!role ? <Navigate to="/login" replace /> : <DfDashboardPage    role={role} />} />
          <Route path="/admin/df-assets/list"            element={!role ? <Navigate to="/login" replace /> : <DfAssetsListPage   role={role} />} />
          <Route path="/admin/df-assets/by-project"      element={!role ? <Navigate to="/login" replace /> : <DfAssetsByProjectPage role={role} />} />
          <Route path="/admin/df-assets/register"        element={!role ? <Navigate to="/login" replace /> : <DfAssetsRegisterPage role={role} />} />
          <Route path="/admin/df-assets/history"         element={!role ? <Navigate to="/login" replace /> : <DfAssetsHistoryPage role={role} />} />

          {/* User */}
          <Route path="/user/my-assets"             element={!role ? <Navigate to="/login" replace /> : <UserMyAssetsPage />} />
          <Route path="/user/my-assets/request"     element={!role ? <Navigate to="/login" replace /> : <UserRequestPage />} />
          <Route path="/user/my-assets/history"     element={!role ? <Navigate to="/login" replace /> : <UserRequestHistoryPage />} />
          <Route path="/user/df-assets/dashboard"   element={!role ? <Navigate to="/login" replace /> : <DfDashboardPage    role={role} />} />
          <Route path="/user/df-assets/list"        element={!role ? <Navigate to="/login" replace /> : <DfAssetsListPage   role={role} />} />
          <Route path="/user/df-assets/by-project"  element={!role ? <Navigate to="/login" replace /> : <DfAssetsByProjectPage role={role} />} />
          <Route path="/user/df-assets/register"    element={!role ? <Navigate to="/login" replace /> : <DfAssetsRegisterPage role={role} />} />
          <Route path="/user/df-assets/history"     element={!role ? <Navigate to="/login" replace /> : <DfAssetsHistoryPage role={role} />} />
          <Route path="/user/my-assets/assign"      element={!role ? <Navigate to="/login" replace /> : <UserAssetAssignPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
