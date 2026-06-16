const jwt = require('jsonwebtoken');
const { getObfuscatedKey, decryptValue } = require('../utils/cryptoHelper');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_please_change_in_production';

/**
 * Middleware to verify a JSON Web Token (JWT) in the cookie or Authorization header.
 * Checks encrypted cookie first, falls back to Bearer header.
 */
function authenticateToken(req, res, next) {
  let token = null;

  // 1. Try to fetch from encrypted cookie
  const obfuscatedCookieKey = getObfuscatedKey('session_token');
  const encryptedCookieVal = req.cookies[obfuscatedCookieKey];

  console.log('[Auth Middleware] Path:', req.path, 'Method:', req.method);
  console.log('[Auth Middleware] Cookie keys:', Object.keys(req.cookies));

  if (encryptedCookieVal) {
    try {
      token = decryptValue(encryptedCookieVal);
      console.log('[Auth Middleware] Successfully decrypted session token');
    } catch (err) {
      console.warn('[Auth Middleware] Failed to decrypt session cookie:', err.message);
      // Allow fallback to standard Authorization header
    }
  }

  // 2. Fallback to Authorization Header
  if (!token) {
    const authHeader = req.headers['authorization'];
    token = authHeader && authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access Denied: Authentication token missing or session expired.' 
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Attach credentials (id, email, role) to req
    next();
  } catch (error) {
    return res.status(403).json({ 
      success: false, 
      message: 'Forbidden: Invalid or expired token.' 
    });
  }
}

/**
 * Role verification middleware guard.
 * Blocks access if the authenticated user's role does not match the required role.
 * @param {string} role - The required role (e.g. 'vendor', 'admin', 'user')
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized: User is not authenticated.' 
      });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ 
        success: false, 
        message: `Forbidden: Requires "${role}" role permission.` 
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole
};
