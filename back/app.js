require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const sequelize = require("./config/db");
const logger = require("./config/logger");
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/authRoutes");
const assetRoutes = require('./routes/assetRoutes');

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(morgan('combined', { stream: logger.stream }));

app.use("/api/auth", authRoutes);
app.use("/api/assets", assetRoutes);
app.use(errorHandler);

sequelize.authenticate()
  .then(() => {
    logger.info('MariaDB 연결 성공');
    return sequelize.sync({ force: false });
  })
  .then(async () => {
    app.listen(process.env.PORT, () => {
      logger.info(`서버 실행 중: http://localhost:${process.env.PORT}`);
    });
  })
  .catch((err) => {
    logger.error('DB 연결 실패', err);
    process.exit(1);
  });