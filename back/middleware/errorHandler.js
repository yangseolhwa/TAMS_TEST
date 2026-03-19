const errorHandler = (err, req, res, next) => {
  console.error(`${err.message} - ${req.originalUrl} - ${req.method}`);

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "서버 오류가 발생했습니다.",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;
