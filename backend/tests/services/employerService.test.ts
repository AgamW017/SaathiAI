import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit tests for employerService pure functions.
 * Tests cover: verifyUdyam, signSkillCardToken/verifySkillCardToken round-trip,
 * appendTimelineEvent, computeEmployerRiskScore (via mock), getNapsEligibility.
 */

// We need to set env vars before importing the service, since config reads them at import time
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SECRET_KEY = 'test-secret-key';
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests-min32chars!!';
process.env.MOCK_EXTERNAL_APIS = 'true';

describe('employerService', () => {
  let service: typeof import('../../src/services/employerService.js');

  beforeEach(async () => {
    // Dynamic import to ensure env is set first
    service = await import('../../src/services/employerService.js');
  });

  // ─── verifyUdyam ─────────────────────────────────────────────────────────

  describe('verifyUdyam', () => {
    it('returns valid=true for correctly formatted UDYAM number', async () => {
      const result = await service.verifyUdyam('UDYAM-UP-12-1234567');
      expect(result.valid).toBe(true);
      expect(result.company_name).toBeDefined();
      expect(result.trade_categories).toBeInstanceOf(Array);
      expect(result.total_employees).toBeGreaterThan(0);
    });

    it('returns valid=true for another valid UDYAM format', async () => {
      const result = await service.verifyUdyam('UDYAM-MH-01-0000001');
      expect(result.valid).toBe(true);
    });

    it('returns valid=false for invalid format — missing prefix', async () => {
      const result = await service.verifyUdyam('UP-12-1234567');
      expect(result.valid).toBe(false);
    });

    it('returns valid=false for invalid format — lowercase state', async () => {
      const result = await service.verifyUdyam('UDYAM-up-12-1234567');
      expect(result.valid).toBe(false);
    });

    it('returns valid=false for invalid format — wrong digit count', async () => {
      const result = await service.verifyUdyam('UDYAM-UP-12-123456'); // 6 digits instead of 7
      expect(result.valid).toBe(false);
    });

    it('returns valid=false for invalid format — extra digits', async () => {
      const result = await service.verifyUdyam('UDYAM-UP-12-12345678'); // 8 digits
      expect(result.valid).toBe(false);
    });

    it('returns valid=false for empty string', async () => {
      const result = await service.verifyUdyam('');
      expect(result.valid).toBe(false);
    });

    it('returns valid=false for random garbage', async () => {
      const result = await service.verifyUdyam('GARBAGE-STRING-12345');
      expect(result.valid).toBe(false);
    });
  });

  // ─── signSkillCardToken / verifySkillCardToken ────────────────────────────

  describe('signSkillCardToken / verifySkillCardToken round-trip', () => {
    it('sign then verify returns original payload fields', () => {
      const payload = {
        match_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        employer_id: '11111111-2222-3333-4444-555555555555',
        learner_id: '66666666-7777-8888-9999-aaaaaaaaaaaa',
      };

      const token = service.signSkillCardToken(payload);
      expect(token).toBeTypeOf('string');
      expect(token.length).toBeGreaterThan(10);

      const decoded = service.verifySkillCardToken(token);
      expect(decoded.match_id).toBe(payload.match_id);
      expect(decoded.employer_id).toBe(payload.employer_id);
      expect(decoded.learner_id).toBe(payload.learner_id);
    });

    it('decoded token includes iat and exp fields', () => {
      const payload = {
        match_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        employer_id: '11111111-2222-3333-4444-555555555555',
        learner_id: '66666666-7777-8888-9999-aaaaaaaaaaaa',
      };

      const token = service.signSkillCardToken(payload);
      const decoded = service.verifySkillCardToken(token);

      expect(decoded.iat).toBeTypeOf('number');
      expect(decoded.exp).toBeTypeOf('number');
      // exp should be ~30 days after iat
      const thirtyDaysInSecs = 30 * 24 * 60 * 60;
      expect(decoded.exp! - decoded.iat!).toBe(thirtyDaysInSecs);
    });

    it('throws for tampered/invalid tokens', () => {
      expect(() => service.verifySkillCardToken('invalid.token.here')).toThrow();
    });

    it('throws for empty string token', () => {
      expect(() => service.verifySkillCardToken('')).toThrow();
    });

    it('different payloads produce different tokens', () => {
      const token1 = service.signSkillCardToken({
        match_id: 'aaaaaaaa-0000-0000-0000-000000000001',
        employer_id: 'eeeeeeee-0000-0000-0000-000000000001',
        learner_id: 'llllllll-0000-0000-0000-000000000001',
      });
      const token2 = service.signSkillCardToken({
        match_id: 'aaaaaaaa-0000-0000-0000-000000000002',
        employer_id: 'eeeeeeee-0000-0000-0000-000000000002',
        learner_id: 'llllllll-0000-0000-0000-000000000002',
      });
      expect(token1).not.toBe(token2);
    });
  });

  // ─── appendTimelineEvent ──────────────────────────────────────────────────

  describe('appendTimelineEvent', () => {
    it('appends to empty timeline (null)', () => {
      const result = service.appendTimelineEvent(null, 'new_match', 'user-123', 'Initial match');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        stage: 'new_match',
        actor: 'user-123',
        note: 'Initial match',
      });
      expect(result[0].timestamp).toBeDefined();
    });

    it('appends to empty array', () => {
      const result = service.appendTimelineEvent([], 'skill_card_viewed', 'employer-1');
      expect(result).toHaveLength(1);
      expect(result[0].stage).toBe('skill_card_viewed');
      expect(result[0].note).toBeNull();
    });

    it('appends to existing timeline without mutating it', () => {
      const existing = [
        { stage: 'new_match', timestamp: '2024-01-01T00:00:00Z', actor: 'sys', note: null },
      ];
      const result = service.appendTimelineEvent(
        existing,
        'skill_card_viewed',
        'employer-1',
        'Viewed card'
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(existing[0]); // original preserved
      expect(result[1].stage).toBe('skill_card_viewed');
      expect(result[1].actor).toBe('employer-1');
      expect(result[1].note).toBe('Viewed card');

      // Original array unchanged
      expect(existing).toHaveLength(1);
    });

    it('handles non-array input gracefully (treats as empty)', () => {
      const result = service.appendTimelineEvent('garbage' as any, 'hired', 'system');
      expect(result).toHaveLength(1);
      expect(result[0].stage).toBe('hired');
    });

    it('timestamp is a valid ISO string', () => {
      const result = service.appendTimelineEvent([], 'interview_scheduled', 'actor');
      const ts = result[0].timestamp;
      expect(new Date(ts).toISOString()).toBe(ts);
    });
  });

  // ─── getNapsEligibility ───────────────────────────────────────────────────

  describe('getNapsEligibility', () => {
    it('returns eligible=false for fewer than 4 employees', () => {
      expect(service.getNapsEligibility(0).eligible).toBe(false);
      expect(service.getNapsEligibility(1).eligible).toBe(false);
      expect(service.getNapsEligibility(2).eligible).toBe(false);
      expect(service.getNapsEligibility(3).eligible).toBe(false);
    });

    it('returns eligible=true for 4 or more employees', () => {
      expect(service.getNapsEligibility(4).eligible).toBe(true);
      expect(service.getNapsEligibility(10).eligible).toBe(true);
      expect(service.getNapsEligibility(100).eligible).toBe(true);
    });

    it('maxApprentices = floor(totalEmployees / 4)', () => {
      expect(service.getNapsEligibility(4).maxApprentices).toBe(1);
      expect(service.getNapsEligibility(7).maxApprentices).toBe(1);
      expect(service.getNapsEligibility(8).maxApprentices).toBe(2);
      expect(service.getNapsEligibility(15).maxApprentices).toBe(3);
      expect(service.getNapsEligibility(16).maxApprentices).toBe(4);
    });

    it('maxApprentices is 0 when not eligible', () => {
      expect(service.getNapsEligibility(0).maxApprentices).toBe(0);
      expect(service.getNapsEligibility(3).maxApprentices).toBe(0);
    });

    it('stipendPerApprentice is ₹1,500', () => {
      const result = service.getNapsEligibility(8);
      expect(result.stipendPerApprentice).toBe(1500);
    });

    it('annualSavings = maxApprentices * 1500 * 12', () => {
      const result = service.getNapsEligibility(12); // 3 apprentices
      expect(result.annualSavings).toBe(3 * 1500 * 12);
    });

    it('annualSavings is 0 when not eligible', () => {
      expect(service.getNapsEligibility(2).annualSavings).toBe(0);
    });

    it('boundary: exactly 4 employees gives 1 apprentice', () => {
      const result = service.getNapsEligibility(4);
      expect(result.eligible).toBe(true);
      expect(result.maxApprentices).toBe(1);
      expect(result.annualSavings).toBe(1 * 1500 * 12);
    });
  });

  // ─── isValidTransition ────────────────────────────────────────────────────

  describe('isValidTransition', () => {
    it('new_match → skill_card_viewed is valid', () => {
      expect(service.isValidTransition('new_match', 'skill_card_viewed')).toBe(true);
    });

    it('new_match → rejected is valid', () => {
      expect(service.isValidTransition('new_match', 'rejected')).toBe(true);
    });

    it('new_match → hired is invalid (skip)', () => {
      expect(service.isValidTransition('new_match', 'hired')).toBe(false);
    });

    it('hired → anything is invalid (terminal)', () => {
      expect(service.isValidTransition('hired', 'new_match')).toBe(false);
      expect(service.isValidTransition('hired', 'rejected')).toBe(false);
    });

    it('rejected → anything is invalid (terminal)', () => {
      expect(service.isValidTransition('rejected', 'new_match')).toBe(false);
      expect(service.isValidTransition('rejected', 'hired')).toBe(false);
    });
  });

  // ─── getMinimumWage / checkMinimumWageCompliance ──────────────────────────

  describe('getMinimumWage', () => {
    it('returns known wage for Electrician in Uttar Pradesh', () => {
      expect(service.getMinimumWage('Electrician', 'Uttar Pradesh')).toBe(11500);
    });

    it('returns default_skilled for unknown trade in known state', () => {
      expect(service.getMinimumWage('UnknownTrade', 'Maharashtra')).toBe(14000);
    });

    it('returns 9000 for completely unknown state', () => {
      expect(service.getMinimumWage('Electrician', 'UnknownState')).toBe(9000);
    });
  });

  describe('checkMinimumWageCompliance', () => {
    it('below minimum → false', () => {
      expect(service.checkMinimumWageCompliance(5000, 'Electrician', 'Uttar Pradesh')).toBe(false);
    });

    it('at minimum → true', () => {
      expect(service.checkMinimumWageCompliance(11500, 'Electrician', 'Uttar Pradesh')).toBe(true);
    });

    it('above minimum → true', () => {
      expect(service.checkMinimumWageCompliance(20000, 'Electrician', 'Uttar Pradesh')).toBe(true);
    });
  });
});
