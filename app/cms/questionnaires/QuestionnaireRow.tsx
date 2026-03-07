'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { QuestionnaireListItem } from '~/types'

const STATUS_LABELS = {
  DRAFT: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
  PUBLISHED: { label: 'Published', cls: 'bg-good-50 text-good-500' },
  ARCHIVED: { label: 'Archived', cls: 'bg-fair-50 text-fair-500' },
} as const

interface QuestionnaireRowProps {
  questionnaire: QuestionnaireListItem
  isPending: boolean
  onDelete: (id: string, title: string) => void
  onPublish: (id: string) => void
  onArchive: (id: string) => void
}

export function QuestionnaireRow({
  questionnaire: q,
  isPending,
  onDelete,
  onPublish,
  onArchive,
}: QuestionnaireRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: q.id })

  const st = STATUS_LABELS[q.status]

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={clsx(
        'transition-colors',
        isDragging && 'bg-excellent-50 opacity-70',
        !isDragging && 'hover:bg-pagebg-100',
        isPending && 'opacity-60'
      )}
    >
      <td
        className="px-4 py-3 text-gray-400 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <svg
          className="h-5 w-5"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path fillRule="evenodd" d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
        </svg>
      </td>
      <td className="max-w-xs py-3 pl-0 pr-4">
        <Link
          href={`/cms/questionnaires/${q.id}`}
          className="truncate text-sm font-medium text-gray-900 hover:text-excellent-500"
        >
          {q.title}
        </Link>
        {q.description && (
          <p className="truncate text-xs text-gray-400">{q.description}</p>
        )}
      </td>
      <td className="px-4 py-3 text-xs font-mono text-gray-500">{q.slug}</td>
      <td className="px-4 py-3 text-sm text-gray-700">{q._count.questions}</td>
      <td className="px-4 py-3">
        <span className={clsx('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold', st.cls)}>
          {st.label}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">
        {new Date(q.updatedAt).toLocaleDateString()}
      </td>
      <td className="py-3 pl-4 pr-6">
        <div className="flex items-center justify-end gap-2">
          <Link
            href={`/cms/questionnaires/${q.id}`}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-pagebg-100"
          >
            Edit
          </Link>
          {q.status === 'DRAFT' && (
            <button
              onClick={() => onPublish(q.id)}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-good-500 ring-1 ring-good-500 hover:bg-good-50"
            >
              Publish
            </button>
          )}
          {q.status === 'PUBLISHED' && (
            <button
              onClick={() => onArchive(q.id)}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-fair-500 ring-1 ring-fair-500 hover:bg-fair-50"
            >
              Archive
            </button>
          )}
          <button
            onClick={() => onDelete(q.id, q.title)}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-verypoor-500 ring-1 ring-verypoor-500 hover:bg-verypoor-50"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  )
}
