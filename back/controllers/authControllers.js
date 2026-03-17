const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, RefreshToken } = require('../models');

// 이메일 형식 검증 정규식
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REFRESH_TOKEN_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000; // 7일
const ACCESS_TOKEN_EXPIRATION_MS = 60 * 60 * 1000; // 1시간

// back-mem-login-1
exports.login = async (req, res) => {
  try{
    const { email } = req.body;

    // [back-mem-login-3] 입력값 검증
    if (!email) {
      return res.status(400).json({ message: '이메일을 입력해주세요.' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: '이메일 형식이 올바르지 않습니다.' });
    }

    // [back-mem-login-1] DB에서 이메일 존재 여부 확인
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: '등록되지 않은 이메일입니다.' });
    }

    // [back-mem-login-3] 기존 유효한 Refresh Token 확인 (중복 로그인 방지 or 재발급)
    const existingToken = await RefreshToken.findOne({
      where: { user_id: user.id, is_revoked: false },
    });
    if (existingToken) {
      // 기존 토큰 폐기
      existingToken.is_revoked = true;
      await existingToken.save();
    }

    // [back-mem-login-2] Access Token 발급
    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES }
    );

    // [back-mem-login-2] Refresh Token 발급 (랜덤 해시, DB 저장)
    const refreshTokenValue = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(refreshTokenValue).digest('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRATION_MS);

    await RefreshToken.create({
      user_id: user.id,
      token: hashedToken,
      expires_at: expiresAt,
      is_revoked: false,
    });

    // [back-mem-login-2] Set-Cookie로 응답 (httpOnly)
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'Strict',
      secure: process.env.NODE_ENV === 'production',
    };

    res
      .cookie('accessToken', accessToken, {
        ...cookieOptions,
        maxAge: ACCESS_TOKEN_EXPIRATION_MS,
      })
      .cookie('refreshToken', refreshTokenValue, {
        ...cookieOptions,
        maxAge: REFRESH_TOKEN_EXPIRATION_MS,
      })
      .status(200)
      .json({ message: '로그인 성공', role: user.role });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({
      message: '서버 오류가 발생했습니다.'
    });
  }
};
