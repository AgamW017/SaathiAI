import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

/**
 * Integration tests for the employer tRPC router.
 *
 * These tests exercise actual tRPC procedures with a mocked Supabase client
 * to catch bugs that unit tests miss:
 * - Missing DB grants (42501 privilege errors)
 * - Missing FK rows (23503 constraint violations)
 * - Wrong response shapes (frontend reads data.id but backend wraps differently)
 */

// ─── Environment setup (must be before imports) ─────────────────────────────

process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SECRET_KEY = 'test-secret-key';
process.env.JWT_SECRET = 'test-jwt-secret-for-integration-tests-min32chars!!';
process.env.MOCK_EXTERNAL_APIS = 'true';
process.env.BOT_INTERNAL_URL = 'http://localhost:3001';

// ─── Hoisted mock state (accessible inside vi.mock factory) ─────────────────

interface MockQueryState {
  table: string;
  operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  filters: Record<string, unknown>;
  selectColumns?: string;
  countMode?: boolean;
  headMode?: boolean;
}

const mockState = vi.hoisted(() => {
  let dbOperations: MockQueryState[] = [];
  let mockDataStore: Record<string, {
    data?: unknown;
    error?: { message: string; code?: string; details?: string } | null;
    count?: number | null;
  }> = {};

  function getMockResponse(state: MockQueryState) {
    const specific = mockDataStore[`${state.table}:${state.operation}`];
    if (specific) return specific;
    return mockDataStore[state.table] ?? { data: null, error: null, count: 0 };
  }

  function createChainableMock(state: MockQueryState): any {
    const chain: any = {};
    const filterMethods = ['eq','neq','gt','gte','lt','lte','like','ilike','in','is','or'];
    for (const method of filterMethods) {
      chain[method] = (...args: unknown[]) => {
        state.filters[`${method}:${args[0]}`] = args[1] ?? args[0];
        return chain;
      };
    }
    chain.order = () => chain;
    chain.range = () => chain;
    chain.limit = () => chain;
    chain.select = (columns?: string, opts?: any) => {
      state.selectColumns = columns;
      if (opts?.count) state.countMode = true;
      if (opts?.head) state.headMode = true;
      return chain;
    };
    chain.single = () => {
      dbOperations.push({ ...state });
      return Promise.resolve(getMockResponse(state));
    };
    chain.maybeSingle = () => chain.single();
    chain.then = (resolve: Function, reject?: Function) => {
      dbOperations.push({ ...state });
      return Promise.resolve(getMockResponse(state)).then(resolve as any, reject as any);
    };
    return chain;
  }

  const mockSupabase = {
    from: (table: string) => {
      const makeChain = (operation: MockQueryState['operation']) => {
        const state: MockQueryState = { table, operation, filters: {} };
        return createChainableMock(state);
      };
      return {
        select: (columns?: string, opts?: any) => {
          const state: MockQueryState = { table, operation: 'select', filters: {} };
          state.selectColumns = columns;
          if (opts?.count) state.countMode = true;
          if (opts?.head) state.headMode = true;
          return createChainableMock(state);
        },
        insert: (_data: unknown) => makeChain('insert'),
        update: (_data: unknown) => makeChain('update'),
        upsert: (_data: unknown, _opts?: unknown) => makeChain('upsert'),
        delete: () => makeChain('delete'),
      };
    },
    channel: (_name: string) => ({
      send: (_payload: unknown) => Promise.resolve(),
    }),
  };

  return {
    get dbOperations() { return dbOperations; },
    get mockDataStore() { return mockDataStore; },
    mockSupabase,
    reset() {
      dbOperations = [];
      mockDataStore = {};
    },
    mockTable(table: string, operation: string, response: any) {
      mockDataStore[`${table}:${operation}`] = response;
    },
    mockTableDefault(table: string, response: any) {
      mockDataStore[table] = response;
    },
  };
});

// ─── Module Mocks ───────────────────────────────────────────────────────────

vi.mock('../../src/db/client.js', () => ({
  supabase: mockState.mockSupabase,
  supabaseAdmin: {},
}));

// Mock fetch for bot internal API calls
const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
vi.stubGlobal('fetch', mockFetch);

// ─── tRPC Caller Setup ──────────────────────────────────────────────────────

import { appRouter } from '../../src/trpc/router.js';
import type { Context } from '../../src/trpc/context.js';

