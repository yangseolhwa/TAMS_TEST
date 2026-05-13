/**
 * koreanSearch.js
 * 한글 초성 검색 유틸
 *
 * - 초성만 입력 시: 초성 변환 후 비교
 * - 일반 텍스트 입력 시: 원본 비교 → 없으면 초성 비교 (혼합)
 * - 영문/숫자: 대소문자 무시 비교
 */

// ── 초성 목록 (가나다 순) ───────────────────────────────────────────────────
const CHOSUNG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
]

// 한글 유니코드 범위
const HANGUL_START = 0xAC00  // '가'
const HANGUL_END   = 0xD7A3  // '힣'
const JAMO_PER_CHOSUNG = 21 * 28  // 중성 21개 × 종성 28개

/**
 * 문자 하나에서 초성 추출
 * 한글이면 초성 아니면 그대로 반환
 */
const getChosung = (char) => {
  const code = char.charCodeAt(0)
  if (code < HANGUL_START || code > HANGUL_END) return char
  return CHOSUNG_LIST[Math.floor((code - HANGUL_START) / JAMO_PER_CHOSUNG)]
}

/**
 * 문자열 전체 초성 문자열 변환
 * 예: '노트북' → 'ㄴㅌㅂ'
 */
export const toChosung = (str) => {
  if (!str) return ''
  return [...str].map(getChosung).join('')
}

/**
 * 입력값이 초성(자음)만으로 이루어져 있는지 판별
 * 예: 'ㄱㄴ' → true, '가나' → false, 'abc' → false
 */
const JAMO_REGEX = /^[ㄱ-ㅎ]+$/
export const isChosungOnly = (str) => JAMO_REGEX.test(str)

/**
 * 혼합 검색: 텍스트가 keyword를 포함하는지 검사합니다.
 *
 * 동작 순서:
 * 1. 원본 텍스트로 대소문자 무시 비교
 * 2. 실패하면 초성 변환 후 비교
 *
 * @param {string} text    - 검색 대상 텍스트
 * @param {string} keyword - 검색어
 * @returns {boolean}
 */
export const matchesKeyword = (text, keyword) => {
  if (!keyword || text == null) return true
  const normalText    = String(text).toLowerCase()
  const normalKeyword = keyword.toLowerCase()

  // 1. 원본 비교
  if (normalText.includes(normalKeyword)) return true

  // 2. 초성 비교
  const chosungText    = toChosung(normalText)
  const chosungKeyword = toChosung(normalKeyword)
  return chosungText.includes(chosungKeyword)
}

/**
 * 여러 필드 중 하나라도 keyword에 매칭되면 true를 반환합니다.
 *
 * @param {(string|null|undefined)[]} fields - 검색 대상 필드 배열
 * @param {string} keyword                   - 검색어
 * @returns {boolean}
 */
export const matchesAnyField = (fields, keyword) => {
  if (!keyword) return true
  return fields.filter(Boolean).some((field) => matchesKeyword(field, keyword))
}
