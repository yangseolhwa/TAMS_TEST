require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const sequelize = require('./config/db');
const User = require('./models/User');

const authRoutes = require('./routes/authRoutes');

const app = express();

app.use(express.json());
app.use(cookieParser());

// 라우트
app.use('/api/auth', authRoutes);

// DB 연결
sequelize.authenticate()
  .then(() => {
    console.log('MariaDB 연결 성공');
    return sequelize.sync({ alter: false });
  })
  .then(() => {
    app.listen(process.env.PORT, () => {
      console.log(`서버 실행 중: http://localhost:${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.error('DB 연결 실패:', err);
    process.exit(1);
  });

