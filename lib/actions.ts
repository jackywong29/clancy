'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .maybeSingle()

  if (!profile?.organization_id) {
    redirect('/no-access')
  }
  return profile.organization_id
}

export async function addClient(formData: FormData) {
  const supabase = await createClient()
  const organizationId = await requireOrg()

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
  await requireOrg()

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
  const organizationId = await requireOrg()

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
  await requireOrg()

  const clientId = String(formData.get('client_id') ?? '')
  if (clientId) {
    await supabase.from('clients').delete().eq('id', clientId)
  }

  revalidatePath('/pipeline')
  redirect('/pipeline')
}

export async function addStage(formData: FormData) {
  const supabase = await createClient()
  const organizationId = await requireOrg()

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
  await requireOrg()

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
  await requireOrg()

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

  if (profileId) {
    await supabase
      .from('profiles')
      .update({ organization_id: orgValue === '' ? null : orgValue })
      .eq('id', profileId)
  }

  revalidatePath('/team')
  redirect('/team?saved=1')
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
  await requireAdmin()
  const supabase = await createClient()

  const slug = String(formData.get('slug') ?? '')
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
  try {
    services = JSON.parse(text('services') || '[]')
    faq = JSON.parse(text('faq') || '[]')
    socials = JSON.parse(text('socials') || '[]')
    gallery = JSON.parse(text('gallery') || '[]')
  } catch {
    // keep empty on parse failure
  }

  const config = {
    name: text('name'),
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
    hero_image_url: text('hero_image_url') || null,
    book_label: text('book_label'),
    service_book_label: text('service_book_label'),
    book_message: text('book_message'),
    service_message: text('service_message'),
    services_title: text('services_title'),
    find_us_title: text('find_us_title'),
    faq_title: text('faq_title'),
    gallery_title: text('gallery_title'),
    gallery,
    about_title: text('about_title'),
    about_body: text('about_body'),
    about_image_url: text('about_image_url') || null,
    about_image_side: text('about_image_side') === 'right' ? 'right' : 'left',
    services,
    faq,
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

export async function moveClientStage(formData: FormData) {
  const supabase = await createClient()
  const clientId = String(formData.get('client_id') ?? '')
  const stageId = String(formData.get('stage_id') ?? '')

  if (clientId && stageId) {
    await supabase
      .from('clients')
      .update({ stage_id: stageId, updated_at: new Date().toISOString() })
      .eq('id', clientId)
  }

  revalidatePath('/pipeline')
}
