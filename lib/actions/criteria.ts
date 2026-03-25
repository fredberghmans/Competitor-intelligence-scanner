'use server'

import { revalidatePath } from 'next/cache'
import { createCriteria, updateCriteria, deleteCriteria } from '@/lib/criteria'
import type { CreateCriteriaInput, UpdateCriteriaInput } from '@/lib/criteria'

export async function createCriteriaAction(input: CreateCriteriaInput) {
  await createCriteria(input)
  revalidatePath('/criteria')
}

export async function updateCriteriaAction(id: string, input: UpdateCriteriaInput) {
  await updateCriteria(id, input)
  revalidatePath('/criteria')
}

export async function deleteCriteriaAction(id: string) {
  await deleteCriteria(id)
  revalidatePath('/criteria')
}
