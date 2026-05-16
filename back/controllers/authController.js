const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Op } = require("sequelize");
const { User, RefreshToken, Profile, Department } = require("../models");
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
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return res
      .status(400)
      .json({ message: "이메일 형식이 올바르지 않습니다." });
  }

  // [back-mem-login-1] DB에서 이메일 존재 여부 확인
  const user = await User.findOne({ 
    where: { email: trimmedEmail } ,
    include: [
      {
        model: Profile,
        as: 'profile',
        attributes: ['name'],
      }
    ]
  });
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
  const refreshTokenValue = crypto.randomBytes(32).toString("hex");
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
    .cookie("refreshToken", refreshTokenValue, {
      ...cookieOptions,
      maxAge: REFRESH_TOKEN_EXPIRATION_MS,
    })
    .status(200)
    .json({ name: user.profile?.name ?? null, email: user.email, role: user.role, message: "로그인 성공" });
});

exports.logout = asyncWrapper(async (req, res) => {
  const { refreshToken } = req.cookies;

  if (refreshToken) {
    const hashedToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");
    const tokenRecord = await RefreshToken.findOne({
      where: { token: hashedToken, is_revoked: false },
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
    .json({ message: "로그아웃 되었습니다." });
});

exports.refresh = asyncWrapper(async (req, res) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return res
      .status(401)
      .json({ message: "리프레시 토큰이 없습니다. 다시 로그인해주세요." });
  }

  // DB에서 RT 조회
  const hashedToken = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
  const tokenRecord = await RefreshToken.findOne({
    where: { token: hashedToken },
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

// ─────────────────────────────────────────
// 전체 유저 조회 (admin 전용)
// GET /api/auth/users
// query: keyword (이름 또는 이메일 검색)
// ─────────────────────────────────────────
exports.getUsers = asyncWrapper(async (req, res) => {
  const { role } = req.user;
  if (role !== 'admin') return res.status(403).json({ message: '관리자만 접근할 수 있습니다.' });

  const { keyword } = req.query;

  const userWhere = {};
  if (keyword) {
    userWhere[Op.or] = [
      { email: { [Op.like]: `%${keyword}%` } },
      { '$profile.name$': { [Op.like]: `%${keyword}%` } },
    ];
  }

  const users = await User.findAll({
    where: userWhere,
    attributes: ['id', 'email', 'role'],
    include: [
      {
        model: Profile,
        as: 'profile',
        attributes: ['name', 'company_rank', 'department_id'],
        include: [
          {
            model: Department,
            as: 'department',
            attributes: ['id', 'name'],
          },
        ],
      },
    ],
    order: [
      [{ model: Profile, as: 'profile' }, 'name', 'ASC'],
    ],
  });

  const result = users.map(u => ({
    id:           u.id,
    email:        u.email,
    role:         u.role,
    name:         u.profile?.name         ?? null,
    company_rank: u.profile?.company_rank ?? null,
    department:   u.profile?.department?.name ?? null,
  }));

  res.status(200).json({ total: result.length, users: result });
});

// ─────────────────────────────────────────
// 계정 전환 (admin ↔ user)
// POST /api/auth/switch-role
// ─────────────────────────────────────────
exports.switchRole = asyncWrapper(async (req, res) => {
  const { userId } = req.user;
  const { refreshToken } = req.cookies;

  const currentUser = await User.findByPk(userId, {
    include: [{ model: Profile, as: 'profile', attributes: ['name'] }],
  });
  if (!currentUser) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

  if (!currentUser.linked_user_id) {
    return res.status(403).json({ message: '연결된 계정이 없습니다. 관리자에게 문의하세요.' });
  }

  const targetUser = await User.findByPk(currentUser.linked_user_id, {
    include: [{ model: Profile, as: 'profile', attributes: ['name'] }],
  });
  if (!targetUser) {
    return res.status(404).json({ message: '연결된 계정을 찾을 수 없습니다.' });
  }

  // 양방향 연결 검증
  if (targetUser.linked_user_id !== userId) {
    return res.status(403).json({ message: '양방향으로 연결되지 않은 계정입니다.' });
  }

  // RT 폐기 + 새 RT 저장을 트랜잭션으로 묶음
  const newRefreshValue = await sequelize.transaction(async (t) => {
    // 기존 RT 폐기
    if (refreshToken) {
      const hashedOld = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const oldToken  = await RefreshToken.findOne({
        where: { token: hashedOld, is_revoked: false },
        transaction: t,
      });
      if (oldToken) {
        oldToken.is_revoked = true;
        await oldToken.save({ transaction: t });
      }
    }

    // 새 RT 발급 및 DB 저장
    const value     = crypto.randomBytes(32).toString('hex');
    const hashedNew = crypto.createHash('sha256').update(value).digest('hex');
    await RefreshToken.create({
      user_id:    targetUser.id,
      token:      hashedNew,
      expires_at: new Date(Date.now() + REFRESH_TOKEN_EXPIRATION_MS),
      is_revoked: false,
    }, { transaction: t });

    return value;
  });

  // AT는 DB 불필요하므로 트랜잭션 밖에서 발급
  const newAccessToken = jwt.sign(
    { userId: targetUser.id, role: targetUser.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES },
  );

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'Strict',
    secure:   process.env.NODE_ENV === 'production',
  };

  const roleLabel = targetUser.role === 'admin' ? '관리자' : '일반 사용자';

  res
    .cookie('accessToken',  newAccessToken,  { ...cookieOptions, maxAge: ACCESS_TOKEN_EXPIRATION_MS })
    .cookie('refreshToken', newRefreshValue, { ...cookieOptions, maxAge: REFRESH_TOKEN_EXPIRATION_MS })
    .status(200)
    .json({
      name:    targetUser.profile?.name ?? null,
      email:   targetUser.email,
      role:    targetUser.role,
      message: `${roleLabel} 계정으로 전환되었습니다.`,
    });
});