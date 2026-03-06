'use client'

import { useTransition, useState } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useQuestionnaires, useCacheInvalidation } from '~/hooks/useQueries'
import { useUIState } from '~/store/useUIState'
import {
  deleteQuestionnaire,
  publishQuestionnaire,
  archiveQuestionnaire,
  reorderQuestionnaires,
} from '~/app/actions/cms'
import { QuestionnaireRow } from './QuestionnaireRow'

const STATUS_LABELS = {
  DRAFT: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
  PUBLISHED: { label: 'Published', cls: 'bg-good-50 text-good-500' },
  ARCHIVED: { label: 'Archived', cls: 'bg-fair-50 text-fair-500' },
} as const

export function QuestionnaireListClient() {
  const {
    questionnaireSearch,
    questionnaireStatusFilter,
    questionnairePage,
    setQuestionnaireSearch,
    setQuestionnaireStatusFilter,
    setQuestionnairePage,
  } = useUIState()

  const { invalidateQuestionnaires } = useCacheInvalidation()
  const [isPending, startTransition] = useTransition()
  const [reorderedItems, setReorderedItems] = useState<typeof data.data | null>(null)

  const { data, isLoading, isError } = useQuestionnaires({
    page: questionnairePage,
    pageSize: 15,
    status: questionnaireStatusFilter,
    search: questionnaireSearch,
  })

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    startTransition(async () => {
      const result = await deleteQuestionnaire(id)
      if (result.success) {
        toast.success('Questionnaire deleted.')
        invalidateQuestionnaires()
      } else {
        toast.error(result.error)
      }
    })
  }

  function handlePublish(id: string) {
    startTransition(async () => {
      const result = await publishQuestionnaire(id)
      if (result.success) {
        toast.success('Questionnaire published.')
        invalidateQuestionnaires()
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleArchive(id: string) {
    startTransition(async () => {
      const result = await archiveQuestionnaire(id)
      if (result.success) {
        toast.success('Questionnaire archived.')
        invalidateQuestionnaires()
      } else {
        toast.error(result.error)
      }
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const displayItems = reorderedItems || data?.data || []
      const oldIndex = displayItems.findIndex((item) => item.id === active.id)
      const newIndex = displayItems.findIndex((item) => item.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(displayItems, oldIndex, newIndex)
        const orderedIds = newOrder.map((item) => item.id)
        
        setReorderedItems(newOrder)
        
        startTransition(async () => {
          const result = await reorderQuestionnaires(orderedIds)
          if (result.success) {
            toast.success('Questionnaires reordered.')
            invalidateQuestionnaires()
          } else {
            toast.error(result.error)
            setReorderedItems(null)
          }
        })
      }
    }
  }

  const displayItems = reorderedItems || data?.data || []

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          placeholder="Search by title or slug…"
          value={questionnaireSearch}
          onChange={(e) => setQuestionnaireSearch(e.target.value)}
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm placeholder:text-gray-400 focus:border-excellent-500 focus:outline-none focus:ring-1 focus:ring-excellent-500"
        />
        <select
          value={questionnaireStatusFilter}
          onChange={(e) =>
            setQuestionnaireStatusFilter(
              e.target.value as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | '',
            )
          }
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 focus:border-excellent-500 focus:outline-none focus:ring-1 focus:ring-excellent-500"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-excellent-500 border-t-transparent" />
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-sm text-verypoor-500">
            Failed to load questionnaires.
          </p>
        ) : displayItems.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-400">No questionnaires found.</p>
            <Link
              href="/cms/questionnaires/new"
              className="mt-2 inline-block text-sm font-medium text-excellent-500 hover:underline"
            >
              Create the first one →
            </Link>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-pagebg-100">
                <tr>
                  {['', 'Title', 'Slug', 'Questions', 'Status', 'Updated', ''].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 first:pl-6 last:pr-6"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                <SortableContext
                  items={displayItems.map((q) => q.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {displayItems.map((q) => (
                    <QuestionnaireRow
                      key={q.id}
                      questionnaire={q}
                      isPending={isPending}
                      onDelete={handleDelete}
                      onPublish={handlePublish}
                      onArchive={handleArchive}
                    />
                  ))}
                </SortableContext>
              </tbody>
            </table>
          </DndContext>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {data.total} questionnaire{data.total !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setQuestionnairePage(questionnairePage - 1)}
              disabled={questionnairePage <= 1}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-pagebg-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="flex items-center px-2 text-xs text-gray-500">
              {questionnairePage} / {data.totalPages}
            </span>
            <button
              onClick={() => setQuestionnairePage(questionnairePage + 1)}
              disabled={questionnairePage >= data.totalPages}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-pagebg-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
