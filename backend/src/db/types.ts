/**
 * Database type definitions generated from Supabase schema.
 * Run `pnpm run types:gen` to regenerate after schema changes.
 *
 * These types mirror the actual Supabase database tables.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string | null;
          phone: string | null;
          role: UserRole;
          full_name: string | null;
          district: string | null;
          created_at: string;
          updated_at: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          email?: string | null;
          phone?: string | null;
          role: UserRole;
          full_name?: string | null;
          district?: string | null;
          created_at?: string;
          updated_at?: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          email?: string | null;
          phone?: string | null;
          role?: UserRole;
          full_name?: string | null;
          district?: string | null;
          updated_at?: string;
          is_active?: boolean;
        };
      };
      learners: {
        Row: {
          id: string;
          phone: string;
          full_name: string | null;
          trade: string | null;
          district: string | null;
          state: string | null;
          cohort: string | null;
          status: LearnerStatus;
          risk_score: number;
          created_at: string;
          updated_at: string;
          officer_id: string | null;
          // Aadhaar KYC columns (migration 004)
          aadhaar_number: string | null;
          dob: string | null;
          gender: string | null;
          address_line: string | null;
          address_district: string | null;
          address_state: string | null;
          address_pincode: string | null;
          kyc_status: string;
          aadhaar_photo_url: string | null;
          certificate_url: string | null;
        };
        Insert: {
          id?: string;
          phone: string;
          full_name?: string | null;
          trade?: string | null;
          district?: string | null;
          state?: string | null;
          cohort?: string | null;
          status?: LearnerStatus;
          risk_score?: number;
          created_at?: string;
          updated_at?: string;
          officer_id?: string | null;
          // Aadhaar KYC columns (migration 004)
          aadhaar_number?: string | null;
          dob?: string | null;
          gender?: string | null;
          address_line?: string | null;
          address_district?: string | null;
          address_state?: string | null;
          address_pincode?: string | null;
          kyc_status?: string;
          aadhaar_photo_url?: string | null;
          certificate_url?: string | null;
        };
        Update: {
          phone?: string;
          full_name?: string | null;
          trade?: string | null;
          district?: string | null;
          state?: string | null;
          cohort?: string | null;
          status?: LearnerStatus;
          risk_score?: number;
          updated_at?: string;
          officer_id?: string | null;
          // Aadhaar KYC columns (migration 004)
          aadhaar_number?: string | null;
          dob?: string | null;
          gender?: string | null;
          address_line?: string | null;
          address_district?: string | null;
          address_state?: string | null;
          address_pincode?: string | null;
          kyc_status?: string;
          aadhaar_photo_url?: string | null;
          certificate_url?: string | null;
        };
      };
      sessions: {
        Row: {
          id: string;
          learner_id: string;
          step: string;
          data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          learner_id: string;
          step: string;
          data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          step?: string;
          data?: Json;
          updated_at?: string;
        };
      };
      jobs: {
        Row: {
          id: string;
          title: string;
          company: string;
          location: string | null;
          trade: string | null;
          description: string | null;
          requirements: string | null;
          salary_range: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          posted_by: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          company: string;
          location?: string | null;
          trade?: string | null;
          description?: string | null;
          requirements?: string | null;
          salary_range?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          posted_by?: string | null;
        };
        Update: {
          title?: string;
          company?: string;
          location?: string | null;
          trade?: string | null;
          description?: string | null;
          requirements?: string | null;
          salary_range?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      applications: {
        Row: {
          id: string;
          learner_id: string;
          job_id: string;
          status: ApplicationStatus;
          applied_at: string;
          updated_at: string;
          notes: string | null;
          officer_id: string | null;
        };
        Insert: {
          id?: string;
          learner_id: string;
          job_id: string;
          status?: ApplicationStatus;
          applied_at?: string;
          updated_at?: string;
          notes?: string | null;
          officer_id?: string | null;
        };
        Update: {
          status?: ApplicationStatus;
          updated_at?: string;
          notes?: string | null;
          officer_id?: string | null;
        };
      };
      skill_cards: {
        Row: {
          id: string;
          learner_id: string;
          trade: string;
          skills: string[];
          certificate_type: string | null;
          verification_status: VerificationStatus;
          created_at: string;
          updated_at: string;
          certificate_url: string | null;
        };
        Insert: {
          id?: string;
          learner_id: string;
          trade: string;
          skills?: string[];
          certificate_type?: string | null;
          verification_status?: VerificationStatus;
          created_at?: string;
          updated_at?: string;
          certificate_url?: string | null;
        };
        Update: {
          trade?: string;
          skills?: string[];
          certificate_type?: string | null;
          verification_status?: VerificationStatus;
          updated_at?: string;
          certificate_url?: string | null;
        };
      };
      placements: {
        Row: {
          id: string;
          learner_id: string;
          job_id: string;
          confirmed_by: string;
          placement_date: string;
          salary: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          learner_id: string;
          job_id: string;
          confirmed_by: string;
          placement_date: string;
          salary?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          salary?: number | null;
          notes?: string | null;
        };
      };
      events: {
        Row: {
          id: string;
          learner_id: string | null;
          event_type: string;
          source: EventSource;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          learner_id?: string | null;
          event_type: string;
          source: EventSource;
          metadata?: Json;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
      employers: {
        Row: {
          id: string;
          company_name: string;
          udyam_number: string | null;
          gstin: string | null;
          district: string | null;
          state: string | null;
          address: string | null;
          total_employees: number;
          trade_categories: string[];
          verification_status: EmployerVerificationStatus;
          employer_risk_score: number;
          naps_registered: boolean;
          naps_registration_ref: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          company_name: string;
          udyam_number?: string | null;
          gstin?: string | null;
          district?: string | null;
          state?: string | null;
          address?: string | null;
          total_employees?: number;
          trade_categories?: string[];
          verification_status?: EmployerVerificationStatus;
          employer_risk_score?: number;
          naps_registered?: boolean;
          naps_registration_ref?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          company_name?: string;
          udyam_number?: string | null;
          gstin?: string | null;
          district?: string | null;
          state?: string | null;
          address?: string | null;
          total_employees?: number;
          trade_categories?: string[];
          verification_status?: EmployerVerificationStatus;
          employer_risk_score?: number;
          naps_registered?: boolean;
          naps_registration_ref?: string | null;
          updated_at?: string;
        };
      };
      vacancies: {
        Row: {
          id: string;
          employer_id: string;
          title: string;
          trade_required: string;
          nsqf_level_min: number | null;
          nsqf_level_max: number | null;
          salary_min: number;
          salary_max: number;
          location: string | null;
          district: string | null;
          state: string | null;
          description: string | null;
          working_hours: string | null;
          shift_type: 'day' | 'night' | 'rotational';
          naps_eligible: boolean;
          openings: number;
          minimum_wage_compliant: boolean;
          status: VacancyStatus;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employer_id: string;
          title: string;
          trade_required: string;
          nsqf_level_min?: number | null;
          nsqf_level_max?: number | null;
          salary_min: number;
          salary_max: number;
          location?: string | null;
          district?: string | null;
          state?: string | null;
          description?: string | null;
          working_hours?: string | null;
          shift_type?: 'day' | 'night' | 'rotational';
          naps_eligible?: boolean;
          openings?: number;
          minimum_wage_compliant?: boolean;
          status?: VacancyStatus;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          trade_required?: string;
          nsqf_level_min?: number | null;
          nsqf_level_max?: number | null;
          salary_min?: number;
          salary_max?: number;
          location?: string | null;
          district?: string | null;
          state?: string | null;
          description?: string | null;
          working_hours?: string | null;
          shift_type?: 'day' | 'night' | 'rotational';
          naps_eligible?: boolean;
          openings?: number;
          minimum_wage_compliant?: boolean;
          status?: VacancyStatus;
          expires_at?: string;
          updated_at?: string;
        };
      };
      matches: {
        Row: {
          id: string;
          vacancy_id: string;
          learner_id: string;
          employer_id: string;
          stage: MatchStage;
          skill_card_token: string | null;
          skill_card_token_exp: string | null;
          interview_at: string | null;
          offer_salary: number | null;
          timeline: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vacancy_id: string;
          learner_id: string;
          employer_id: string;
          stage?: MatchStage;
          skill_card_token?: string | null;
          skill_card_token_exp?: string | null;
          interview_at?: string | null;
          offer_salary?: number | null;
          timeline?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          stage?: MatchStage;
          skill_card_token?: string | null;
          skill_card_token_exp?: string | null;
          interview_at?: string | null;
          offer_salary?: number | null;
          timeline?: Json;
          updated_at?: string;
        };
      };
      naps_claims: {
        Row: {
          id: string;
          employer_id: string;
          vacancy_id: string;
          learner_id: string | null;
          stipend_amount: number;
          claim_month: string;
          status: NapsClaimStatus;
          submission_ref: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          employer_id: string;
          vacancy_id: string;
          learner_id?: string | null;
          stipend_amount?: number;
          claim_month: string;
          status?: NapsClaimStatus;
          submission_ref?: string | null;
          created_at?: string;
        };
        Update: {
          status?: NapsClaimStatus;
          submission_ref?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      learner_status: LearnerStatus;
      application_status: ApplicationStatus;
      verification_status: VerificationStatus;
      event_source: EventSource;
      employer_verification_status: EmployerVerificationStatus;
      vacancy_status: VacancyStatus;
      match_stage: MatchStage;
      naps_claim_status: NapsClaimStatus;
    };
  };
}

export type UserRole = 'employer' | 'trainee' | 'officer' | 'dssdo' | 'admin';
export type LearnerStatus = 'active' | 'placed' | 'dropped' | 'at_risk';
export type ApplicationStatus = 'applied' | 'shortlisted' | 'interviewed' | 'hired' | 'rejected';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type EventSource = 'bot' | 'backend' | 'manual';
export type EmployerVerificationStatus = 'unverified' | 'phone_verified' | 'udyam_verified' | 'aadhaar_verified' | 'entitylocker_verified' | 'fully_verified';
export type VacancyStatus = 'draft' | 'active' | 'paused' | 'closed' | 'flagged';
export type MatchStage =
  | 'new_match'
  | 'skill_card_viewed'
  | 'interest_expressed'
  | 'interview_scheduled'
  | 'interview_completed'
  | 'offer_extended'
  | 'hired'
  | 'rejected';
export type NapsClaimStatus = 'pending' | 'submitted' | 'approved' | 'rejected';

// Convenience row types
export type UserRow = Database['public']['Tables']['users']['Row'];
export type LearnerRow = Database['public']['Tables']['learners']['Row'];
export type JobRow = Database['public']['Tables']['jobs']['Row'];
export type ApplicationRow = Database['public']['Tables']['applications']['Row'];
export type SkillCardRow = Database['public']['Tables']['skill_cards']['Row'];
export type PlacementRow = Database['public']['Tables']['placements']['Row'];
export type EventRow = Database['public']['Tables']['events']['Row'];
export type SessionRow = Database['public']['Tables']['sessions']['Row'];
export type EmployerRow = Database['public']['Tables']['employers']['Row'];
export type VacancyRow = Database['public']['Tables']['vacancies']['Row'];
export type MatchRow = Database['public']['Tables']['matches']['Row'];
export type NapsClaimRow = Database['public']['Tables']['naps_claims']['Row'];
