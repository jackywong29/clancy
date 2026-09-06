'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getMembership,
  requireEditorOrg,
  requireWorkspaceAdmin,
} from '@/lib/permissions'
import {
  isEmailConfigured,
  sendEmail,
  fillTokens,
  MAX_ATTACHMENT_BYTES,
  type MailAttachment,
} from '@/lib/email'
import { resolveAudience, parseEmailList, mergeRecipients } from '@/lib/audience'
import {
  cidFor,
  renderBroadcastHtml,
  renderBroadcastText,
} from '@/lib/broadcast-email'
import {
  parseChecklist,
  generateStageTasks,
  blockingTasksFor,
} from '@/lib/checklist'
import type {
  BroadcastAttachment,
  ChecklistItem,
  EmailSignature,
  PipelineStage,
} from '@/types/database'

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect('/login?error=1')
  }
  redirect('/pipeline')
}

export async function signUp(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const fullName = String(formData.get('full_name') ?? '').trim()

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })

  if (error) {
    redirect('/signup?error=1')
  }
  if (data.session) {
    redirect('/pipeline')
  }
  redirect('/signup?sent=1')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function requireOrg(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.organization_id) {
    redirect('/no-access')
  }
  return profile.organization_id
}

export async function addClient(formData: FormData) {
  const supabase = await createClient()
  const organizationId = (await requireEditorOrg()).orgId

  const optional = (name: string) => {
    const value = String(formData.get(name) ?? '').trim()
    return value === '' ? null : value
  }

  const mrrRaw = optional('mrr')

  const { error } = await supabase.from('clients').insert({
    organization_id: organizationId,
    company_name: String(formData.get('company_name') ?? '').trim(),
    stage_id: optional('stage_id'),
    contact_person: optional('contact_person'),
    phone: optional('phone'),
    email: optional('email'),
    vertical: optional('vertical'),
    source: optional('source'),
    tier: optional('tier'),
    mrr: mrrRaw === null ? null : Number(mrrRaw),
    lock_in_start: optional('lock_in_start'),
    renewal_date: optional('renewal_date'),
    notes: optional('notes'),
  })

  if (error) {
    redirect(`/clients/new?error=1&msg=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/pipeline')
  redirect('/pipeline')
}

export async function updateClient(formData: FormData) {
  const supabase = await createClient()
  await requireEditorOrg()

  const clientId = String(formData.get('client_id') ?? '')
  const optional = (name: string) => {
    const value = String(formData.get(name) ?? '').trim()
    return value === '' ? null : value
  }
  const mrrRaw = optional('mrr')

  const { error } = await supabase
    .from('clients')
    .update({
      company_name: String(formData.get('company_name') ?? '').trim(),
      stage_id: optional('stage_id'),
      contact_person: optional('contact_person'),
      phone: optional('phone'),
      email: optional('email'),
      vertical: optional('vertical'),
      source: optional('source'),
      tier: optional('tier'),
      mrr: mrrRaw === null ? null : Number(mrrRaw),
      lock_in_start: optional('lock_in_start'),
      renewal_date: optional('renewal_date'),
      notes: optional('notes'),
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientId)

  revalidatePath('/pipeline')
  revalidatePath(`/clients/${clientId}`)
  redirect(
    `/clients/${clientId}?${
      error ? `error=1&msg=${encodeURIComponent(error.message)}` : 'saved=1'
    }`
  )
}

export async function saveIntake(formData: FormData) {
  const supabase = await createClient()
  const organizationId = (await requireEditorOrg()).orgId

  const clientId = String(formData.get('client_id') ?? '')
  const data: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (key.includes('.') && typeof value === 'string') {
      data[key] = value
    }
  }

  const { error } = await supabase.from('intakes').upsert(
    {
      organization_id: organizationId,
      client_id: clientId,
      data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'client_id' }
  )

  revalidatePath('/pipeline')
  revalidatePath(`/clients/${clientId}/intake`)
  redirect(
    `/clients/${clientId}/intake?${
      error ? `error=1&msg=${encodeURIComponent(error.message)}` : 'saved=1'
    }`
  )
}

export async function deleteClient(formData: FormData) {
  const supabase = await createClient()
  await requireEditorOrg()

  const clientId = String(formData.get('client_id') ?? '')
  if (clientId) {
    await supabase.from('clients').delete().eq('id', clientId)
  }

  revalidatePath('/pipeline')
  redirect('/pipeline')
}

export async function addStage(formData: FormData) {
  const supabase = await createClient()
  const organizationId = (await requireEditorOrg()).orgId

  const name = String(formData.get('name') ?? '').trim()
  if (name) {
    const { data: last } = await supabase
      .from('pipeline_stages')
      .select('position')
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()

    await supabase.from('pipeline_stages').insert({
      organization_id: organizationId,
      name,
      position: (last?.position ?? 0) + 1,
    })
  }

  revalidatePath('/stages')
  revalidatePath('/pipeline')
  redirect('/stages')
}

export async function updateStage(formData: FormData) {
  const supabase = await createClient()
  await requireEditorOrg()

  const stageId = String(formData.get('stage_id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const position = Number(formData.get('position') ?? 0)

  if (stageId && name) {
    await supabase
      .from('pipeline_stages')
      .update({ name, position })
      .eq('id', stageId)
  }

  revalidatePath('/stages')
  revalidatePath('/pipeline')
  redirect('/stages?saved=1')
}

export async function deleteStage(formData: FormData) {
  const supabase = await createClient()
  await requireEditorOrg()

  const stageId = String(formData.get('stage_id') ?? '')
  if (stageId) {
    const { count } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('stage_id', stageId)

    if ((count ?? 0) > 0) {
      redirect(`/stages?error=in-use&count=${count}`)
    }
    await supabase.from('pipeline_stages').delete().eq('id', stageId)
  }

  revalidatePath('/stages')
  revalidatePath('/pipeline')
  redirect('/stages')
}

export async function requireAdmin() {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_platform_admin')
    .eq(
      'id',
      (await supabase.auth.getUser()).data.user?.id ?? ''
    )
    .maybeSingle()

  if (!profile?.is_platform_admin) {
    redirect('/pipeline')
  }
}

export async function updateProfileAccess(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()

  const profileId = String(formData.get('profile_id') ?? '')
  const orgValue = String(formData.get('organization_id') ?? '')
  const wantsPlatformAdmin = formData.get('is_platform_admin') === 'on'

  if (!profileId) {
    revalidatePath('/team')
    redirect('/team?saved=1')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: target } = await supabase
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', profileId)
    .maybeSingle()

  const wasPlatformAdmin = target?.is_platform_admin === true
  const update: {
    organization_id: string | null
    is_platform_admin?: boolean
  } = { organization_id: orgValue === '' ? null : orgValue }

  if (wantsPlatformAdmin !== wasPlatformAdmin) {
    // Clancy-staff access reaches every client workspace, so removing it needs
    // two guards against locking the platform out of its own admin surface —
    // that has already happened twice (see migrations 004/005).
    if (!wantsPlatformAdmin) {
      if (user?.id === profileId) {
        redirect(
          `/team?error=1&msg=${encodeURIComponent(
            "You can't remove your own Clancy staff access — ask another Clancy admin to do it."
          )}`
        )
      }
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('is_platform_admin', true)
      if ((count ?? 0) <= 1) {
        redirect(
          `/team?error=1&msg=${encodeURIComponent(
            'At least one Clancy staff account must remain.'
          )}`
        )
      }
    }
    update.is_platform_admin = wantsPlatformAdmin
  }

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', profileId)

  revalidatePath('/team')
  redirect(
    error
      ? `/team?error=1&msg=${encodeURIComponent(error.message)}`
      : '/team?saved=1'
  )
}

export async function submitClientIntake(formData: FormData) {
  const { CLIENT_FACING_KEYS } = await import('@/lib/intake')
  const supabase = await createClient()

  const token = String(formData.get('token') ?? '')
  const data: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (CLIENT_FACING_KEYS.has(key) && typeof value === 'string') {
      data[key] = value
    }
  }

  const { error } = await supabase.rpc('save_intake_by_token', {
    t: token,
    new_data: data,
  })

  redirect(`/i/${token}?${error ? 'error=1' : 'saved=1'}`)
}

export async function switchWorkspace(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()

  const orgId = String(formData.get('organization_id') ?? '')
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (orgId && user) {
    await supabase
      .from('profiles')
      .update({ organization_id: orgId })
      .eq('id', user.id)
  }

  revalidatePath('/', 'layout')
  redirect('/pipeline')
}

export async function createSite(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()

  const organizationId = String(formData.get('organization_id') ?? '')
  const slug = String(formData.get('slug') ?? '')
    .trim()
    .toLowerCase()
  const name = String(formData.get('name') ?? '').trim()

  if (!/^[a-z0-9-]{2,40}$/.test(slug)) {
    redirect('/sites?error=1&msg=Slug%20must%20be%202-40%20lowercase%20letters%2C%20numbers%2C%20or%20dashes')
  }

  const { error } = await supabase.from('sites').insert({
    organization_id: organizationId,
    slug,
    published: false,
    config: { name: name || slug },
  })

  if (error) {
    redirect(`/sites?error=1&msg=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/sites')
  redirect(`/sites/${slug}/edit`)
}

export async function updateSite(formData: FormData) {
  const supabase = await createClient()

  const slug = String(formData.get('slug') ?? '')
  const membership = await getMembership()
  if (!membership.isPlatformAdmin) {
    if (membership.role !== 'admin') redirect('/pipeline?denied=1')
    const { data: owned } = await supabase
      .from('sites')
      .select('organization_id')
      .eq('slug', slug)
      .maybeSingle()
    if (owned?.organization_id !== membership.orgId) {
      redirect('/pipeline?denied=1')
    }
  }
  const text = (name: string) => String(formData.get(name) ?? '').trim()
  const align = (name: string) => {
    const v = text(name)
    return v === 'left' || v === 'center' || v === 'right' ? v : undefined
  }
  const typography = (prefix: string) => ({
    font: text(`${prefix}_font`) || undefined,
    bold: formData.get(`${prefix}_bold`) === 'on',
    italic: formData.get(`${prefix}_italic`) === 'on',
    align: align(`${prefix}_align`),
  })

  let services: unknown = []
  let faq: unknown = []
  let socials: unknown = []
  let gallery: unknown = []
  let customSections: unknown = []
  let sectionOrder: string[] = []
  try {
    services = JSON.parse(text('services') || '[]')
    faq = JSON.parse(text('faq') || '[]')
    socials = JSON.parse(text('socials') || '[]')
    gallery = JSON.parse(text('gallery') || '[]')
    customSections = JSON.parse(text('custom_sections') || '[]')
    const parsedOrder = JSON.parse(text('section_order') || '[]')
    if (Array.isArray(parsedOrder)) {
      sectionOrder = parsedOrder.filter((x): x is string => typeof x === 'string')
    }
  } catch {
    // keep empty on parse failure
  }

  const config = {
    name: text('name'),
    form_enabled: formData.get('form_enabled') === 'on',
    form_title: text('form_title'),
    form_intro: text('form_intro'),
    form_button: text('form_button'),
    form_success: text('form_success'),
    tagline: text('tagline'),
    description: text('description'),
    phone: text('phone'),
    whatsapp: text('whatsapp'),
    address: text('address'),
    hours: text('hours'),
    accent: text('accent') || '#5646E5',
    theme: text('theme') === 'dark' ? 'dark' : 'light',
    bg_color: text('bg_color'),
    bg_image_url: text('bg_image_url') || null,
    font: text('font') || 'sans',
    font_custom: text('font_custom'),
    type_headings: typography('headings'),
    type_body: typography('body'),
    type_buttons: typography('buttons'),
    logo_position: text('logo_position') === 'center' ? 'center' : 'left',
    logo_url: text('logo_url') || null,
    favicon_url: text('favicon_url') || null,
    text_color: text('text_color'),
    hero_image_url: text('hero_image_url') || null,
    book_label: text('book_label'),
    service_book_label: text('service_book_label'),
    book_message: text('book_message'),
    service_message: text('service_message'),
    contact_method: text('contact_method') === 'email' ? 'email' : 'whatsapp',
    contact_email: text('contact_email'),
    email_subject: text('email_subject'),
    email_message: text('email_message'),
    services_title: text('services_title'),
    find_us_title: text('find_us_title'),
    faq_title: text('faq_title'),
    gallery_title: text('gallery_title'),
    gallery,
    about_title: text('about_title'),
    about_body: text('about_body'),
    about_image_url: text('about_image_url') || null,
    about_image_side: text('about_image_side') === 'right' ? 'right' : 'left',
    section_order: sectionOrder,
    services,
    faq,
    custom_sections: customSections,
    socials,
  }

  const { error } = await supabase
    .from('sites')
    .update({
      config,
      published: formData.get('published') === 'on',
      updated_at: new Date().toISOString(),
    })
    .eq('slug', slug)

  revalidatePath(`/s/${slug}`)
  revalidatePath('/sites')
  redirect(
    `/sites/${slug}/edit?${
      error ? `error=1&msg=${encodeURIComponent(error.message)}` : 'saved=1'
    }`
  )
}

function collectCustom(formData: FormData): Record<string, string> {
  const custom: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('custom.') && typeof value === 'string') {
      const fieldKey = key.slice('custom.'.length)
      if (value.trim() !== '') custom[fieldKey] = value
    }
  }
  return custom
}

