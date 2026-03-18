import { useState } from 'react'
import { login } from '../services/authService'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const validate = (value) => {
  if (!value.trim())             return '이메일을 입력해주세요.'
  if (!EMAIL_REGEX.test(value))  return '유효한 이메일 형식이 아닙니다.'
  return ''
}

/**
 * useLoginForm
 * 이메일 상태, 유효성 검사, UI 로직 담당
 */
const useLoginForm = () => {
  const [email,     setEmail]     = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState('')

  const handleEmailChange = (e) => {
    setEmail(e.target.value)
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const validationError = validate(email)
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setIsLoading(true)

    try {
      const data = await login(email)
      console.log(data);
      // 화면 이동 로직 추가예정
    } catch (err) {
      setError(err.message ?? '로그인에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  return { email, handleEmailChange, isLoading, error, handleSubmit }
}

export default useLoginForm