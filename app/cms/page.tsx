import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '~/lib/prisma'

export const metadata: Metadata = { title: 'Dashboard' }

// Avoid prerender at build time (no DB in Docker build); render at request time with runtime DATABASE_URL
export const dynamic = 'force-dynamic'

// Server Component — reads DB directly, no client JS needed
export default async function CMSDashboardPage() {
  const [totalQuestionnaires, totalUsers, totalResponses, recentQuestionnaires] =
    await Promise.all([
      prisma.questionnaire.count(),
      prisma.user.count(),
      prisma.response.count(),
      prisma.questionnaire.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          updatedAt: true,
          _count: { select: { questions: true } },
        },
      }),
    ])

  const stats = [
    {
      label: 'Questionnaires',
      value: totalQuestionnaires,
      href: '/cms/questionnaires',
      colorClass: 'bg-excellent-50 text-excellent-500',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
          <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 10.5a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      label: 'Total Users',
      value: totalUsers,
      href: '/cms/users',
      colorClass: 'bg-good-50 text-good-500',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
          <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 17a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" />
        </svg>
      ),
    },
    {
      label: 'Total Responses',
      value: totalResponses,
      href: '/cms/users',
      colorClass: 'bg-fair-50 text-fair-500',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
          <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
        </svg>
      ),
    },
  ]

  const statusColor: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    PUBLISHED: 'bg-good-50 text-good-500',
    ARCHIVED: 'bg-fair-50 text-fair-500',
  }

  return (
    <div className="space-y-8">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of your Sleep Diagnosis content.
          </p>
        </div>
        <Link
          href="/cms/questionnaires/new"
          className="inline-flex items-center gap-2 rounded-xl bg-excellent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
          New Questionnaire
        </Link>
      </div>

      {/* Stat cards */}
      <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="group flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md"
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${s.colorClass}`}>
              {s.icon}
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
                {s.label}
              </dt>
              <dd className="text-3xl font-display font-bold text-gray-900">
                {s.value.toLocaleString()}
              </dd>
            </div>
          </Link>
        ))}
      </dl>

      {/* Recent questionnaires */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Recent Questionnaires</h2>
          <Link
            href="/cms/questionnaires"
            className="text-sm font-medium text-excellent-500 hover:underline"
          >
            View all →
          </Link>
        </div>

        {recentQuestionnaires.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-400">No questionnaires yet.</p>
            <Link
              href="/cms/questionnaires/new"
              className="mt-3 inline-block text-sm font-medium text-excellent-500 hover:underline"
            >
              Create your first one →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {recentQuestionnaires.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/cms/questionnaires/${q.id}`}
                  className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-pagebg-100 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{q.title}</p>
                    <p className="text-xs text-gray-400">
                      {q._count.questions} question{q._count.questions !== 1 ? 's' : ''} ·{' '}
                      Updated {new Date(q.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor[q.status] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {q.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
