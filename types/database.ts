export type CrmFieldType =
  | 'text'
  | 'long'
  | 'number'
  | 'date'
  | 'phone'
  | 'email'
  | 'select'

export interface CrmField {
  key: string
  label: string
  type: CrmFieldType
  options?: string[]
}

export interface Department {
  key: string
  name: string
}

export interface EventCategory {
  key: string
  name: string
  color: string
}

export type WorkspaceRole = 'viewer' | 'editor' | 'admin'

export interface CrmConfig {
  record_singular?: string
  record_plural?: string
  fields?: CrmField[]
  card_fields?: string[]
  modules?: { tasks?: boolean; calendar?: boolean }
  role_labels?: Partial<Record<WorkspaceRole, string>>
  departments?: Department[]
  calendar_categories?: EventCategory[]
}

export interface Organization {
  id: string
  name: string
  slug: string
  crm_config: CrmConfig
  created_at: string
}

export interface Profile {
  id: string
  organization_id: string | null
  full_name: string | null
  email: string | null
  role: string
  department: string | null
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
export type ImageSide = 'left' | 'right'
export type TextAlign = 'left' | 'center' | 'right'
export type ContactMethod = 'whatsapp' | 'email'

// Per-text-type styling (headings / body / buttons). font blank = inherit
// the site font; otherwise a curated FONTS key.
export interface TypographyStyle {
  font?: string
  bold?: boolean
  italic?: boolean
  align?: TextAlign
}

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
  bg_color?: string
  bg_image_url?: string | null
  font?: string // curated key (see FONTS) or 'custom'
  font_custom?: string // typed Google Font family when font === 'custom'
  type_headings?: TypographyStyle
  type_body?: TypographyStyle
  type_buttons?: TypographyStyle
  logo_url?: string | null
  favicon_url?: string | null
  logo_position?: LogoPosition
  hero_image_url?: string | null
  book_label?: string
  service_book_label?: string
  book_message?: string // WhatsApp template, {name} token
  service_message?: string // WhatsApp template, {name} and {service} tokens
  contact_method?: ContactMethod // which channel the contact buttons use
  contact_email?: string
  email_subject?: string // email template, {name}/{service} tokens
  email_message?: string // email template, {name}/{service} tokens
  services_title?: string
  find_us_title?: string
  faq_title?: string
  gallery_title?: string
  gallery?: string[]
  about_title?: string
  about_body?: string
  about_image_url?: string | null
  about_image_side?: ImageSide
  services?: SiteService[]
  faq?: { q: string; a: string }[]
  socials?: SiteSocial[]
  section_order?: string[] // ordered enabled body-section keys (see lib/sections)
  form_enabled?: boolean
  form_title?: string
  form_intro?: string
  form_button?: string
  form_success?: string
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

export type TaskStatus = 'pending' | 'in_progress' | 'done'

export interface Task {
  id: string
  organization_id: string
  client_id: string | null
  title: string
  details: string | null
  assignee_id: string | null
  due_date: string | null
  department: string | null
  status: TaskStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CalendarEvent {
  id: string
  organization_id: string
  client_id: string | null
  title: string
  details: string | null
  starts_on: string
  event_time: string | null
  ends_on: string | null
  end_time: string | null
  all_day: boolean
  repeat: EventRepeat
  alert_departments: string[]
  alert_minutes: number | null
  category: string | null
  created_by: string | null
  created_at: string
}

export type EventRepeat =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'yearly'

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
  custom: Record<string, string>
  created_at: string
  updated_at: string
}

export interface OrgInvite {
  id: string
  organization_id: string
  email: string
  role: string
  department: string | null
  created_at: string
}

export interface NotificationItem {
  id: string
  organization_id: string
  title: string
  body: string | null
  link: string | null
  read: boolean
  created_at: string
}
