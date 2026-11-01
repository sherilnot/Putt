// Minimal fixed-window, per-IP rate limiter (in-memory; fine for a single instance).
const rateLimit = ({ windowMs, max }) => {
  const hits = new Map();

  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next();

    const now = Date.now();
    const key = req.ip;
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({
        success: false,
        message: 'Too many attempts. Please try again later.',
      });
    }
    next();
  };
};

module.exports = { rateLimit };
