import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../trpc.js';
import {
  loginWithEmailPassword,
  refreshAccessToken,
  revokeSession,
  signupUser,
} from '../../services/authService.js';
import {
  generateAadhaarOtp,
  verifyAadhaarOtp,
  initEntityLockerSession,
  getEntityDetails,
} from '../../services/sandboxService.js';

// ─── Schemas ──────────────────────────────────────────────────────────────────

/**
 * Sign-in input: role-agnostic — caller passes identifier (email or phone) + password.
 * The server looks up the user and validates the role matches.
 */
const SigninInput = z.object({
  identifier: z.string().min(5, 'Email or phone required'),
  password: z.string().min(1, 'Password required'),
  role: z.enum(['learner', 'employer', 'officer', 'dssdo', 'admin']),
});

/**
 * Signup is role-specific. We use a discriminated union so each role collects
 * only the fields it needs.
 *
 * Roles → allowed login methods:
 *   learner   → phone only
 *   employer  → email (phone optional)
 *   officer   → email only
 *   dssdo     → email only
 *   admin     → email only
 */
const SignupInput = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('learner'),
    phone: z.string().regex(/^\+?[0-9]{10,13}$/, 'Valid phone required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    full_name: z.string().min(2, 'Name required'),
  }),
  z.object({
    role: z.literal('employer'),
    email: z.string().email('Valid email required').optional(),
    phone: z.string().regex(/^\+?[0-9]{10,13}$/).optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    company_name: z.string().min(2, 'Company name required'),
    contact_name: z.string().min(2, 'Contact name required'),
    udyam: z
      .string()
      .regex(/^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/, 'Invalid Udyam format')
      .optional(),
    verification_type: z.enum(['none', 'aadhaar', 'entitylocker']).default('none'),
    aadhaar_kyc: z.object({
      aadhaarNumber: z.string(),
      name: z.string(),
      dob: z.string(),
      gender: z.string(),
      address: z.object({
        line: z.string().nullable(),
        district: z.string().nullable(),
        state: z.string().nullable(),
        pincode: z.union([z.string(), z.number()]).transform(v => v !== null ? String(v) : null).nullable(),
      }),
      photoUrl: z.string().optional(),
    }).optional(),
    entity_data: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      mobile: z.string(),
      dateOfIncorporation: z.string(),
      verifiedBy: z.enum(['pan', 'ud', 'cin']),
    }).optional(),
  }),
  z.object({
    role: z.literal('officer'),
    email: z.string().email('Valid email required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    full_name: z.string().min(2, 'Name required'),
    iti_name: z.string().optional(),
    district: z.string().optional(),
  }),
  z.object({
    role: z.literal('dssdo'),
    email: z.string().email('Valid email required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    full_name: z.string().min(2, 'Name required'),
    district: z.string().optional(),
  }),
  z.object({
    role: z.literal('admin'),
    email: z.string().email('Valid email required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    full_name: z.string().min(2, 'Name required'),
  }),
]);

// ─── Router ───────────────────────────────────────────────────────────────────

export const authRouter = router({
  /**
   * Sign in — accepts email OR phone + password.
   * Role is used to determine which identifier field to use:
   *   learner → phone
   *   others  → email (employer may also use phone)
   */
  signin: publicProcedure.input(SigninInput).mutation(async ({ input }) => {
    const { identifier, password, role } = input;

    // Determine if identifier is a phone number or email
    const isPhone = /^\+?[0-9]{10,13}$/.test(identifier);

    if (role === 'learner' && !isPhone) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Job seekers must log in with their phone number',
      });
    }
    if ((role === 'officer' || role === 'dssdo' || role === 'admin') && isPhone) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Trainers and DSDO officers must log in with their email',
      });
    }

    const email = isPhone ? undefined : identifier;
    const phone = isPhone ? identifier : undefined;

    try {
      const result = await loginWithEmailPassword(email, phone, password);
      // Validate the role in DB matches what was selected
      if (result.user.role !== role) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `This account is registered as "${result.user.role}", not "${role}"`,
        });
      }
      return result;
    } catch (err: any) {
      if (err instanceof TRPCError) throw err;
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: err.message ?? 'Invalid credentials',
      });
    }
  }),

  /**
   * Sign up — role-specific input, creates Supabase user + DB profile.
   * Only employer signup is surfaced on the frontend currently.
   */
  signup: publicProcedure.input(SignupInput).mutation(async ({ input }) => {
    try {
      return await signupUser(input);
    } catch (err: any) {
      if (err instanceof TRPCError) throw err;
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: err.message ?? 'Signup failed',
      });
    }
  }),

  /** Refresh an expired access token using a valid refresh token */
  refresh: publicProcedure
    .input(z.object({ refresh_token: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        return await refreshAccessToken(input.refresh_token);
      } catch (err: any) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' });
      }
    }),

  /** Sign out — invalidates the Supabase session */
  signout: protectedProcedure.mutation(async ({ ctx }) => {
    await revokeSession(ctx.user.sub);
    return { success: true };
  }),

  /** Get the current authenticated user's profile */
  me: protectedProcedure.query(({ ctx }) => {
    return { user: ctx.user };
  }),

  // ─── Employer Aadhaar KYC ─────────────────────────────────────────────────

  /** Generate Aadhaar OTP for employer signup */
  employerAadhaarOtp: publicProcedure
    .input(z.object({ aadhaarNumber: z.string().regex(/^\d{12}$/, 'Must be exactly 12 digits') }))
    .mutation(async ({ input }) => {
      try {
        return await generateAadhaarOtp(input.aadhaarNumber);
      } catch (err: any) {
        throw new TRPCError({ code: 'BAD_GATEWAY', message: err.message ?? 'OTP generation failed' });
      }
    }),

  /** Verify Aadhaar OTP and return KYC data for employer signup */
  employerAadhaarVerify: publicProcedure
    .input(z.object({ referenceId: z.string().min(1), otp: z.string().regex(/^\d{4,8}$/) }))
    .mutation(async ({ input }) => {
      try {
        return await verifyAadhaarOtp(input.referenceId, input.otp);
      } catch (err: any) {
        const e = err as Error & { otpInvalid?: boolean };
        if (e.otpInvalid) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message ?? 'Invalid OTP' });
        }
        throw new TRPCError({ code: 'BAD_GATEWAY', message: e.message ?? 'OTP verification failed' });
      }
    }),

  // ─── EntityLocker KYC ────────────────────────────────────────────────────

  /** Initiate an EntityLocker session and return the authorization URL */
  initEntityLockerSession: publicProcedure
    .input(z.object({ redirectUrl: z.string().url() }))
    .mutation(async ({ input }) => {
      const consentExpiry = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
      try {
        return await initEntityLockerSession('signup', input.redirectUrl, consentExpiry);
      } catch (err: any) {
        throw new TRPCError({ code: 'BAD_GATEWAY', message: err.message ?? 'EntityLocker session init failed' });
      }
    }),

  /** Fetch entity details after the EntityLocker consent redirect */
  getEntityLockerDetails: publicProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        return await getEntityDetails(input.sessionId);
      } catch (err: any) {
        throw new TRPCError({ code: 'BAD_GATEWAY', message: err.message ?? 'Failed to fetch entity details' });
      }
    }),
});
