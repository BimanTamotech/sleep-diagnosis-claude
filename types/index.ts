// ===========================================================================
// Shared TypeScript types — Sleep Diagnosis CMS
// ===========================================================================

import type {
  User,
  Questionnaire,
  Question,
  Option,
  Response,
  Role,
  QuestionType,
  QuestionnaireStatus,
} from '@prisma/client'

// Re-export Prisma enums for convenience
export { Role, QuestionType, QuestionnaireStatus }

// ---------------------------------------------------------------------------
// Extended / nested types used across the app
// ---------------------------------------------------------------------------

export type QuestionWithOptions = Question & {
  options: Option[]
}

export type QuestionnaireWithQuestions = Questionnaire & {
  questions: QuestionWithOptions[]
}

export type ResponseWithDetails = Response & {
  question: Question
  option: Option | null
  user: Pick<User, 'id' | 'email' | 'name'>
}

export type UserWithResponses = User & {
  responses: ResponseWithDetails[]
}

/** Shape returned by GET /api/users/[userId] (used by UserDashboard). */
export interface UserDetailResponse {
  id: string
  email: string
  name: string | null
  image: string | null
  is_premium: boolean
  role: Role
  createdAt: string
  updatedAt: string
  responses: Array<{
    id: string
    score: number | null
    textAnswer: string | null
    updatedAt: string
    question: {
      id: string
      text: string
      type: string
      order: number
      questionnaireId: string
      questionnaire: { title: string; slug: string }
    }
    option: { label: string; value: string; score: number | null } | null
  }>
}

// ---------------------------------------------------------------------------
// Server Action return types
// ---------------------------------------------------------------------------

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

// ---------------------------------------------------------------------------
// CMS form payloads
// ---------------------------------------------------------------------------

export interface CreateQuestionnairePayload {
  title: string
  slug: string
  description?: string
  status?: QuestionnaireStatus
}

export interface UpdateQuestionnairePayload {
  id: string
  title?: string
  slug?: string
  description?: string
  status?: QuestionnaireStatus
}

export interface CreateQuestionPayload {
  questionnaireId: string
  text: string
  type: QuestionType
  order?: number  // optional; if not provided, will be auto-assigned
  isRequired?: boolean
  options?: Array<{ label: string; value: string; score?: number; order?: number }>
  // Calendar widget configuration (for type === 'calendar')
  calendarMinYear?: number
  calendarMaxYear?: number
  calendarMinMonth?: number
  calendarMaxMonth?: number
  calendarMinDate?: number
  calendarMaxDate?: number
  // Time picker configuration (for type === 'time')
  minHours?: number
  maxHours?: number
}

export interface UpdateQuestionPayload {
  id: string
  text?: string
  type?: QuestionType
  order?: number
  isRequired?: boolean
  // Calendar widget configuration
  calendarMinYear?: number
  calendarMaxYear?: number
  calendarMinMonth?: number
  calendarMaxMonth?: number
  calendarMinDate?: number
  calendarMaxDate?: number
  // Time picker configuration
  minHours?: number
  maxHours?: number
}

export interface CreateOptionPayload {
  questionId: string
  label: string
  value: string
  score?: number
  order?: number
}

// ---------------------------------------------------------------------------
// API response shapes (what Route Handlers return as JSON)
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface QuestionnaireListItem {
  id: string
  title: string
  slug: string
  description: string | null
  status: QuestionnaireStatus
  _count: { questions: number }
  createdAt: string
  updatedAt: string
}

export interface UserListItem {
  id: string
  email: string
  name: string | null
  is_premium: boolean
  role: Role
  _count: { responses: number }
  createdAt: string
}

// ---------------------------------------------------------------------------
// CSV export row shape
// ---------------------------------------------------------------------------

export interface ExportRow {
  userId: string
  userEmail: string
  userName: string
  questionnaireTitle: string
  questionText: string
  questionType: string
  answer: string
  score: number | null
  answeredAt: string
}
