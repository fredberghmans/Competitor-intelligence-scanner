'use server'

import { revalidatePath } from 'next/cache'
import {
  createCompetitor,
  updateCompetitor,
  deleteCompetitor,
} from '@/lib/competitors'
import type { Competitor } from '@/lib/supabase/types'

export async function createCompetitorAction(formData: FormData) {
  const name = formData.get('name') as string
  const type = formData.get('type') as Competitor['type']
  const region = formData.get('region') as string
  const domains = JSON.parse((formData.get('domains') as string) || '[]')

  await createCompetitor({ name, type, region, domains })
  revalidatePath('/competitors')
}

export async function updateCompetitorAction(id: string, formData: FormData) {
  const name = formData.get('name') as string
  const type = formData.get('type') as Competitor['type']
  const region = formData.get('region') as string
  const domains = JSON.parse((formData.get('domains') as string) || '[]')

  await updateCompetitor(id, { name, type, region, domains })
  revalidatePath('/competitors')
  revalidatePath(`/competitors/${id}/edit`)
}

export async function deleteCompetitorAction(id: string) {
  await deleteCompetitor(id)
  revalidatePath('/competitors')
}
