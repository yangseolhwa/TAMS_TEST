const User = require('./User');
const RefreshToken = require('./refresh_tokens');

// 관계 설정
User.hasMany(RefreshToken, { foreignKey: 'user_id' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id' });

module.exports = { User, RefreshToken };
