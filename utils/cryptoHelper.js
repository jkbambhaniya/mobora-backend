const crypto = require('crypto');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_please_change_in_production';

// Derive a cryptographically strong 32-byte key for AES-256
const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.COOKIE_ENCRYPTION_KEY || JWT_SECRET,
  'mobora_salt_salt', // static salt for derivation
  32
);

/**
 * Hashes cookie key names deterministically so that the client browser
 * updates the same cookie correctly instead of accumulating cookies.
 * @param {string} originalKey
 * @returns {string}
 */
function getObfuscatedKey(originalKey) {
  return 'mb_' + crypto.createHash('sha256').update(originalKey).digest('hex').substring(0, 12);
}

/**
 * Encrypts a plaintext string (like JWT or JSON) using AES-256-GCM.
 * Returns formatted string: iv:authTag:encryptedContent
 * @param {string} text
 * @returns {string}
 */
function encryptValue(text) {
  const iv = crypto.randomBytes(12); // GCM standard IV size is 12 bytes
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string back to plaintext.
 * Throws error if payload is tampered with or key is invalid.
 * @param {string} encryptedText
 * @returns {string}
 */
function decryptValue(encryptedText) {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted session string.');
  }

  const [ivHex, authTagHex, encryptedData] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Sets auth cookies (session_token, refresh_token, vendor_profile) on the response object.
 * @param {object} res - Express response object
 * @param {string} token - Access token JWT
 * @param {string} refreshToken - Refresh token JWT
 * @param {object} vendor - Vendor details object
 */
function setAuthCookies(res, token, refreshToken, vendor) {
  const tokenCookieKey = getObfuscatedKey('session_token');
  const refreshCookieKey = getObfuscatedKey('refresh_token');
  const vendorCookieKey = getObfuscatedKey('vendor_profile');

  const encryptedToken = encryptValue(token);
  const encryptedRefreshToken = encryptValue(refreshToken);
  
  const vendorDetails = {
    id: vendor.id,
    name: vendor.name,
    email: vendor.email,
    status: vendor.status
  };
  const encryptedVendor = encryptValue(JSON.stringify(vendorDetails));

  const accessMaxAge = 15 * 60 * 1000; // 15 mins
  const refreshMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

  const commonOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  };

  res.cookie(tokenCookieKey, encryptedToken, {
    ...commonOptions,
    maxAge: accessMaxAge
  });

  res.cookie(refreshCookieKey, encryptedRefreshToken, {
    ...commonOptions,
    maxAge: refreshMaxAge
  });

  res.cookie(vendorCookieKey, encryptedVendor, {
    ...commonOptions,
    maxAge: refreshMaxAge
  });
}

/**
 * Sets only the access token cookie on the response object (e.g., during refresh).
 * @param {object} res - Express response object
 * @param {string} token - Access token JWT
 */
function setAccessTokenCookie(res, token) {
  const tokenCookieKey = getObfuscatedKey('session_token');
  const encryptedToken = encryptValue(token);

  res.cookie(tokenCookieKey, encryptedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000 // 15 mins
  });
}

/**
 * Clears all auth cookies on the response object.
 * @param {object} res - Express response object
 */
function clearAuthCookies(res) {
  const tokenCookieKey = getObfuscatedKey('session_token');
  const refreshCookieKey = getObfuscatedKey('refresh_token');
  const vendorCookieKey = getObfuscatedKey('vendor_profile');

  const commonOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  };

  res.clearCookie(tokenCookieKey, commonOptions);
  res.clearCookie(refreshCookieKey, commonOptions);
  res.clearCookie(vendorCookieKey, commonOptions);
}

module.exports = {
  getObfuscatedKey,
  encryptValue,
  decryptValue,
  setAuthCookies,
  setAccessTokenCookie,
  clearAuthCookies
};
