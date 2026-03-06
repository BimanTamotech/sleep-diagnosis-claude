'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '~/lib/prisma'
import type {
  ActionResult,
  CreateQuestionnairePayload,
  UpdateQuestionnairePayload,
  CreateQuestionPayload,
  UpdateQuestionPayload,
  CreateOptionPayload,
} from '~/types'
import type {
  Questionnaire,
  Question,
  Option,
} from '@prisma/client'
import { QuestionnaireStatus } from '@prisma/client'

// ===========================================================================
// QUESTIONNAIRE ACTIONS
// ===========================================================================

/**
 * Create a new questionnaire.
 */
export async function createQuestionnaire(
  payload: CreateQuestionnairePayload,
): Promise<ActionResult<Questionnaire>> {
  try {
    const existing = await prisma.questionnaire.findUnique({
      where: { slug: payload.slug },
    })
    if (existing) {
      return { success: false, error: `Slug "${payload.slug}" is already in use.` }
    }

    // Auto-assign order as max(existing orders) + 1
    const maxOrderQuestionnaire = await prisma.questionnaire.findFirst({
      orderBy: { order: 'desc' },
      select: { order: true },
    })
    const order = (maxOrderQuestionnaire?.order ?? -1) + 1

    const questionnaire = await prisma.questionnaire.create({
      data: {
        title: payload.title,
        slug: payload.slug,
        description: payload.description ?? null,
        status: payload.status ?? QuestionnaireStatus.DRAFT,
        order,
      },
    })

    revalidatePath('/cms/questionnaires')
    return { success: true, data: questionnaire }
  } catch (err) {
    console.error('[createQuestionnaire]', err)
    return { success: false, error: 'Failed to create questionnaire.' }
  }
}

/**
 * Update an existing questionnaire's metadata.
 * Bumps the version number on every update.
 */
export async function updateQuestionnaire(
  payload: UpdateQuestionnairePayload,
): Promise<ActionResult<Questionnaire>> {
  try {
    if (payload.slug) {
      const conflict = await prisma.questionnaire.findFirst({
        where: { slug: payload.slug, NOT: { id: payload.id } },
      })
      if (conflict) {
        return { success: false, error: `Slug "${payload.slug}" is already in use.` }
      }
    }

    const questionnaire = await prisma.questionnaire.update({
      where: { id: payload.id },
      data: {
        ...(payload.title !== undefined && { title: payload.title }),
        ...(payload.slug !== undefined && { slug: payload.slug }),
        ...(payload.description !== undefined && { description: payload.description }),
        ...(payload.status !== undefined && { status: payload.status }),
        version: { increment: 1 },
      },
    })

    revalidatePath('/cms/questionnaires')
    revalidatePath(`/cms/questionnaires/${payload.id}`)
    return { success: true, data: questionnaire }
  } catch (err) {
    console.error('[updateQuestionnaire]', err)
    return { success: false, error: 'Failed to update questionnaire.' }
  }
}

/**
 * Delete a questionnaire and cascade-delete its questions, options, and responses.
 */
export async function deleteQuestionnaire(
  id: string,
): Promise<ActionResult> {
  try {
    await prisma.questionnaire.delete({ where: { id } })
    revalidatePath('/cms/questionnaires')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[deleteQuestionnaire]', err)
    return { success: false, error: 'Failed to delete questionnaire.' }
  }
}

/**
 * Publish a draft questionnaire (convenience wrapper).
 */
export async function publishQuestionnaire(id: string): Promise<ActionResult<Questionnaire>> {
  return updateQuestionnaire({ id, status: QuestionnaireStatus.PUBLISHED })
}

/**
 * Archive a published questionnaire.
 */
export async function archiveQuestionnaire(id: string): Promise<ActionResult<Questionnaire>> {
  return updateQuestionnaire({ id, status: QuestionnaireStatus.ARCHIVED })
}

/**
 * Reorder questionnaires in bulk.
 * Accepts an ordered array of questionnaire IDs; assigns order 0, 1, 2 … etc.
 */
export async function reorderQuestionnaires(
  orderedIds: string[],
): Promise<ActionResult> {
  try {
    await prisma.$transaction(
      orderedIds.map((id, idx) =>
        prisma.questionnaire.update({ where: { id }, data: { order: idx } }),
      ),
    )

    revalidatePath('/cms/questionnaires')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[reorderQuestionnaires]', err)
    return { success: false, error: 'Failed to reorder questionnaires.' }
  }
}

// ===========================================================================
// QUESTION ACTIONS
// ===========================================================================

/**
 * Create a question (with optional inline options for MCQ).
 * If order is not provided, it will be automatically assigned as max(existing orders) + 1.
 */
export async function createQuestion(
  payload: CreateQuestionPayload,
): Promise<ActionResult<Question>> {
  try {
    // Auto-calculate order if not provided
    let order = payload.order
    if (order === undefined) {
      const maxOrderQuestion = await prisma.question.findFirst({
        where: { questionnaireId: payload.questionnaireId },
        orderBy: { order: 'desc' },
        select: { order: true },
      })
      order = (maxOrderQuestion?.order ?? -1) + 1
    }

    const question = await prisma.question.create({
      data: {
        questionnaireId: payload.questionnaireId,
        text: payload.text,
        type: payload.type,
        order,
        isRequired: payload.isRequired ?? true,
        // Calendar configuration
        calendarMinYear: payload.calendarMinYear ?? null,
        calendarMaxYear: payload.calendarMaxYear ?? null,
        calendarMinMonth: payload.calendarMinMonth ?? null,
        calendarMaxMonth: payload.calendarMaxMonth ?? null,
        calendarMinDate: payload.calendarMinDate ?? null,
        calendarMaxDate: payload.calendarMaxDate ?? null,
        // Time picker configuration
        minHours: payload.minHours ?? null,
        maxHours: payload.maxHours ?? null,
        options:
          payload.type === 'mcq' && payload.options?.length
            ? {
                create: payload.options.map((opt, idx) => ({
                  label: opt.label,
                  value: opt.value,
                  score: opt.score ?? null,
                  order: opt.order ?? idx,
                })),
              }
            : undefined,
      },
    })

    revalidatePath(`/cms/questionnaires/${payload.questionnaireId}`)
    return { success: true, data: question }
  } catch (err) {
    console.error('[createQuestion]', err)
    return { success: false, error: 'Failed to create question.' }
  }
}

