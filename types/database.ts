export interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface Profile {
  id: string
  organization_id: string
  full_name: string | null
  role: string
  created_at: string
}

export interface PipelineStage {
  id: string
  organization_id: string
  name: string
  position: number
  created_at: string
}

export interface Client {
  id: string
  organization_id: string
  stage_id: string | null
  company_name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  vertical: string | null
  source: string | null
  tier: string | null
  mrr: number | null
  lock_in_start: string | null
  renewal_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}
