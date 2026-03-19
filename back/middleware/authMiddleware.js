const jwt = require('jsonwebtoken');

exports.verifyAccessToken = (req, res, next) => {
  const token = req.cookies?.accessToken;

  if (!token) {
    return res.status(401).json({ message: '인증 토큰이 없습니다.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = decoded; // { userId, role }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: '토큰이 만료되었습니다. 다시 로그인해주세요.' });
    }
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }
};