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
        };
        Update: {
          trade?: string;
          skills?: string[];
          certificate_type?: string | null;
          verification_status?: VerificationStatus;
          updated_at?: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      learner_status: LearnerStatus;
      application_status: ApplicationStatus;
      verification_status: VerificationStatus;
      event_source: EventSource;
    };
  };
}

export type UserRole = 'employer' | 'trainee' | 'officer' | 'dssdo' | 'admin';
export type LearnerStatus = 'active' | 'placed' | 'dropped' | 'at_risk';
export type ApplicationStatus = 'applied' | 'shortlisted' | 'interviewed' | 'hired' | 'rejected';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type EventSource = 'bot' | 'backend' | 'manual';

// Convenience row types
export type UserRow = Database['public']['Tables']['users']['Row'];
export type LearnerRow = Database['public']['Tables']['learners']['Row'];
export type JobRow = Database['public']['Tables']['jobs']['Row'];
export type ApplicationRow = Database['public']['Tables']['applications']['Row'];
export type SkillCardRow = Database['public']['Tables']['skill_cards']['Row'];
export type PlacementRow = Database['public']['Tables']['placements']['Row'];
export type EventRow = Database['public']['Tables']['events']['Row'];
export type SessionRow = Database['public']['Tables']['sessions']['Row'];
