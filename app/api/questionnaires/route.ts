import { NextResponse } from 'next/server'
import { prisma } from '~/lib/prisma'
import type { PaginatedResponse, QuestionnaireListItem } from '~/types'

// GET /api/questionnaires?page=1&pageSize=20&status=PUBLISHED
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)

  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get('pageSize') ?? '20')),
  )
  const status = searchParams.get('status') as
    | 'DRAFT'
    | 'PUBLISHED'
    | 'ARCHIVED'
    | null
  const search = searchParams.get('search') ?? ''

  const where = {
    ...(status && { status }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' as const } },
        { slug: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [total, questionnaires] = await Promise.all([
    prisma.questionnaire.count({ where }),
    prisma.questionnaire.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { questions: true } },
      },
      orderBy: { order: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  const data: QuestionnaireListItem[] = questionnaires.map((q) => ({
    ...q,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  }))

  const response: PaginatedResponse<QuestionnaireListItem> = {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }

  return NextResponse.json(response)
}
