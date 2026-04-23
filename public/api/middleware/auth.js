/**
 * Authentication Middleware for ThatLuxine
 * Verifies JWT tokens and protects routes
 */

import jwt from 'jsonwebtoken';
import { kv } from '@vercel/kv';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('CRITICAL: JWT_SECRET environment variable is not set!');
}

/**
 * Middleware to verify JWT token and attach user to request
 * Usage: Import and call before your route handler
 */
export async function verifyAuth(req, res, next) {
  try {
    // Get token from cookie or Authorization header
    const token = req.cookies?.accessToken ||
                  req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'NO_TOKEN'
      });
    }

    // Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    // Get user from Vercel KV
    const user = await kv.get(`user:${decoded.userId}`);

    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified
    };

    // Call next middleware or route handler
    if (next) {
      next();
    }

    return true;

  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Middleware to verify admin access
 * Must be used AFTER verifyAuth
 */
export async function verifyAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'NO_AUTH'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required',
      code: 'FORBIDDEN'
    });
  }

  if (next) {
    next();
  }

  return true;
}

/**
 * Helper to parse cookies from request headers
 * Vercel serverless functions don't auto-parse cookies
 */
export function parseCookies(req) {
  const cookies = {};
  const cookieHeader = req.headers.cookie;

  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, ...rest] = cookie.split('=');
      const value = rest.join('=').trim();
      if (name && value) {
        cookies[name.trim()] = decodeURIComponent(value);
      }
    });
  }

  req.cookies = cookies;
  return cookies;
}

/**
 * Helper to set cookie in response
 */
export function setCookie(res, name, value, options = {}) {
  const {
    maxAge = 86400, // 1 day default
    httpOnly = true,
    secure = process.env.NODE_ENV === 'production',
    sameSite = 'Strict',
    path = '/'
  } = options;

  let cookie = `${name}=${encodeURIComponent(value)}`;
  cookie += `; Path=${path}`;
  cookie += `; Max-Age=${maxAge}`;
  cookie += sameSite ? `; SameSite=${sameSite}` : '';
  cookie += httpOnly ? '; HttpOnly' : '';
  cookie += secure ? '; Secure' : '';

  // Append to existing Set-Cookie headers
  const existing = res.getHeader('Set-Cookie') || [];
  const headers = Array.isArray(existing) ? existing : [existing];
  headers.push(cookie);
  res.setHeader('Set-Cookie', headers);
}

/**
 * Helper to clear cookie
 */
export function clearCookie(res, name) {
  setCookie(res, name, '', { maxAge: 0 });
}
