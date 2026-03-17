const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_USER,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'production' ? false : console.log, // 개발 중일 떄만 사용
    timezone: '+09:00'
  }
);

module.exports = sequelize;