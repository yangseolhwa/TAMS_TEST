const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { User, RefreshToken } = require("../models");
const asyncWrapper = require("../middleware/asyncWrapper");

// 이메일 형식 검증 정규식
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REFRESH_TOKEN_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000; // 7일
const ACCESS_TOKEN_EXPIRATION_MS = 60 * 60 * 1000; // 1시간

// back-mem-login-1
exports.login = asyncWrapper(async (req, res) => {
  const { email } = req.body;
  const trimmedEmail = email?.trim();

  // [back-mem-login-3] 입력값 검증
  if (!trimmedEmail) {
    return res.status(400).json({ message: "이메일을 입력해주세요." });
  }
  if (!EMAIL_REGEX.test(email)) {
    return res
      .status(400)
      .json({ message: "이메일 형식이 올바르지 않습니다." });
  }

  // [back-mem-login-1] DB에서 이메일 존재 여부 확인
  const user = await User.findOne({ where: { email } });
  if (!user) {
    return res.status(401).json({ message: "등록되지 않은 이메일입니다." });
  }

  // [back-mem-login-3] 기존 유효한 Refresh Token 확인
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
    { expiresIn: process.env.JWT_ACCESS_EXPIRES },
  );

  // [back-mem-login-2] Refresh Token 발급 (랜덤 해시, DB 저장)
  const refreshTokenValue = crypto
    .randomBytes(32)
    .toString("hex")
    .padStart(64, "0");
  const hashedToken = crypto
    .createHash("sha256")
    .update(refreshTokenValue)
    .digest("hex");
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
    sameSite: "Strict",
    secure: process.env.NODE_ENV === "production",
  };

  res
    .cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: ACCESS_TOKEN_EXPIRATION_MS,
    })
    .cookie("refreshToken", hashedToken, {
      ...cookieOptions,
      maxAge: REFRESH_TOKEN_EXPIRATION_MS,
    })
    .status(200)
    .json({ message: "로그인 성공", role: user.role });
});

exports.logout = asyncWrapper(async (req, res) => {
  const { refreshToken } = req.cookies;

  if (refreshToken) {
    const tokenRecord = await RefreshToken.findOne({
      where: { token: refreshToken, is_revoked: false },
    });

    if (tokenRecord) {
      tokenRecord.is_revoked = true;
      tokenRecord.updated_at = new Date();
      await tokenRecord.save();
    }
  }

  res
    .clearCookie("accessToken")
    .clearCookie("refreshToken")
    .status(200)
    .json({ message: "로그아웃 되었습니다. " });
});

exports.refresh = asyncWrapper(async (req, res) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return res
      .status(401)
      .json({ message: "리프레시 토큰이 없습니다. 다시 로그인해주세요." });
  }

  // DB에서 RT 조회
  const tokenRecord = await RefreshToken.findOne({
    where: { token: refreshToken },
  });

  // RT 존재 여부 확인
  if (!tokenRecord) {
    return res
      .status(401)
      .json({ message: "유효하지 않은 토큰입니다. 다시 로그인해주세요." });
  }

  // RT 폐기 여부 확인
  if (tokenRecord.is_revoked) {
    return res
      .status(401)
      .json({ message: "만료된 토큰입니다. 다시 로그인해주세요." });
  }

  // RT 만료 시간 확인
  if (new Date() > new Date(tokenRecord.expires_at)) {
    // 만료된 RT는 폐기 처리
    tokenRecord.is_revoked = true;
    tokenRecord.updated_at = new Date();
    await tokenRecord.save();
    return res
      .status(401)
      .json({ message: "토큰이 만료되었습니다. 다시 로그인해주세요." });
  }

  // 새 Access Token 발급
  const { User } = require("../models");
  const user = await User.findByPk(tokenRecord.user_id);

  if (!user) {
    return res.status(401).json({ message: "사용자를 찾을 수 없습니다." });
  }

  const newAccessToken = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES },
  );

  res
    .cookie("accessToken", newAccessToken, {
      httpOnly: true,
      sameSite: "Strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: ACCESS_TOKEN_EXPIRATION_MS,
    })
    .status(200)
    .json({ message: "토큰이 재발급되었습니다." });
});
