/**
 * openapi:gen — Generates openapi.json from route JSDoc annotations + Zod schemas.
 * Usage: pnpm run openapi:gen
 *
 * Output: backend/openapi.json (importable by frontend for type generation)
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  LoginSchema,
  RefreshSchema,
  LearnerFilterSchema,
  PlacementCreateSchema,
  BotEventSchema,
  DistrictAnalyticsFilterSchema,
} from '../src/schemas/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'SaathiAI Backend API',
    version: '1.0.0',
    description:
      'Stateless REST API for SaathiAI — handles all data operations through Supabase. Frontend should ONLY call these endpoints, never Supabase directly.',
    contact: { name: 'SaathiAI Team' },
  },
  servers: [
    { url: 'http://localhost:4000', description: 'Development' },
    { url: 'https://api.saathai.in', description: 'Production' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token from /auth/login endpoint',
      },
      botSecret: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Bot-Secret',
        description: 'Internal shared secret for bot → backend communication',
      },
    },
    schemas: {
      LoginRequest: zodToJsonSchema(LoginSchema, { name: 'LoginRequest' }),
      RefreshRequest: zodToJsonSchema(RefreshSchema, { name: 'RefreshRequest' }),
      LearnerFilter: zodToJsonSchema(LearnerFilterSchema, { name: 'LearnerFilter' }),
      PlacementCreate: zodToJsonSchema(PlacementCreateSchema, { name: 'PlacementCreate' }),
      BotEvent: zodToJsonSchema(BotEventSchema, { name: 'BotEvent' }),
      DistrictAnalyticsFilter: zodToJsonSchema(DistrictAnalyticsFilterSchema, { name: 'DistrictAnalyticsFilter' }),

      AuthResponse: {
        type: 'object',
        properties: {
          access_token: { type: 'string' },
          refresh_token: { type: 'string' },
          expires_in: { type: 'integer' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              email: { type: 'string', format: 'email', nullable: true },
              phone: { type: 'string', nullable: true },
              role: { type: 'string', enum: ['employer', 'trainee', 'officer', 'dssdo', 'admin'] },
              full_name: { type: 'string', nullable: true },
            },
          },
        },
      },

      Learner: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          phone: { type: 'string' },
          full_name: { type: 'string', nullable: true },
          trade: { type: 'string', nullable: true },
          district: { type: 'string', nullable: true },
          state: { type: 'string', nullable: true },
          cohort: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['active', 'placed', 'dropped', 'at_risk'] },
          risk_score: { type: 'integer', minimum: 0, maximum: 100 },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },

      DashboardStats: {
        type: 'object',
        properties: {
          total_learners: { type: 'integer' },
          active_learners: { type: 'integer' },
          placed_learners: { type: 'integer' },
          at_risk_learners: { type: 'integer' },
          dropped_learners: { type: 'integer' },
          total_jobs: { type: 'integer' },
          active_jobs: { type: 'integer' },
          total_applications: { type: 'integer' },
          total_placements: { type: 'integer' },
          placement_rate: { type: 'integer', description: 'Percentage 0-100' },
        },
      },

      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          issues: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },

  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        tags: ['System'],
        responses: {
          '200': { description: 'Server is up' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Login with email/phone + password',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          '200': { description: 'JWT token pair', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          '401': { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Refresh access token',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshRequest' } } },
        },
        responses: {
          '200': { description: 'New JWT pair', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          '401': { description: 'Invalid refresh token' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Invalidate session',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Logged out' },
          '401': { description: 'Unauthenticated' },
        },
      },
    },
    '/auth/google/callback': {
      post: {
        summary: 'Exchange Google OAuth code for tokens',
        tags: ['Auth'],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { code: { type: 'string' } } } } } },
        responses: { '200': { description: 'JWT pair', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } } },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Get current user profile',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'User payload from JWT' } },
      },
    },
    '/learners': {
      get: {
        summary: 'List learners with filters',
        tags: ['Learners'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'status', schema: { type: 'string', enum: ['active', 'placed', 'dropped', 'at_risk'] } },
          { in: 'query', name: 'cohort', schema: { type: 'string' } },
          { in: 'query', name: 'risk_score_min', schema: { type: 'integer' } },
          { in: 'query', name: 'risk_score_max', schema: { type: 'integer' } },
          { in: 'query', name: 'district', schema: { type: 'string' } },
          { in: 'query', name: 'trade', schema: { type: 'string' } },
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: {
          '200': {
            description: 'Paginated learners',
            content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Learner' } }, total: { type: 'integer' }, page: { type: 'integer' }, totalPages: { type: 'integer' } } } } },
          },
        },
      },
    },
    '/learners/{id}': {
      get: {
        summary: 'Get single learner',
        tags: ['Learners'],
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Learner profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/Learner' } } } },
          '404': { description: 'Not found' },
        },
      },
    },
    '/placements': {
      post: {
        summary: 'Confirm a placement',
        tags: ['Placements'],
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PlacementCreate' } } } },
        responses: { '201': { description: 'Placement confirmed' }, '403': { description: 'Forbidden' } },
      },
    },
    '/dashboard/stats': {
      get: {
        summary: 'Aggregate dashboard stats',
        tags: ['Dashboard'],
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Stats', content: { 'application/json': { schema: { $ref: '#/components/schemas/DashboardStats' } } } } },
      },
    },
    '/dashboard/district/analytics': {
      get: {
        summary: 'District-level analytics',
        tags: ['Dashboard'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'district', schema: { type: 'string' } },
          { in: 'query', name: 'from', schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'to', schema: { type: 'string', format: 'date' } },
        ],
        responses: { '200': { description: 'Analytics array' } },
      },
    },
    '/internal/bot-events': {
      post: {
        summary: 'Receive bot event',
        tags: ['Internal'],
        security: [{ botSecret: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BotEvent' } } } },
        responses: { '201': { description: 'Event recorded' }, '401': { description: 'Invalid bot secret' } },
      },
    },
    '/admin/bot-status': {
      get: {
        summary: 'Bot connection status',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Bot status object with QR if waiting' } },
      },
    },
  },
};

const outPath = join(__dirname, '../openapi.json');
writeFileSync(outPath, JSON.stringify(openapi, null, 2), 'utf-8');
console.log(`✅ OpenAPI spec written to ${outPath}`);
console.log('Run `pnpm run types:gen` to generate TypeScript types for the frontend.');
