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

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

async function currentOrgId(): Promise<string> {
  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('organization_id')
    .single()

  if (error || !profile) {
    redirect('/login')
  }
  return profile.organization_id
}

export async function addClient(formData: FormData) {
  const supabase = await createClient()
  const organizationId = await currentOrgId()

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