export async function addRecord(formData: FormData) {
  const supabase = await createClient()
  const organizationId = await requireOrg()

  const name = String(formData.get('name') ?? '').trim()
  const optional = (n: string) => {
    const v = String(formData.get(n) ?? '').trim()
    return v === '' ? null : v
  }

  const stageId = optional('stage_id')
  const { data: created, error } = await supabase
    .from('clients')
    .insert({
      organization_id: organizationId,
      company_name: name,
      stage_id: stageId,
      phone: optional('phone'),
      email: optional('email'),
      notes: optional('notes'),
      custom: collectCustom(formData),
    })
    .select('id')
    .single()

  if (error) {
    redirect(`/records/new?error=1&msg=${encodeURIComponent(error.message)}`)
  }

  // A record created straight into a stage gets that stage's checklist too,
  // not just one that arrives by being moved.
  if (created && stageId) {
    const { data: stage } = await supabase
      .from('pipeline_stages')
      .select('id, checklist')
      .eq('id', stageId)
      .maybeSingle()
    if (stage) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      await generateStageTasks({
        supabase,
        organizationId,
        clientId: created.id,
        stage: stage as Pick<PipelineStage, 'id' | 'checklist'>,
        userId: user?.id ?? null,
      })
    }
  }

  revalidatePath('/pipeline')
  revalidatePath('/tasks')
  redirect('/pipeline')
}

