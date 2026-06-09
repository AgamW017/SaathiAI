import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { LoginSchema, RefreshSchema } from '../schemas/index.js';
import {
  loginWithEmailPassword,
  refreshAccessToken,
  revokeSession,
  loginWithGoogleCode,
} from '../services/authService.js';
import { authenticate } from '../middleware/auth.js';

export const authRouter = Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Login with email/phone + password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: JWT token pair
 *       401:
 *         description: Invalid credentials
 */
authRouter.post('/login', validateBody(LoginSchema), async (req, res) => {
  const { email, phone, password } = req.body;
  const result = await loginWithEmailPassword(email, phone, password);
  res.json(result);
});

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 */
authRouter.post('/refresh', validateBody(RefreshSchema), async (req, res) => {
  const result = await refreshAccessToken(req.body.refresh_token);
  res.json(result);
});

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Invalidate session
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 */
authRouter.post('/logout', authenticate, async (req, res) => {
  await revokeSession(req.user!.sub);
  res.json({ message: 'Logged out successfully' });
});

/**
 * @openapi
 * /auth/google/callback:
 *   post:
 *     summary: Exchange Google OAuth code for tokens
 *     tags: [Auth]
 */
authRouter.post('/google/callback', async (req, res) => {
  const { code } = req.body as { code: string };
  if (!code) {
    res.status(400).json({ error: 'Missing OAuth code' });
    return;
  }
  const result = await loginWithGoogleCode(code);
  res.json(result);
});

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 */
authRouter.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});
