import { useState } from 'react'
import LoginPage from './components/Login/LoginPage'
import DefaultLayout from './layouts/DefaultLayout/DefaultLayout'

function App() {
  const [role, setRole] = useState(null)  // null이면 로그인 화면

  if (!role) {
    return <LoginPage onLoginSuccess={setRole} />
  }

  return (
    <DefaultLayout role={role}>
      <p>레이아웃 확인용</p>
    </DefaultLayout>
  )
}

export default App