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
    redirect('/clients/new?error=1')
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
  redirect(`/clients/${clientId}?${error ? 'error=1' : 'saved=1'}`)
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
  redirect(`/clients/${clientId}/intake?${error ? 'error=1' : 'saved=1'}`)
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
