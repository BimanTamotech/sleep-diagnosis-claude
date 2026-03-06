'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  createQuestion,
  updateQuestion,
  deleteQuestion,
  createOption,
  deleteOption,
  reorderQuestions,
} from '~/app/actions/cms'
import { useCacheInvalidation } from '~/hooks/useQueries'
import type { QuestionWithOptions, QuestionType } from '~/types'
import type { Option } from '@prisma/client'

interface QuestionEditorProps {
  questionnaireId: string
  initialQuestions: QuestionWithOptions[]
}

// ---------------------------------------------------------------------------
// Option row
// ---------------------------------------------------------------------------
interface OptionRowProps {
  questionId: string
  option: { id: string; label: string; value: string; score: number | null }
  onDelete: (id: string) => void
}

function OptionRow({ option, onDelete }: OptionRowProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-pagebg-100 px-3 py-1.5 text-sm">
      <span className="flex-1 truncate text-gray-700">{option.label}</span>
      <span className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-gray-400">
        {option.value}
      </span>
      {option.score !== null && (
        <span className="text-xs text-excellent-500">{option.score}</span>
      )}
      <button
        onClick={() => onDelete(option.id)}
        className="ml-1 text-gray-400 hover:text-verypoor-500"
        aria-label="Delete option"
      >
        ×
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add Option inline form
// ---------------------------------------------------------------------------
interface AddOptionFormProps {
  questionId: string
  onAdded: (option: Option) => void
}

function AddOptionForm({ questionId, onAdded }: AddOptionFormProps) {
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const [score, setScore] = useState('')
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim() || !value.trim()) return
    startTransition(async () => {
      const result = await createOption({
        questionId,
        label,
        value,
        score: score !== '' ? Number(score) : undefined,
      })
      if (result.success) {
        setLabel('')
        setValue('')
        setScore('')
        onAdded(result.data)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 pt-2">
      <input
        placeholder="Label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        disabled={pending}
        className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs placeholder:text-gray-400 focus:border-excellent-500 focus:outline-none"
      />
      <input
        placeholder="Value"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={pending}
        className="w-24 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs placeholder:text-gray-400 focus:border-excellent-500 focus:outline-none"
      />
      <input
        type="number"
        step="0.1"
        placeholder="Score"
        value={score}
        onChange={(e) => setScore(e.target.value)}
        disabled={pending}
        className="w-20 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs placeholder:text-gray-400 focus:border-excellent-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending || !label.trim() || !value.trim()}
        className="rounded-lg bg-excellent-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        {pending ? '…' : '+ Add'}
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Single question card
// ---------------------------------------------------------------------------
interface QuestionCardProps {
  question: QuestionWithOptions
  index: number
  onDeleted: () => void
  onOptionChanged: () => void
}

function QuestionCard({ question, onDeleted, onOptionChanged }: QuestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [editingText, setEditingText] = useState(false)
  const [text, setText] = useState(question.text)
  const [options, setOptions] = useState(question.options)
  const [pending, startTransition] = useTransition()

  // Sync local options when parent refreshes server data
  useEffect(() => {
    setOptions(question.options)
  }, [question.options])

  function saveText() {
    if (text === question.text) { setEditingText(false); return }
    startTransition(async () => {
      const result = await updateQuestion({ id: question.id, text })
      if (result.success) {
        setEditingText(false)
        toast.success('Saved.')
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleDelete() {
    if (!confirm('Delete this question and all its responses?')) return
    startTransition(async () => {
      const result = await deleteQuestion(question.id)
      if (result.success) {
        toast.success('Question deleted.')
        onDeleted()
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleDeleteOption(optId: string) {
    // Optimistically remove immediately
    setOptions((prev) => prev.filter((o) => o.id !== optId))
    startTransition(async () => {
      const result = await deleteOption(optId)
      if (result.success) {
        onOptionChanged()
      } else {
        // Roll back on failure
        setOptions(question.options)
        toast.error(result.error)
      }
    })
  }

  return (
    <div className={clsx('rounded-xl border border-gray-100 bg-pagebg-100 p-4 transition-opacity', pending && 'opacity-60')}>
      {/* Question header */}
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-excellent-500 text-xs font-bold text-white">
          {question.order + 1}
        </span>
        <div className="flex-1 min-w-0">
          {editingText ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={saveText}
                onKeyDown={(e) => e.key === 'Enter' && saveText()}
                className="flex-1 rounded-lg border border-excellent-500 px-2.5 py-1 text-sm focus:outline-none"
              />
              <button onClick={saveText} className="text-xs text-excellent-500 font-medium">Save</button>
            </div>
          ) : (
            <p
              className="cursor-pointer text-sm font-medium text-gray-900 hover:text-excellent-500"
              onClick={() => setEditingText(true)}
              title="Click to edit"
            >
              {question.text}
            </p>
          )}
          <div className="mt-1 flex items-center gap-2">
            <span className={clsx(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              question.type === 'mcq' ? 'bg-excellent-50 text-excellent-500' : 
              question.type === 'calendar' ? 'bg-blue-50 text-blue-500' :
              question.type === 'time' ? 'bg-purple-50 text-purple-500' :
              'bg-fair-50 text-fair-500',
            )}>
              {question.type === 'mcq' ? 'Multiple Choice' : 
               question.type === 'calendar' ? 'Date Picker' :
               question.type === 'time' ? 'Time Picker' :
               'Free Text'}
            </span>
            {question.isRequired && (
              <span className="text-xs text-gray-400">Required</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {question.type === 'mcq' && (
            <button
              onClick={() => setIsExpanded((v) => !v)}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-white"
            >
              {isExpanded ? 'Hide options' : `Options (${options.length})`}
            </button>
          )}
          <button
            onClick={handleDelete}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-verypoor-500 ring-1 ring-verypoor-500 hover:bg-verypoor-50"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Options panel */}
      {question.type === 'mcq' && isExpanded && (
        <div className="ml-9 mt-3 space-y-1.5">
          {options.map((opt) => (
            <OptionRow
              key={opt.id}
              questionId={question.id}
              option={opt}
              onDelete={handleDeleteOption}
            />
          ))}
          <AddOptionForm
            questionId={question.id}
            onAdded={(newOpt) => {
              setOptions((prev) => [...prev, newOpt])
              onOptionChanged()
            }}
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Draggable wrapper for QuestionCard
// ---------------------------------------------------------------------------
function DraggableQuestionCard(props: QuestionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.question.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="relative">
      <button
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1/2 -translate-y-1/2 cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing z-10"
        aria-label="Drag to reorder"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
        </svg>
      </button>
      <div className="pl-6">
        <QuestionCard {...props} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add Question form
// ---------------------------------------------------------------------------
interface AddQuestionFormProps {
  questionnaireId: string
  nextOrder: number
  onAdded: () => void
}

function AddQuestionForm({ questionnaireId, nextOrder, onAdded }: AddQuestionFormProps) {
  const [text, setText] = useState('')
  const [type, setType] = useState<QuestionType>('mcq')
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    startTransition(async () => {
      const result = await createQuestion({
        questionnaireId,
        text,
        type,
        order: nextOrder,
      })
      if (result.success) {
        setText('')
        setType('mcq')
        setOpen(false)
        onAdded()
      } else {
        toast.error(result.error)
      }
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm font-medium text-gray-500 hover:border-excellent-300 hover:text-excellent-500 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
        </svg>
        Add Question
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border-2 border-dashed border-excellent-300 p-4 space-y-3">
      <textarea
        autoFocus
        rows={2}
        placeholder="Question text…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={pending}
        className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-excellent-500 focus:outline-none"
      />
      <div className="flex items-center gap-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as QuestionType)}
          disabled={pending}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-excellent-500 focus:outline-none"
        >
          <option value="mcq">Multiple Choice</option>
          <option value="text">Free Text</option>
          <option value="calendar">Date Picker</option>
          <option value="time">Time Picker</option>
        </select>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 ring-1 ring-gray-200 hover:bg-pagebg-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || !text.trim()}
            className="rounded-lg bg-excellent-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {pending ? 'Adding…' : 'Add Question'}
          </button>
        </div>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Main QuestionEditor
// ---------------------------------------------------------------------------
export function QuestionEditor({ questionnaireId, initialQuestions }: QuestionEditorProps) {
  const [questions, setQuestions] = useState(initialQuestions)
  const [reorderedQuestions, setReorderedQuestions] = useState<typeof initialQuestions | null>(null)
  const { invalidateQuestionnaire } = useCacheInvalidation()
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Sync local state when router.refresh() delivers updated server data
  useEffect(() => {
    setQuestions(initialQuestions)
  }, [initialQuestions])

  function refresh() {
    invalidateQuestionnaire(questionnaireId)
    setReorderedQuestions(null)
    // Re-fetch Server Component data without a full page reload
    router.refresh()
  }

  const displayQuestions = reorderedQuestions || questions

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = displayQuestions.findIndex((q) => q.id === active.id)
      const newIndex = displayQuestions.findIndex((q) => q.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(displayQuestions, oldIndex, newIndex)
        const orderedIds = newOrder.map((q) => q.id)
        
        setReorderedQuestions(newOrder)
        
        startTransition(async () => {
          const result = await reorderQuestions(questionnaireId, orderedIds)
          if (result.success) {
            toast.success('Questions reordered.')
            refresh()
          } else {
            toast.error(result.error)
            setReorderedQuestions(null)
          }
        })
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className={clsx('space-y-3', pending && 'opacity-70 pointer-events-none')}>
        {displayQuestions.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">
            No questions yet. Add the first one below.
          </p>
        ) : (
          <SortableContext
            items={displayQuestions.map((q) => q.id)}
            strategy={verticalListSortingStrategy}
          >
            {displayQuestions.map((q) => (
              <DraggableQuestionCard
                key={q.id}
                question={q}
                index={0}
                onDeleted={refresh}
                onOptionChanged={refresh}
              />
            ))}
          </SortableContext>
        )}
        <AddQuestionForm
          questionnaireId={questionnaireId}
          nextOrder={displayQuestions.length}
          onAdded={refresh}
        />
      </div>
    </DndContext>
  )
}
