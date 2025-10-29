import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/logger.js';

export interface AccessTokenPayload {
  userId: string;
  employeeId: string;
  fullName: string;
  role: 'OPERATOR' | 'ADMIN';
  operatorId: string | null;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  type: 'refresh';
}

export interface DecodedAccessToken extends AccessTokenPayload {
  iat: number;
  exp: number;
}

export interface DecodedRefreshToken extends RefreshTokenPayload {
  iat: number;
  exp: number;
}

export interface RefreshTokenData {
  token: string;
  tokenId: string;
  expiresAt: Date;
  expiresIn: number;
}

export function generateAccessToken(
  payload: AccessTokenPayload,
  secret: string,
  expiresIn: string = '15m'
): string {
  try {
    return jwt.sign(payload as object, secret, {
      expiresIn,
      algorithm: 'HS256',
    } as jwt.SignOptions);
  } catch (error) {
    logger.error('Failed to generate access token', error as Error);
    throw new Error('Failed to generate access token');
  }
}

export function generateRefreshToken(
  userId: string,
  secret: string,
  expiresIn: string = '7d'
): RefreshTokenData {
  try {
    const tokenId = uuidv4();
    const payload: RefreshTokenPayload = {
      userId,
      tokenId,
      type: 'refresh',
    };

    const token = jwt.sign(payload as object, secret, {
      expiresIn,
      algorithm: 'HS256',
    } as jwt.SignOptions);

    // Calculate expiration date and seconds
    const expiresInSeconds = parseExpirationToSeconds(expiresIn);
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    return {
      token,
      tokenId,
      expiresAt,
      expiresIn: expiresInSeconds,
    };
  } catch (error) {
    logger.error('Failed to generate refresh token', error as Error);
    throw new Error('Failed to generate refresh token');
  }
}

export function verifyAccessToken(token: string, secret: string): DecodedAccessToken {
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    }) as DecodedAccessToken;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Access token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid access token');
    }
    logger.error('Failed to verify access token', error as Error);
    throw new Error('Token verification failed');
  }
}

export function verifyAccessTokenFromQuery(
  token: string | undefined,
  secret: string,
  allowedRoles: Array<'OPERATOR' | 'ADMIN'> = ['OPERATOR', 'ADMIN']
): DecodedAccessToken {
  if (!token) {
    throw new Error('Missing access token in query parameter');
  }

  const decoded = verifyAccessToken(token, secret);

  // Check if role is allowed
  if (!allowedRoles.includes(decoded.role)) {
    throw new Error(`Access denied: role ${decoded.role} not allowed`);
  }

  return decoded;
}

export function verifyRefreshToken(token: string, secret: string): DecodedRefreshToken {
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    }) as DecodedRefreshToken;

    // Verify it's a refresh token
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    logger.error('Failed to verify refresh token', error as Error);
    throw new Error('Token verification failed');
  }
}

export function decodeToken(token: string): jwt.JwtPayload | string | null {
  try {
    const decoded = jwt.decode(token);
    return decoded || null;
  } catch (error) {
    logger.error('Failed to decode token', error as Error);
    return null;
  }
}

function parseExpirationToSeconds(expiration: string): number {
  const match = expiration.match(/^(\d+)([smhd])$/);
  if (!match || !match[1] || !match[2]) {
    throw new Error('Invalid expiration format');
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 24 * 60 * 60;
    default:
      throw new Error('Invalid expiration unit');
  }
}