export async function updateRecord(formData: FormData) {
  const supabase = await createClient()
  await requireOrg()

  const recordId = String(formData.get('record_id') ?? '')
  const optional = (n: string) => {
    const v = String(formData.get(n) ?? '').trim()
    return v === '' ? null : v
  }

  const { error } = await supabase
    .from('clients')
    .update({
      company_name: String(formData.get('name') ?? '').trim(),
      stage_id: optional('stage_id'),
      phone: optional('phone'),
      email: optional('email'),
      notes: optional('notes'),
      custom: collectCustom(formData),
      updated_at: new Date().toISOString(),
    })
    .eq('id', recordId)

  revalidatePath('/pipeline')
  revalidatePath(`/records/${recordId}`)
  redirect(
    `/records/${recordId}?${
      error ? `error=1&msg=${encodeURIComponent(error.message)}` : 'saved=1'
    }`
  )
}

export async function deleteRecord(formData: FormData) {
  const supabase = await createClient()
  await requireOrg()

  const recordId = String(formData.get('record_id') ?? '')
  if (recordId) {
    await supabase.from('clients').delete().eq('id', recordId)
  }
  revalidatePath('/pipeline')
  redirect('/pipeline')
}

export async function updateCrmConfig(formData: FormData) {
  const supabase = await createClient()
  const membership = await requireWorkspaceAdmin()
  const organizationId = membership.orgId

  let fields: unknown = []
  try {
    fields = JSON.parse(String(formData.get('fields') ?? '[]'))
  } catch {
    fields = []
  }
  const cardFields = String(formData.get('card_fields') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const crm_config = {
    ...membership.crmConfig,
    record_singular: String(formData.get('record_singular') ?? '').trim() || 'Record',
    record_plural: String(formData.get('record_plural') ?? '').trim() || 'Records',
    fields,
    card_fields: cardFields,
    modules: {
      tasks: formData.get('module_tasks') === 'on',
      calendar: formData.get('module_calendar') === 'on',
    },
  }

  const { error } = await supabase
    .from('organizations')
    .update({ crm_config })
    .eq('id', organizationId)

  revalidatePath('/crm')
  revalidatePath('/pipeline')
  redirect(
    `/crm?${error ? `error=1&msg=${encodeURIComponent(error.message)}` : 'saved=1'}`
  )
}

export async function addTask(formData: FormData) {
  const supabase = await createClient()
  const organizationId = (await requireEditorOrg()).orgId
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const title = String(formData.get('title') ?? '').trim()
  const optional = (n: string) => {
    const v = String(formData.get(n) ?? '').trim()
    return v === '' ? null : v
  }

  if (title) {
    await supabase.from('tasks').insert({
      organization_id: organizationId,
      title,
      details: optional('details'),
      assignee_id: optional('assignee_id'),
      client_id: optional('client_id'),
      due_date: optional('due_date'),
      department: optional('department'),
      created_by: user?.id ?? null,
    })
  }
  revalidatePath('/tasks')
  redirect('/tasks')
}

export async function updateTaskStatus(formData: FormData) {
  const supabase = await createClient()
  await requireEditorOrg()

  const taskId = String(formData.get('task_id') ?? '')
  const status = String(formData.get('status') ?? '')
  if (taskId && ['pending', 'in_progress', 'done'].includes(status)) {
    await supabase
      .from('tasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', taskId)
  }
  revalidatePath('/tasks')

  // Ticking a checklist item off a record's page should update that page and
  // the board pill, not just /tasks.
  const recordId = String(formData.get('record_id') ?? '')
  if (recordId) {
    revalidatePath('/pipeline')
    revalidatePath(`/records/${recordId}`)
  }
}

export async function deleteTask(formData: FormData) {
  const supabase = await createClient()
  await requireEditorOrg()

  const taskId = String(formData.get('task_id') ?? '')
  if (taskId) {
    await supabase.from('tasks').delete().eq('id', taskId)
  }
  revalidatePath('/tasks')
}

export async function addEvent(formData: FormData) {
  const supabase = await createClient()
  const organizationId = (await requireEditorOrg()).orgId
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const title = String(formData.get('title') ?? '').trim()
  const startsOn = String(formData.get('starts_on') ?? '').trim()
  const optional = (n: string) => {
    const v = String(formData.get(n) ?? '').trim()
    return v === '' ? null : v
  }
  const month = startsOn.slice(0, 7)
  const allDay = formData.get('all_day') === 'on'
  const alertDepartments = formData.getAll('alert_departments').map(String)
  const alertRaw = String(formData.get('alert_minutes') ?? '').trim()
  const repeat = String(formData.get('repeat') ?? 'none')
  const validRepeat = ['none', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly'].includes(repeat)
    ? repeat
    : 'none'

  if (title && startsOn) {
    await supabase.from('events').insert({
      organization_id: organizationId,
      title,
      details: optional('details'),
      client_id: optional('client_id'),
      starts_on: startsOn,
      ends_on: optional('ends_on') ?? startsOn,
      event_time: allDay ? null : optional('event_time'),
      end_time: allDay ? null : optional('end_time'),
      all_day: allDay,
      repeat: validRepeat,
      alert_departments: alertDepartments,
      alert_minutes: alertRaw === '' ? null : Number(alertRaw),
      category: optional('category'),
      created_by: user?.id ?? null,
    })
  }
  revalidatePath('/calendar')
  redirect(`/calendar?m=${month}`)
}

export async function deleteEvent(formData: FormData) {
  const supabase = await createClient()
  await requireEditorOrg()

  const eventId = String(formData.get('event_id') ?? '')
  if (eventId) {
    await supabase.from('events').delete().eq('id', eventId)
  }
  revalidatePath('/calendar')
}

export async function moveClientStage(formData: FormData) {
  const m = await requireEditorOrg()
  const supabase = await createClient()
  const clientId = String(formData.get('client_id') ?? '')
  const stageId = String(formData.get('stage_id') ?? '')

  if (!clientId || !stageId) {
    revalidatePath('/pipeline')
    return
  }

  const [{ data: client }, { data: stageRows }] = await Promise.all([
    supabase.from('clients').select('stage_id').eq('id', clientId).maybeSingle(),
    supabase.from('pipeline_stages').select('id, position, checklist'),
  ])

  const stages = (stageRows ?? []) as Pick<
    PipelineStage,
    'id' | 'position' | 'checklist'
  >[]
  const target = stages.find((s) => s.id === stageId)
  const current = stages.find((s) => s.id === client?.stage_id)

  // Blocking checklist items on the stage being LEFT hold a record back, but
  // only from moving forward — sending a job back to an earlier stage has to
  // stay possible even with work outstanding.
  if (current && target && target.position > current.position) {
    const outstanding = await blockingTasksFor(supabase, clientId, current)
    if (outstanding.length > 0) {
      redirect(
        `/pipeline?error=1&msg=${encodeURIComponent(
          `Finish first: ${outstanding.join(', ')}`
        )}`
      )
    }
  }

  await supabase
    .from('clients')
    .update({ stage_id: stageId, updated_at: new Date().toISOString() })
    .eq('id', clientId)

  if (target) {
    const { error } = await generateStageTasks({
      supabase,
      organizationId: m.orgId,
      clientId,
      stage: target,
      userId: m.userId,
    })
    if (error) {
      revalidatePath('/pipeline')
      redirect(
        `/pipeline?error=1&msg=${encodeURIComponent(
          `Moved, but the stage checklist couldn't be created: ${error}`
        )}`
      )
    }
  }

  revalidatePath('/pipeline')
  revalidatePath('/tasks')
  revalidatePath(`/records/${clientId}`)
  revalidatePath(`/clients/${clientId}`)
}

// Pull in a stage's checklist for a record that was already sitting in the
// stage before the checklist existed. Deliberately manual — auto-backfilling
// would mass-create tasks across every record at once.
export async function generateChecklistNow(formData: FormData) {
  const m = await requireEditorOrg()
  const supabase = await createClient()
  const recordId = String(formData.get('record_id') ?? '')

  const { data: client } = await supabase
    .from('clients')
    .select('stage_id')
    .eq('id', recordId)
    .maybeSingle()

  // Clancy's own workspace shows client detail at /clients/[id]; client
  // workspaces use /records/[id]. Return the user to whichever they came from.
  const backTo = String(formData.get('back_to') ?? `/records/${recordId}`)

  if (client?.stage_id) {
    const { data: stage } = await supabase
      .from('pipeline_stages')
      .select('id, checklist')
      .eq('id', client.stage_id)
      .maybeSingle()
    if (stage) {
      const { error } = await generateStageTasks({
        supabase,
        organizationId: m.orgId,
        clientId: recordId,
        stage: stage as Pick<PipelineStage, 'id' | 'checklist'>,
        userId: m.userId,
      })
      if (error) {
        redirect(`${backTo}?error=1&msg=${encodeURIComponent(error)}`)
      }
    }
  }

  revalidatePath('/tasks')
  revalidatePath('/pipeline')
  revalidatePath(`/records/${recordId}`)
  revalidatePath(`/clients/${recordId}`)
  redirect(`${backTo}?saved=1`)
}

export async function saveStageChecklist(formData: FormData) {
  await requireWorkspaceAdmin()
  const supabase = await createClient()

  const stageId = String(formData.get('stage_id') ?? '')
  let checklist: ChecklistItem[] = []
  try {
    checklist = parseChecklist(JSON.parse(String(formData.get('checklist') ?? '[]')))
  } catch {
    checklist = []
  }

  // Ask for the updated row back so a write that matched nothing (wrong id, or
  // RLS silently filtering it out) can't report "Saved."
  const { data: updated, error } = await supabase
    .from('pipeline_stages')
    .update({ checklist })
    .eq('id', stageId)
    .select('id')

  revalidatePath('/stages')
  revalidatePath('/pipeline')

  if (error) {
    redirect(`/stages?error=1&msg=${encodeURIComponent(error.message)}`)
  }
  if (!updated || updated.length === 0) {
    redirect(
      `/stages?error=1&msg=${encodeURIComponent(
        "That stage didn't update — you may not have permission to edit it."
      )}`
    )
  }
  redirect('/stages?saved=1')
}

export async function updateMember(formData: FormData) {
  const supabase = await createClient()
  const m = await requireWorkspaceAdmin()

  const profileId = String(formData.get('profile_id') ?? '')
  const role = String(formData.get('role') ?? 'viewer')
  const department = String(formData.get('department') ?? '').trim() || null

  if (!profileId || !['viewer', 'editor', 'admin'].includes(role)) {
    redirect('/team?error=1&msg=Invalid%20role')
  }

  const { data: target } = await supabase
    .from('profiles')
    .select('organization_id, is_platform_admin')
    .eq('id', profileId)
    .maybeSingle()

  if (!target) redirect('/team?error=1&msg=Member%20not%20found')
  if (target.is_platform_admin && !m.isPlatformAdmin) {
    redirect('/team?error=1&msg=Cannot%20edit%20a%20Clancy%20admin')
  }
  if (!m.isPlatformAdmin && target.organization_id !== m.orgId) {
    redirect('/team?error=1&msg=Not%20in%20your%20workspace')
  }

  await supabase
    .from('profiles')
    .update({ role, department })
    .eq('id', profileId)

  revalidatePath('/team')
  redirect('/team?saved=1')
}

export async function addInvite(formData: FormData) {
  const supabase = await createClient()
  const m = await requireWorkspaceAdmin()

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const role = String(formData.get('role') ?? 'viewer')
  const department = String(formData.get('department') ?? '').trim() || null

  if (!email || !['viewer', 'editor', 'admin'].includes(role)) {
    redirect('/team?error=1&msg=Email%20and%20a%20valid%20role%20are%20required')
  }

  const { error } = await supabase.from('org_invites').insert({
    organization_id: m.orgId,
    email,
    role,
    department,
  })

  if (!error && isEmailConfigured()) {
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', m.orgId)
      .maybeSingle()
    const business = (orgRow?.name as string) ?? 'our team'
    const subject = fillTokens(
      m.crmConfig.invite_subject?.trim() || "You're invited to {business} on Clancy",
      { business }
    )
    const message = fillTokens(
      m.crmConfig.invite_message?.trim() ||
        'Hi!\n\nYou have been invited to join {business} on Clancy.\n\nCreate your account with this email address here: {link}\n\nSee you inside!',
      { business, link: 'https://clancy-hq.vercel.app/signup' }
    )
    await sendEmail({ to: [email], subject, text: message })
  }

  revalidatePath('/team')
  redirect(
    `/team?${error ? `error=1&msg=${encodeURIComponent(error.message)}` : 'saved=1'}`
  )
}

export async function removeInvite(formData: FormData) {
  const supabase = await createClient()
  await requireWorkspaceAdmin()

  const inviteId = String(formData.get('invite_id') ?? '')
  if (inviteId) {
    await supabase.from('org_invites').delete().eq('id', inviteId)
  }
  revalidatePath('/team')
}

export async function saveTeamSettings(formData: FormData) {
  const supabase = await createClient()
  const m = await requireWorkspaceAdmin()

  const parse = (name: string) => {
    try {
      const v = JSON.parse(String(formData.get(name) ?? '[]'))
      return Array.isArray(v) ? v : []
    } catch {
      return []
    }
  }

  const sigText = (field: string) =>
    String(formData.get(`sig_${field}`) ?? '').trim()

  const signature: EmailSignature = {
    enabled: formData.get('sig_enabled') === 'on',
    logo_url: sigText('logo_url'),
    business_name: sigText('business_name'),
    tagline: sigText('tagline'),
    sign_off: sigText('sign_off'),
    sender_name: sigText('sender_name'),
    sender_title: sigText('sender_title'),
    phone: sigText('phone'),
    email: sigText('email'),
    website: sigText('website'),
    address: sigText('address'),
    footer_note: sigText('footer_note'),
  }

  const crm_config = {
    ...m.crmConfig,
    role_labels: {
      viewer: String(formData.get('label_viewer') ?? '').trim() || 'Staff',
      editor: String(formData.get('label_editor') ?? '').trim() || 'Head',
      admin: String(formData.get('label_admin') ?? '').trim() || 'Admin',
    },
    departments: parse('departments'),
    calendar_categories: parse('calendar_categories'),
    invite_subject: String(formData.get('invite_subject') ?? '').trim(),
    invite_message: String(formData.get('invite_message') ?? '').trim(),
    signature,
  }

  const { error } = await supabase
    .from('organizations')
    .update({ crm_config })
    .eq('id', m.orgId)

  revalidatePath('/team')
  revalidatePath('/tasks')
  revalidatePath('/calendar')
  revalidatePath('/broadcasts')
  redirect(
    `/team?${error ? `error=1&msg=${encodeURIComponent(error.message)}` : 'saved=1'}`
  )
}

export async function submitLeadForm(formData: FormData) {
  const supabase = await createClient()
  const slug = String(formData.get('site_slug') ?? '')

  const lead = {
    name: String(formData.get('name') ?? '').trim(),
    phone: String(formData.get('phone') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim(),
    message: String(formData.get('message') ?? '').trim(),
  }

  if (!slug || !lead.name) {
    redirect(`/s/${slug}?formerror=1`)
  }

  const { error } = await supabase.rpc('submit_lead', {
    site_slug: slug,
    lead,
  })

  redirect(`/s/${slug}?${error ? 'formerror=1' : 'sent=1'}`)
}

export async function markAllNotificationsRead() {
  const supabase = await createClient()
  const m = await getMembership()

  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('organization_id', m.orgId)
    .eq('read', false)

  revalidatePath('/notifications')
  redirect('/notifications')
}

// Attachment metadata arrives from the browser as JSON, so validate the shape
// rather than trusting it. `path` is re-checked against the caller's org
// prefix — storage RLS would block a foreign read anyway, but failing here
// gives a clear error instead of a silent empty attachment.
function parseAttachments(raw: FormDataEntryValue | null): BroadcastAttachment[] {
  try {
    const value = JSON.parse(String(raw ?? '[]'))
    if (!Array.isArray(value)) return []
    return value
      .filter(
        (a): a is BroadcastAttachment =>
          Boolean(a) &&
          typeof a.name === 'string' &&
          typeof a.path === 'string' &&
          typeof a.size === 'number'
      )
      .map((a) => ({
        name: a.name,
        path: a.path,
        size: a.size,
        type: typeof a.type === 'string' ? a.type : 'application/octet-stream',
        inline: a.inline === true,
      }))
  } catch {
    return []
  }
}

export async function createBroadcast(formData: FormData) {
  const supabase = await createClient()
  const m = await requireEditorOrg()

  const subject = String(formData.get('subject') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  const audience = String(formData.get('audience') ?? 'all')
  const attachments = parseAttachments(formData.get('attachments'))
  const { valid: customRecipients, invalid } = parseEmailList(
    String(formData.get('custom_recipients') ?? '')
  )

  if (!subject || !body) {
    redirect('/broadcasts?error=1&msg=Subject%20and%20message%20are%20required')
  }

  if (invalid.length > 0) {
    redirect(
      `/broadcasts?error=1&msg=${encodeURIComponent(
        `Not a valid email address: ${invalid.slice(0, 3).join(', ')}`
      )}`
    )
  }

  if (audience === 'custom' && customRecipients.length === 0) {
    redirect(
      '/broadcasts?error=1&msg=Type%20at%20least%20one%20email%20address'
    )
  }

  const total = attachments.reduce((sum, a) => sum + a.size, 0)
  if (total > MAX_ATTACHMENT_BYTES) {
    redirect('/broadcasts?error=1&msg=Attachments%20are%20too%20large%20to%20email')
  }

  // resolveAudience handles team audiences too — counting `clients` here
  // reported 0 recipients for any team broadcast.
  const recipients = mergeRecipients(
    await resolveAudience(supabase, audience),
    customRecipients
  )

  const { data: created, error } = await supabase
    .from('broadcasts')
    .insert({
      organization_id: m.orgId,
      subject,
      body,
      audience,
      attachments,
      custom_recipients: customRecipients,
      recipient_count: recipients.length,
      created_by: m.userId,
    })
    .select('id')
    .single()

  if (error || !created) {
    redirect(`/broadcasts?error=1&msg=${encodeURIComponent(error?.message ?? 'failed')}`)
  }
  revalidatePath('/broadcasts')
  redirect(`/broadcasts/${created.id}`)
}

export async function markBroadcastSent(formData: FormData) {
  const supabase = await createClient()
  await requireEditorOrg()

  const broadcastId = String(formData.get('broadcast_id') ?? '')
  if (broadcastId) {
    await supabase
      .from('broadcasts')
      .update({ status: 'sent' })
      .eq('id', broadcastId)
  }
  revalidatePath('/broadcasts')
  redirect('/broadcasts?saved=1')
}

export async function deleteBroadcast(formData: FormData) {
  const supabase = await createClient()
  await requireEditorOrg()

  const broadcastId = String(formData.get('broadcast_id') ?? '')
  if (broadcastId) {
    await supabase.from('broadcasts').delete().eq('id', broadcastId)
  }
  revalidatePath('/broadcasts')
  redirect('/broadcasts')
}

export async function updateLanding(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()
  const text = (n: string) => String(formData.get(n) ?? '').trim()

  let features: unknown = []
  let steps: unknown = []
  try {
    features = JSON.parse(text('features') || '[]')
    steps = JSON.parse(text('steps') || '[]')
  } catch {
    // keep empty
  }

  const config = {
    hero_title: text('hero_title'),
    hero_sub: text('hero_sub'),
    cta_label: text('cta_label'),
    cta_href: text('cta_href'),
    badge_line: text('badge_line'),
    features,
    steps,
    closing_title: text('closing_title'),
    closing_sub: text('closing_sub'),
    footer_line: text('footer_line'),
    instagram_url: text('instagram_url'),
    contact_email: text('contact_email'),
  }

  const { error } = await supabase
    .from('sites')
    .update({ config, updated_at: new Date().toISOString() })
    .eq('slug', 'clancy-home')

  revalidatePath('/')
  redirect(
    `/sites/home/edit?${
      error ? `error=1&msg=${encodeURIComponent(error.message)}` : 'saved=1'
    }`
  )
}

export async function sendBroadcastNow(formData: FormData) {
  const supabase = await createClient()
  await requireEditorOrg()

  const broadcastId = String(formData.get('broadcast_id') ?? '')
  const { data: broadcastRow } = await supabase
    .from('broadcasts')
    .select('*')
    .eq('id', broadcastId)
    .maybeSingle()

  if (!broadcastRow) {
    redirect('/broadcasts?error=1&msg=Broadcast%20not%20found')
  }
  const recipients = mergeRecipients(
    await resolveAudience(supabase, broadcastRow.audience),
    (broadcastRow.custom_recipients ?? []) as string[]
  )
  const emails = recipients.map((r: { email: string }) => r.email)

  if (emails.length === 0) {
    redirect(`/broadcasts/${broadcastId}?error=1&msg=No%20recipients%20with%20an%20email`)
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('name, crm_config')
    .eq('id', broadcastRow.organization_id)
    .maybeSingle()
  const signature: EmailSignature | undefined = org?.crm_config?.signature
  const fromName = signature?.business_name || org?.name || 'Clancy'

  // Download every file once and reuse the buffers across BCC batches —
  // re-fetching per batch would multiply the transfer for no reason.
  const files = (broadcastRow.attachments ?? []) as BroadcastAttachment[]
  const attachments: MailAttachment[] = []
  const inlineImages: { src: string; alt: string }[] = []

  for (const [i, file] of files.entries()) {
    const { data: blob, error: downloadError } = await supabase.storage
      .from('broadcast-files')
      .download(file.path)
    if (downloadError || !blob) {
      redirect(
        `/broadcasts/${broadcastId}?error=1&msg=${encodeURIComponent(
          `Couldn't read attachment "${file.name}"`
        )}`
      )
    }
    const content = Buffer.from(await blob.arrayBuffer())
    const cid = file.inline ? cidFor(i) : undefined
    attachments.push({
      filename: file.name,
      content,
      contentType: file.type,
      cid,
    })
    if (cid) inlineImages.push({ src: `cid:${cid}`, alt: file.name })
  }

  // The signature logo is embedded too, so it renders in clients that block
  // remote images by default (Outlook, and Gmail with images off).
  // Only http(s) — the URL comes from workspace config, and a server-side
  // fetch of an arbitrary scheme/host is a needless hole to leave open.
  let logoCid: string | undefined
  if (signature?.logo_url && /^https?:\/\//i.test(signature.logo_url)) {
    try {
      const res = await fetch(signature.logo_url)
      if (res.ok) {
        logoCid = 'clancy-signature-logo'
        attachments.push({
          filename: 'logo',
          content: Buffer.from(await res.arrayBuffer()),
          contentType: res.headers.get('content-type') ?? 'image/png',
          cid: logoCid,
        })
      }
    } catch {
      // Fall back to the remote <img src> in the template.
    }
  }

  const html = renderBroadcastHtml({
    subject: broadcastRow.subject,
    body: broadcastRow.body,
    signature,
    inlineImages,
    logoCid,
  })
  const text = renderBroadcastText({
    body: broadcastRow.body,
    signature,
    attachments: files,
  })

  for (let i = 0; i < emails.length; i += 40) {
    const { ok, error } = await sendEmail({
      bcc: emails.slice(i, i + 40),
      subject: broadcastRow.subject,
      text,
      html,
      attachments,
      fromName,
    })
    if (!ok) {
      redirect(`/broadcasts/${broadcastId}?error=1&msg=${encodeURIComponent(error ?? 'send failed')}`)
    }
  }

  await supabase
    .from('broadcasts')
    .update({ status: 'sent', recipient_count: emails.length })
    .eq('id', broadcastId)

  revalidatePath('/broadcasts')
  redirect('/broadcasts?saved=1')
}
