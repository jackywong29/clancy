export interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface Profile {
  id: string
  organization_id: string | null
  full_name: string | null
  email: string | null
  role: string
  is_platform_admin: boolean
  created_at: string
}

export interface PipelineStage {
  id: string
  organization_id: string
  name: string
  position: number
  created_at: string
}

export interface SiteService {
  name: string
  price: string
  duration: string
  bookable: boolean
}

export interface SiteSocial {
  platform: string
  url: string
}

export type SiteTheme = 'light' | 'dark'
export type LogoPosition = 'left' | 'center'

export interface SiteConfig {
  name?: string
  tagline?: string
  description?: string
  phone?: string
  whatsapp?: string
  address?: string
  hours?: string
  accent?: string
  theme?: SiteTheme
  logo_url?: string | null
  logo_position?: LogoPosition
  book_label?: string
  services_title?: string
  find_us_title?: string
  faq_title?: string
  services?: SiteService[]
  faq?: { q: string; a: string }[]
  socials?: SiteSocial[]
}

export interface Site {
  id: string
  organization_id: string
  slug: string
  published: boolean
  config: SiteConfig
  created_at: string
  updated_at: string
}

export interface Intake {
  id: string
  organization_id: string
  client_id: string
  data: Record<string, string>
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  organization_id: string
  stage_id: string | null
  intake_token: string
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
