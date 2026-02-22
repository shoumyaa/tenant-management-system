const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token)
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select('-password');
    if (!user)
      return res.status(401).json({ success: false, message: 'User not found.' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Admins only.' });
};

const tenantOnly = (req, res, next) => {
  if (req.user && req.user.role === 'tenant') return next();
  return res.status(403).json({ success: false, message: 'Tenants only.' });
};

module.exports = { protect, adminOnly, tenantOnly };