function createTestContext(overrides: Partial<Context> = {}): Context {
  return {
    user: {
      sub: 'test-employer-id-uuid-001',
      role: 'employer',
      email: 'employer@test.com',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    } as any,
    ...overrides,
  };
}

function createCaller(ctx?: Context) {
  return appRouter.createCaller(ctx ?? createTestContext());
}

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const EMPLOYER_ID = 'test-employer-id-uuid-001';

const MOCK_VACANCY = {
  id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  employer_id: EMPLOYER_ID,
  title: 'Junior Electrician',
  trade_required: 'Electrician',
  salary_min: 12000,
  salary_max: 18000,
  status: 'draft',
  shift_type: 'day',
  naps_eligible: false,
  openings: 1,
  minimum_wage_compliant: true,
  state: 'Uttar Pradesh',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const LEARNER_ID = 'aabbccdd-1111-2222-3333-444455556666';

const MOCK_MATCH = {
  id: '11111111-2222-3333-4444-555555555555',
  vacancy_id: MOCK_VACANCY.id,
  learner_id: LEARNER_ID,
  employer_id: EMPLOYER_ID,
  stage: 'new_match',
  timeline: [],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const MOCK_LEARNER = {
  id: LEARNER_ID,
  phone: '+919876543210',
  full_name: 'Ravi Kumar',
  trade: 'Electrician',
  district: 'Lucknow',
  state: 'Uttar Pradesh',
  status: 'active',
  risk_score: 3,
};

const MOCK_EMPLOYER_PROFILE = {
  id: EMPLOYER_ID,
  company_name: 'Test Corp',
  state: 'Uttar Pradesh',
  district: 'Lucknow',
  total_employees: 10,
  trade_categories: ['Electrician', 'Fitter'],
  verification_status: 'phone_verified',
  employer_risk_score: 2,
  naps_registered: false,
  naps_registration_ref: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// ─── Test Suites ────────────────────────────────────────────────────────────

describe('Employer Router Integration Tests', () => {
  beforeEach(() => {
    mockState.reset();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. VACANCY CREATE FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  describe('employer.vacancies.create', () => {
    it('returns correct response shape: { vacancy, minimum_wage_warning }', async () => {
      mockState.mockTable('employers', 'select', { data: { state: 'Uttar Pradesh' }, error: null });
      mockState.mockTable('vacancies', 'insert', { data: { ...MOCK_VACANCY }, error: null });

      const caller = createCaller();
      const result = await caller.employer.vacancies.create({
        title: 'Junior Electrician',
        trade_required: 'Electrician',
        salary_min: 12000,
        salary_max: 18000,
      });

      // Verify response shape — the frontend expects this exact structure
      expect(result).toHaveProperty('vacancy');
      expect(result).toHaveProperty('minimum_wage_warning');
      expect(result.vacancy).toHaveProperty('id');
      expect(result.vacancy).toHaveProperty('title');
      expect(result.vacancy).toHaveProperty('employer_id');
    });

    it('vacancy.id is a UUID in the response', async () => {
      mockState.mockTable('employers', 'select', { data: { state: 'Uttar Pradesh' }, error: null });
      mockState.mockTable('vacancies', 'insert', { data: { ...MOCK_VACANCY }, error: null });

      const caller = createCaller();
      const result = await caller.employer.vacancies.create({
        title: 'Junior Electrician',
        trade_required: 'Electrician',
        salary_min: 12000,
        salary_max: 18000,
      });

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(result.vacancy.id).toMatch(uuidRegex);
    });

    it('auto-creates employer profile when it does not exist (no FK violation)', async () => {
      mockState.mockTable('employers', 'select', {
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });
      mockState.mockTable('users', 'select', { data: { full_name: 'Test User' }, error: null });
      mockState.mockTable('employers', 'upsert', { data: { state: null }, error: null });
      mockState.mockTable('vacancies', 'insert', { data: { ...MOCK_VACANCY, status: 'draft' }, error: null });

      const caller = createCaller();
      const result = await caller.employer.vacancies.create({
        title: 'Junior Electrician',
        trade_required: 'Electrician',
        salary_min: 12000,
        salary_max: 18000,
      });

      // Should NOT throw — auto-creates profile
      expect(result.vacancy).toBeDefined();
      expect(result.vacancy.status).toBe('draft');
    });

    it('flags vacancy when salary is below minimum wage', async () => {
      const flaggedVacancy = { ...MOCK_VACANCY, status: 'flagged', minimum_wage_compliant: false };
      mockState.mockTable('employers', 'select', { data: { state: 'Uttar Pradesh' }, error: null });
      mockState.mockTable('vacancies', 'insert', { data: flaggedVacancy, error: null });

      const caller = createCaller();
      const result = await caller.employer.vacancies.create({
        title: 'Junior Electrician',
        trade_required: 'Electrician',
        salary_min: 5000, // Below UP min wage of 11500
        salary_max: 8000,
      });

      expect(result.minimum_wage_warning).not.toBeNull();
      expect(result.minimum_wage_warning!.flagged).toBe(true);
      expect(result.minimum_wage_warning!.minimum_wage).toBe(11500);
      expect(result.vacancy.status).toBe('flagged');
    });

    it('sets status draft when salary is compliant (no flagging)', async () => {
      mockState.mockTable('employers', 'select', { data: { state: 'Uttar Pradesh' }, error: null });
      mockState.mockTable('vacancies', 'insert', { data: { ...MOCK_VACANCY, status: 'draft' }, error: null });

      const caller = createCaller();
      const result = await caller.employer.vacancies.create({
        title: 'Junior Electrician',
        trade_required: 'Electrician',
        salary_min: 15000,
        salary_max: 20000,
      });

      expect(result.minimum_wage_warning).toBeNull();
      expect(result.vacancy.status).toBe('draft');
    });

    it('throws on privilege error (missing GRANT on vacancies)', async () => {
      mockState.mockTable('employers', 'select', { data: { state: 'Uttar Pradesh' }, error: null });
      mockState.mockTable('vacancies', 'insert', {
        data: null,
        error: { message: 'permission denied for table vacancies', code: '42501' },
      });

      const caller = createCaller();
      await expect(caller.employer.vacancies.create({
        title: 'Junior Electrician',
        trade_required: 'Electrician',
        salary_min: 12000,
        salary_max: 18000,
      })).rejects.toThrow(TRPCError);
    });

    it('throws on FK violation (employer_id not in employers table)', async () => {
      mockState.mockTable('employers', 'select', { data: { state: 'Uttar Pradesh' }, error: null });
      mockState.mockTable('vacancies', 'insert', {
        data: null,
        error: {
          message: 'insert or update on table "vacancies" violates foreign key constraint',
          code: '23503',
          details: 'Key (employer_id)=(test-employer-id-uuid-001) is not present in table "employers"',
        },
      });

      const caller = createCaller();
      await expect(caller.employer.vacancies.create({
        title: 'Junior Electrician',
        trade_required: 'Electrician',
        salary_min: 12000,
        salary_max: 18000,
      })).rejects.toThrow(TRPCError);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. BROADCAST FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  describe('employer.vacancies.broadcast', () => {
    it('returns { count: number, broadcast_at: string }', async () => {
      mockState.mockTable('vacancies', 'select', { data: { id: MOCK_VACANCY.id, title: 'Junior Electrician' }, error: null });
      mockState.mockTable('matches', 'select', { data: [], error: null });
      mockState.mockTableDefault('learners', { data: [MOCK_LEARNER], error: null });
      mockState.mockTable('matches', 'upsert', { data: null, error: null });

      const caller = createCaller();
      const result = await caller.employer.vacancies.broadcast({
        vacancy_id: MOCK_VACANCY.id,
        filters: { trade: 'Electrician' },
      });

      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('broadcast_at');
      expect(typeof result.count).toBe('number');
      expect(result.count).toBe(1);
      expect(new Date(result.broadcast_at).toISOString()).toBe(result.broadcast_at);
    });

    it('returns count 0 with no match records when no learners match', async () => {
      mockState.mockTable('vacancies', 'select', { data: { id: MOCK_VACANCY.id, title: 'Junior Electrician' }, error: null });
      mockState.mockTable('matches', 'select', { data: [], error: null });
      mockState.mockTableDefault('learners', { data: [], error: null });

      const caller = createCaller();
      const result = await caller.employer.vacancies.broadcast({
        vacancy_id: MOCK_VACANCY.id,
        filters: { trade: 'NonExistentTrade' },
      });

      expect(result.count).toBe(0);
      expect(result.broadcast_at).toBeDefined();
      // Verify no upsert was attempted (zero learners = skip insert)
      const matchUpserts = mockState.dbOperations.filter(
        (op: MockQueryState) => op.table === 'matches' && op.operation === 'upsert'
      );
      expect(matchUpserts).toHaveLength(0);
    });

    it('enforces rate limit of 5 broadcasts per day', async () => {
      mockState.mockTable('vacancies', 'select', { data: { id: MOCK_VACANCY.id, title: 'Junior Electrician' }, error: null });
      // 5 distinct vacancy IDs already broadcast today
      mockState.mockTable('matches', 'select', {
        data: [
          { vacancy_id: 'v1' }, { vacancy_id: 'v2' }, { vacancy_id: 'v3' },
          { vacancy_id: 'v4' }, { vacancy_id: 'v5' },
        ],
        error: null,
      });

      const caller = createCaller();
      await expect(caller.employer.vacancies.broadcast({
        vacancy_id: 'aaaaaaaa-bbbb-cccc-dddd-ffffffffffff',
        filters: {},
      })).rejects.toThrow(/Daily broadcast limit/);
    });

    it('throws NOT_FOUND when vacancy does not belong to employer', async () => {
      mockState.mockTable('vacancies', 'select', {
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });

      const caller = createCaller();
      await expect(caller.employer.vacancies.broadcast({
        vacancy_id: 'f47ac10b-58cc-4372-a567-000000000000',
        filters: {},
      })).rejects.toThrow(/Vacancy not found/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. PREVIEW TARGET COUNT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('employer.vacancies.previewTargetCount', () => {
    it('returns { count: number }', async () => {
      mockState.mockTableDefault('learners', { data: null, error: null, count: 42 });

      const caller = createCaller();
      const result = await caller.employer.vacancies.previewTargetCount({ trade: 'Electrician' });

      expect(result).toEqual({ count: 42 });
    });

    it('handles partial filters — only trade', async () => {
      mockState.mockTableDefault('learners', { data: null, error: null, count: 15 });

      const caller = createCaller();
      const result = await caller.employer.vacancies.previewTargetCount({ trade: 'Fitter' });

      expect(result.count).toBe(15);
    });

    it('handles partial filters — only district', async () => {
      mockState.mockTableDefault('learners', { data: null, error: null, count: 8 });

      const caller = createCaller();
      const result = await caller.employer.vacancies.previewTargetCount({ district: 'Lucknow' });

      expect(result.count).toBe(8);
    });

    it('returns 0 for empty filters when no active learners', async () => {
      mockState.mockTableDefault('learners', { data: null, error: null, count: 0 });

      const caller = createCaller();
      const result = await caller.employer.vacancies.previewTargetCount({});

      expect(result.count).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. PIPELINE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('employer.pipeline', () => {
    describe('list', () => {
      it('returns array of matches with nested learners and vacancies', async () => {
        const matchWithRelations = {
          ...MOCK_MATCH,
          learners: { id: LEARNER_ID, full_name: 'Ravi Kumar', phone: '+91987', trade: 'Electrician', district: 'Lucknow', risk_score: 3 },
          vacancies: { id: MOCK_VACANCY.id, title: 'Junior Electrician', trade_required: 'Electrician' },
        };
        mockState.mockTable('matches', 'select', { data: [matchWithRelations], error: null });

        const caller = createCaller();
        const result = await caller.employer.pipeline.list({});

        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('learners');
        expect(result[0]).toHaveProperty('vacancies');
        expect(result[0].learners.full_name).toBe('Ravi Kumar');
      });

      it('returns empty array when no matches exist', async () => {
        mockState.mockTable('matches', 'select', { data: [], error: null });

        const caller = createCaller();
        const result = await caller.employer.pipeline.list({});

        expect(result).toEqual([]);
      });
    });

    describe('transition', () => {
      it('validates state machine — rejects invalid transition', async () => {
        mockState.mockTable('matches', 'select', { data: { ...MOCK_MATCH, stage: 'new_match', timeline: [] }, error: null });

        const caller = createCaller();
        await expect(caller.employer.pipeline.transition({
          match_id: MOCK_MATCH.id,
          to_stage: 'hired',
        })).rejects.toThrow(/Cannot transition/);
      });

      it('allows valid transition new_match → skill_card_viewed', async () => {
        mockState.mockTable('matches', 'select', { data: { ...MOCK_MATCH, stage: 'new_match', timeline: [] }, error: null });
        mockState.mockTable('matches', 'update', { data: { ...MOCK_MATCH, stage: 'skill_card_viewed' }, error: null });

        const caller = createCaller();
        const result = await caller.employer.pipeline.transition({
          match_id: MOCK_MATCH.id,
          to_stage: 'skill_card_viewed',
        });

        expect(result.stage).toBe('skill_card_viewed');
      });

      it('throws NOT_FOUND when match does not belong to employer', async () => {
        mockState.mockTable('matches', 'select', {
          data: null,
          error: { message: 'Row not found', code: 'PGRST116' },
        });

        const caller = createCaller();
        await expect(caller.employer.pipeline.transition({
          match_id: '00000000-0000-0000-0000-000000000000',
          to_stage: 'skill_card_viewed',
        })).rejects.toThrow(/Match not found/);
      });
    });

    describe('getCandidateDetail', () => {
      it('returns match with nested learner (with skill_cards) and vacancy', async () => {
        const detailedMatch = {
          ...MOCK_MATCH,
          learners: {
            ...MOCK_LEARNER,
            skill_cards: [{ trade: 'Electrician', skills: ['Wiring', 'Safety'], verification_status: 'verified' }],
          },
          vacancies: {
            id: MOCK_VACANCY.id, title: 'Junior Electrician',
            trade_required: 'Electrician', salary_min: 12000, salary_max: 18000, district: 'Lucknow',
          },
        };
        mockState.mockTable('matches', 'select', { data: detailedMatch, error: null });

        const caller = createCaller();
        const result = await caller.employer.pipeline.getCandidateDetail({ match_id: MOCK_MATCH.id });

        expect(result).toHaveProperty('learners');
        expect(result).toHaveProperty('vacancies');
        expect(result.learners.skill_cards).toHaveLength(1);
        expect(result.vacancies.title).toBe('Junior Electrician');
      });

      it('throws NOT_FOUND when match does not exist', async () => {
        mockState.mockTable('matches', 'select', {
          data: null,
          error: { message: 'Row not found', code: 'PGRST116' },
        });

        const caller = createCaller();
        await expect(caller.employer.pipeline.getCandidateDetail({
          match_id: '00000000-0000-0000-0000-000000000000',
        })).rejects.toThrow(/Match not found/);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. PROFILE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('employer.profile', () => {
    describe('get', () => {
      it('returns employer data when profile exists', async () => {
        mockState.mockTable('employers', 'select', { data: MOCK_EMPLOYER_PROFILE, error: null });

        const caller = createCaller();
        const result = await caller.employer.profile.get();

        expect(result).not.toBeNull();
        expect(result!.company_name).toBe('Test Corp');
        expect(result!.state).toBe('Uttar Pradesh');
      });

      it('returns null (not throw) when profile does not exist', async () => {
        mockState.mockTable('employers', 'select', {
          data: null,
          error: { message: 'Row not found', code: 'PGRST116' },
        });

        const caller = createCaller();
        const result = await caller.employer.profile.get();

        expect(result).toBeNull();
      });
    });

    describe('upsert', () => {
      it('creates or updates employer row and returns data', async () => {
        const upsertedProfile = { ...MOCK_EMPLOYER_PROFILE, company_name: 'New Corp' };
        mockState.mockTable('employers', 'upsert', { data: upsertedProfile, error: null });

        const caller = createCaller();
        const result = await caller.employer.profile.upsert({
          company_name: 'New Corp',
          state: 'Uttar Pradesh',
          district: 'Lucknow',
        });

        expect(result.company_name).toBe('New Corp');
      });

      it('verifies Udyam number and sets udyam_verified status', async () => {
        const verifiedProfile = {
          ...MOCK_EMPLOYER_PROFILE,
          verification_status: 'udyam_verified',
          udyam_number: 'UDYAM-UP-12-1234567',
        };
        mockState.mockTable('employers', 'upsert', { data: verifiedProfile, error: null });

        const caller = createCaller();
        const result = await caller.employer.profile.upsert({
          company_name: 'Verified Corp',
          udyam_number: 'UDYAM-UP-12-1234567',
        });

        expect(result.verification_status).toBe('udyam_verified');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. MESSAGING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('employer.messaging', () => {
    describe('getThread', () => {
      it('returns messages ordered ascending by created_at', async () => {
        const messages = [
          { id: 'msg-1', sender_id: EMPLOYER_ID, receiver_learner_id: LEARNER_ID, direction: 'to_learner', content: 'Hi', source: 'dashboard', status: 'sent', reply_to_id: null, created_at: '2024-01-01T10:00:00Z' },
          { id: 'msg-2', sender_id: LEARNER_ID, receiver_learner_id: LEARNER_ID, direction: 'from_learner', content: 'Hello', source: 'bot', status: 'delivered', reply_to_id: 'msg-1', created_at: '2024-01-01T10:05:00Z' },
        ];
        mockState.mockTable('messages', 'select', { data: messages, error: null });

        const caller = createCaller();
        const result = await caller.employer.messaging.getThread({ learnerId: LEARNER_ID });

        expect(result).toHaveProperty('messages');
        expect(result).toHaveProperty('learnerId');
        expect(result.messages).toHaveLength(2);
        expect(new Date(result.messages[0].created_at).getTime())
          .toBeLessThan(new Date(result.messages[1].created_at).getTime());
      });

      it('returns empty array when no messages exist', async () => {
        mockState.mockTable('messages', 'select', { data: [], error: null });

        const caller = createCaller();
        const result = await caller.employer.messaging.getThread({ learnerId: LEARNER_ID });

        expect(result.messages).toEqual([]);
      });
    });

    describe('sendPing', () => {
      it('validates learner is in pipeline (FORBIDDEN if not)', async () => {
        mockState.mockTable('learners', 'select', { data: MOCK_LEARNER, error: null });
        mockState.mockTable('matches', 'select', {
          data: null,
          error: { message: 'Row not found', code: 'PGRST116' },
        });

        const caller = createCaller();
        await expect(caller.employer.messaging.sendPing({
          learnerId: LEARNER_ID,
          message: 'Hello!',
        })).rejects.toThrow(/only message learners in your pipeline/);
      });

      it('enforces rate limit (20 pings per learner per day)', async () => {
        mockState.mockTable('learners', 'select', { data: MOCK_LEARNER, error: null });
        mockState.mockTable('matches', 'select', { data: { id: 'match-1' }, error: null });
        mockState.mockTable('messages', 'select', { data: null, error: null, count: 20 });

        const caller = createCaller();
        await expect(caller.employer.messaging.sendPing({
          learnerId: LEARNER_ID,
          message: 'Hello!',
        })).rejects.toThrow(/Daily message limit/);
      });

      it('rejects messages exceeding 1000 character limit (Zod validation)', async () => {
        const caller = createCaller();
        const longMessage = 'x'.repeat(1001);

        await expect(caller.employer.messaging.sendPing({
          learnerId: LEARNER_ID,
          message: longMessage,
        })).rejects.toThrow();
      });

      it('successfully sends ping and calls bot API', async () => {
        mockState.mockTable('learners', 'select', { data: MOCK_LEARNER, error: null });
        mockState.mockTable('matches', 'select', { data: { id: 'match-1' }, error: null });
        mockState.mockTable('messages', 'select', { data: null, error: null, count: 5 });
        mockState.mockTable('messages', 'insert', { data: { id: 'new-msg-id', created_at: '2024-06-01T12:00:00Z' }, error: null });

        const caller = createCaller();
        const result = await caller.employer.messaging.sendPing({
          learnerId: LEARNER_ID,
          message: 'Are you interested?',
        });

        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('messageId');
        expect(result).toHaveProperty('createdAt');
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/internal/send-ping'),
          expect.objectContaining({ method: 'POST' })
        );
      });

      it('throws NOT_FOUND when learner does not exist', async () => {
        mockState.mockTable('learners', 'select', {
          data: null,
          error: { message: 'Row not found', code: 'PGRST116' },
        });

        const caller = createCaller();
        await expect(caller.employer.messaging.sendPing({
          learnerId: 'f47ac10b-58cc-4372-a567-000000000000',
          message: 'Hello!',
        })).rejects.toThrow(/Learner not found/);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. AUTH GUARDS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('auth guards', () => {
    it('rejects unauthenticated users', async () => {
      const caller = appRouter.createCaller({ user: null });
      await expect(caller.employer.profile.get()).rejects.toThrow(/Authentication required/);
    });

    it('rejects non-employer roles (officer)', async () => {
      const ctx = createTestContext({
        user: { sub: 'officer-id', role: 'officer', email: 'o@test.com', iat: 0, exp: 9999999999 } as any,
      });
      const caller = appRouter.createCaller(ctx);
      await expect(caller.employer.profile.get()).rejects.toThrow(/Employer access required/);
    });
  });
});
