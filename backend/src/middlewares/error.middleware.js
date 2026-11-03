const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;


  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = `Resource not found with id ${err.value}`;
    return res.status(404).json({ success: false, message });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `A record with this ${field} already exists.`;
    return res.status(400).json({ success: false, message });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
    return res.status(400).json({ success: false, message });
  }

  const status = error.statusCode || 500;
  // Only log unexpected errors; the expected 4xx cases above are noise
  if (status >= 500) console.error('[Error Middleware]:', err);
  res.status(status).json({
    success: false,
    ...(err.code && typeof err.code === 'string' ? { code: err.code } : {}),
    // Don't leak internals from unexpected errors
    message: status >= 500 ? 'Internal Server Error' : error.message,
  });
};

module.exports = errorHandler;
