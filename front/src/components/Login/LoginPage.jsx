import { useState } from 'react'
import clsx from 'clsx'
import Logo from '../Logo/Logo'
import useLoginForm from '../../hooks/useLoginForm'
import bgImg from '../../assets/background.png'
import styles from './LoginPage.module.css'

const EmailIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M2.5 5.833A1.667 1.667 0 0 1 4.167 4.167h11.666A1.667 1.667 0 0 1 17.5 5.833v8.334A1.667 1.667 0 0 1 15.833 15.833H4.167A1.667 1.667 0 0 1 2.5 14.167V5.833Z"
      stroke="currentColor" strokeWidth="1.4"
    />
    <path
      d="M2.5 6.667l7.5 5 7.5-5"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
    />
  </svg>
)

const ErrorIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
)

const ArrowIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4.167 10h11.666M10.833 5l5 5-5 5"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
    />
  </svg>
)

const LoginPage = () => {
  const { email, handleEmailChange, isLoading, error, handleSubmit } = useLoginForm()
  const [inputFocused, setInputFocused] = useState(false)

  return (
    <div className={styles.page}>
      {/* 배경 이미지 — Vite가 빌드 시 경로를 안전하게 처리 */}
      <div
        className={styles.bg}
        style={{ backgroundImage: `url(${bgImg})` }}
        aria-hidden="true"
      />
      <div className={styles.overlay} aria-hidden="true" />

      <main className={styles.container}>
        <div className={styles.card}>
          <Logo />

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            {/* 입력 그룹 */}
            <div
              className={clsx(
                styles.inputGroup,
                inputFocused && styles.inputGroupFocused,
                error        && styles.inputGroupError,
              )}
            >
              <span className={styles.inputIcon} aria-hidden="true">
                <EmailIcon />
              </span>
              <input
                id="email"
                type="email"
                className={styles.input}
                placeholder="이메일을 입력하세요"
                value={email}
                onChange={handleEmailChange}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                autoComplete="email"
                required
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>

            {/* 에러 메시지 */}
            {error && (
              <p className={styles.errorMsg} id="login-error" role="alert">
                <ErrorIcon />
                {error}
              </p>
            )}

            {/* 제출 버튼 */}
            <button
              type="submit"
              className={styles.btn}
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <span className={styles.spinner} aria-hidden="true" />
              ) : (
                <span className={styles.btnText}>
                  로그인
                  <span className={styles.btnArrow}><ArrowIcon /></span>
                </span>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

export default LoginPage