/**
 * Update a question's text, type, order, or widget configuration.
 */
export async function updateQuestion(
  payload: UpdateQuestionPayload,
): Promise<ActionResult<Question>> {
  try {
    const question = await prisma.question.update({
      where: { id: payload.id },
      data: {
        ...(payload.text !== undefined && { text: payload.text }),
        ...(payload.type !== undefined && { type: payload.type }),
        ...(payload.order !== undefined && { order: payload.order }),
        ...(payload.isRequired !== undefined && { isRequired: payload.isRequired }),
        // Calendar configuration
        ...(payload.calendarMinYear !== undefined && { calendarMinYear: payload.calendarMinYear }),
        ...(payload.calendarMaxYear !== undefined && { calendarMaxYear: payload.calendarMaxYear }),
        ...(payload.calendarMinMonth !== undefined && { calendarMinMonth: payload.calendarMinMonth }),
        ...(payload.calendarMaxMonth !== undefined && { calendarMaxMonth: payload.calendarMaxMonth }),
        ...(payload.calendarMinDate !== undefined && { calendarMinDate: payload.calendarMinDate }),
        ...(payload.calendarMaxDate !== undefined && { calendarMaxDate: payload.calendarMaxDate }),
        // Time picker configuration
        ...(payload.minHours !== undefined && { minHours: payload.minHours }),
        ...(payload.maxHours !== undefined && { maxHours: payload.maxHours }),
      },
    })

    const full = await prisma.question.findUnique({
      where: { id: payload.id },
      select: { questionnaireId: true },
    })

    revalidatePath(`/cms/questionnaires/${full?.questionnaireId}`)
    return { success: true, data: question }
  } catch (err) {
    console.error('[updateQuestion]', err)
    return { success: false, error: 'Failed to update question.' }
  }
}

/**
 * Delete a question and cascade its options and responses.
 */
export async function deleteQuestion(id: string): Promise<ActionResult> {
  try {
    const question = await prisma.question.findUnique({
      where: { id },
      select: { questionnaireId: true },
    })

    await prisma.question.delete({ where: { id } })

    if (question) {
      revalidatePath(`/cms/questionnaires/${question.questionnaireId}`)
    }
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[deleteQuestion]', err)
    return { success: false, error: 'Failed to delete question.' }
  }
}

/**
 * Reorder questions within a questionnaire in bulk.
 * Accepts an ordered array of question IDs; assigns order 0, 1, 2 … etc.
 */
export async function reorderQuestions(
  questionnaireId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  try {
    await prisma.$transaction(
      orderedIds.map((id, idx) =>
        prisma.question.update({ where: { id }, data: { order: idx } }),
      ),
    )

    revalidatePath(`/cms/questionnaires/${questionnaireId}`)
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[reorderQuestions]', err)
    return { success: false, error: 'Failed to reorder questions.' }
  }
}

// ===========================================================================
// OPTION ACTIONS
// ===========================================================================

/**
 * Add an option to an existing MCQ question.
 */
export async function createOption(
  payload: CreateOptionPayload,
): Promise<ActionResult<Option>> {
  try {
    const option = await prisma.option.create({
      data: {
        questionId: payload.questionId,
        label: payload.label,
        value: payload.value,
        score: payload.score ?? null,
        order: payload.order ?? 0,
      },
    })

    const q = await prisma.question.findUnique({
      where: { id: payload.questionId },
      select: { questionnaireId: true },
    })
    revalidatePath(`/cms/questionnaires/${q?.questionnaireId}`)
    return { success: true, data: option }
  } catch (err) {
    console.error('[createOption]', err)
    return { success: false, error: 'Failed to create option.' }
  }
}

/**
 * Delete an option by ID.
 */
export async function deleteOption(id: string): Promise<ActionResult> {
  try {
    const opt = await prisma.option.findUnique({
      where: { id },
      include: { question: { select: { questionnaireId: true } } },
    })

    await prisma.option.delete({ where: { id } })

    if (opt) {
      revalidatePath(`/cms/questionnaires/${opt.question.questionnaireId}`)
    }
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[deleteOption]', err)
    return { success: false, error: 'Failed to delete option.' }
  }
}

// ===========================================================================
// USER ACTIONS
// ===========================================================================

/**
 * Toggle a user's premium status.
 */
export async function toggleUserPremium(
  userId: string,
  is_premium: boolean,
): Promise<ActionResult<{ id: string; is_premium: boolean }>> {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { is_premium },
      select: { id: true, is_premium: true },
    })
    revalidatePath('/cms/users')
    return { success: true, data: user }
  } catch (err) {
    console.error('[toggleUserPremium]', err)
    return { success: false, error: 'Failed to update user.' }
  }
}
