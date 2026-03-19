import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import LoginPage from './components/Login/LoginPage'
import DefaultLayout from './layouts/DefaultLayout/DefaultLayout'

function App() {
  const [role, setRole] =  useState(sessionStorage.getItem('role'))

  const handleLoginSuccess = (role) => {
    sessionStorage.setItem('role', role)  // ← 추가
    setRole(role)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('role')  // ← 추가
    setRole(null)
  }
  
  return (
    <BrowserRouter>
      <Routes>
        {/* 로그인 */}
        <Route
          path="/login"
          element={
            role
              ? <Navigate to={`/${role}/my-assets`} replace />
              : <LoginPage onLoginSuccess={handleLoginSuccess} />
          }
        />

        {/* 메인 */}
        <Route
          path="/:role/*"
          element={
            role
              ? <DefaultLayout role={role} onLogout={handleLogout}>
                  <p>레이아웃 확인용</p>
                </DefaultLayout>
              : <Navigate to="/login" replace />
          }
        />

        {/* 기본 리다이렉트 */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App