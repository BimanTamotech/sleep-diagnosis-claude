import Head from 'next/head'
import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/AppLayout'
import { useSession } from 'next-auth/react'
import { WaitingSpinner } from '@/components/WaitingSpinner'
import { LoadingDialog } from '@/components/LoadingDialog'
import { TestNav } from '@/components/TestNav'
import { QuestionPage } from '@/components/QuestionPage'
import toast, { Toaster } from 'react-hot-toast'
import { useRouter } from 'next/router'

export default function Diagnosis({ questionData, maxPage, sections = [] }) {
  const { data: session, status } = useSession()
  // console.log('diagnosis session', session, status)
  // console.log('diagnosis q data', questionData)
  const [userEmail, setUserEmail] = useState('')
  const [gettingCurrentPage, setGettingCurrentPage] = useState(true)
  const [loadingQuestions, setLoadingQuestions] = useState(true)
  const [submittingAnswers, setSubmittingAnswers] = useState(false)
  const [questions, setQuestions] = useState([])
  // const [questionPage, setQuestionPage] = useState(1)
  const [page, setPage] = useState(-1)
  const [answers, setAnswers] = useState({})
  const [allowSubmit, setAllowSubmit] = useState(false)
  // const status = 'loading'
  const router = useRouter()
  const { locale } = router
  useEffect(() => {
    if (status !== 'loading') {
      if (session?.user?.email) setUserEmail(session?.user?.email)
      else router.push('/login')
    }
  }, [status])
  useEffect(() => {
    const getCurrentPage = async (email) => {
      setGettingCurrentPage(true)
      try {
        const res = await fetch(`/api/page/${email}`)
        const data = await res.json()
        console.log('diagnosis effect page', data)
        setPage(data.currentPage)
        setGettingCurrentPage(false)
      } catch (error) {
        console.log('get page error', error)
        setGettingCurrentPage(false)
      }
    }
    if (userEmail) getCurrentPage(userEmail)
  }, [userEmail])
  useEffect(() => {
    const getQuestions = async (email, page) => {
      setLoadingQuestions(true)
      const res = await fetch(`/api/pageanswer/${email}?page=${page}`)
      const data = await res.json()
      // console.log('get answers', data)
      const questionPage = questionData
        .filter((q) => q.group_id === page)
        .sort((a, b) => a.order - b.order)
      if (data && data.length > 0) {
        data.forEach((a) => {
          const qIndex = questionPage.findIndex((r) => r._id === a.qid)
          if (qIndex !== -1) questionPage[qIndex].currentAnswer = a
        })
      }
      setQuestions(questionPage)
      const initialAnswers = {} // fetch answers from tcb later
      questionPage.forEach((q) => {
        initialAnswers[q._id] = {
          qid: q._id,
          group_id: q.group_id,
          psqiid: q.psqi,
          question: q.question,
          score: q.currentAnswer ? q.currentAnswer.score : null,
          answer: q.currentAnswer ? q.currentAnswer.answer : '',
        }
        if (q.currentAnswer) initialAnswers[q._id]._id = q.currentAnswer._id
        if (q.question_type === 'oneChoice')
          initialAnswers[q._id].selected = q.currentAnswer
            ? q.currentAnswer.selected
            : ''
      })
      setAnswers(initialAnswers)
      setLoadingQuestions(false)
    }
    if (userEmail && page !== -1) getQuestions(userEmail, page)
  }, [page])
  useEffect(() => {
    const unAnswered = Object.values(answers).filter(
      (a) =>
        !a.answer ||
        a.invalid ||
        (['1', '135', '3', '136', '94', '117', '118'].includes(
          // exactTime question with -- in the answer
          a.psqiid.toString()
        ) &&
          a.answer.includes('--'))
    )
    if (unAnswered.length > 0) setAllowSubmit(false)
    else setAllowSubmit(true)
  }, [answers])

  const prevPage = () => {
    if (page > 1) setPage(page - 1)
  }
  const nextPage = async () => {
    try {
      const body = {
        email: userEmail,
        answers: Object.values(answers).filter((newAnswer) => {
          // only update the updated answers
          const previousAnswer = questions.find(
            (q) => q._id === newAnswer.qid
          ).currentAnswer
          return previousAnswer
            ? newAnswer.answer !== previousAnswer?.answer ||
                newAnswer.score !== previousAnswer?.score
            : true
        }),
      }
      if (body.answers.length > 0) {
        setSubmittingAnswers(true)
        const res = await fetch(`/api/answers`, {
          method: 'POST',
          body: JSON.stringify(body),
          headers: {
            'Content-Type': 'application/json',
          },
        })
        console.log('submit result', res)
        setSubmittingAnswers(false)
        if (res.status === 200) {
          if (page < maxPage) setPage(page + 1)
          else router.push('/report')
        } else {
          toast.error(`Can not submit answers, please try again later`)
        }
      } else {
        if (page < maxPage) setPage(page + 1)
        else router.push('/report')
      }
    } catch (error) {
      console.log('submit error', error)
      toast.error(`Can not submit answers, please try again later`)
    }
  }
  return (
    <>
      <Head>
        <title>Diagnosis - Engineering Sleep</title>
      </Head>
      <AppLayout>
        {status === 'loading' || gettingCurrentPage ? (
          <WaitingSpinner />
        ) : (
          <>
            <Toaster />
            <LoadingDialog open={submittingAnswers} />
            <TestNav current={page} setPage={setPage} sections={sections} />
            <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 lg:py-0">
              <QuestionPage
                loadingQuestions={loadingQuestions}
                questions={questions}
                answers={answers}
                setAnswers={setAnswers}
                page={page}
                maxPage={maxPage}
                prevPage={prevPage}
                allowSubmit={allowSubmit}
                nextPage={nextPage}
                locale={locale}
                sectionTitle={sections[page - 1]?.title}
              />
            </main>
          </>
        )}
      </AppLayout>
    </>
  )
}

export async function getServerSideProps() {
  try {
    const { prisma } = await import('../../lib/prisma')

    // Fetch ALL published questionnaires — each becomes one page/section
    const questionnaires = await prisma.questionnaire.findMany({
      where: { status: 'PUBLISHED' },
      include: {
        questions: {
          include: { options: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    if (questionnaires.length === 0) {
      return { props: { questionData: [], maxPage: 1, sections: [] } }
    }

    // Build sections list (for nav titles)
    const sections = questionnaires.map((q) => ({ id: q.id, title: q.title }))

    // Flatten all questions — each questionnaire gets group_id = sectionIndex + 1
    const questionData = []
    questionnaires.forEach((questionnaire, sectionIdx) => {
      questionnaire.questions.forEach((q) => {
        const questionType = q.type === 'mcq' ? 'oneChoice' : (q.subType ?? 'freeText')
        const mapped = {
          _id: q.id,
          group_id: sectionIdx + 1,
          order: q.order,
          psqi: q.psqiId ?? q.id,
          question: q.text,
          question_cn: q.textCn ?? q.text,
          header: q.header ?? null,
          header_cn: q.headerCn ?? null,
          question_type: questionType,
        }

        if (q.type === 'mcq') {
          mapped.choice_list = {
            en: q.options.map((opt) => ({
              id: opt.id,
              title: opt.label,
              order: opt.order,
              score: opt.score ?? 0,
            })),
            zh: q.options.map((opt) => ({
              id: opt.id,
              title: opt.labelCn ?? opt.label,
              order: opt.order,
              score: opt.score ?? 0,
            })),
          }
        }

        questionData.push(mapped)
      })
    })

    const maxPage = questionnaires.length

    return {
      props: { questionData, maxPage, sections },
    }
  } catch (error) {
    console.warn('Failed to load questions from Prisma:', error.message)
    return {
      props: { questionData: [], maxPage: 1, sections: [] },
    }
  }
}

// export async function getServerSideProps(context) {
//   // Fetch data from external API
//   const session = await getSession(context)
//   // console.log('server session', session)
//   // let questions = null
//   if (session) {
//     // try {
//     //   const res = await getData('sd_question')
//     //   // console.log('mvc tcb res', res)
//     //   questions = res.data
//     // } catch (error) {
//     //   console.log('get guest error', error)
//     // }
//     // Pass data to the page via props
//     const { email } = session.user

//     return {
//       props: {
//         userEmail: email,
//       },
//     }
//   } else {
//     console.log('no session', session)
//     return {
//       redirect: {
//         destination: '/login',
//         permanent: false,
//       },
//     }
//   }
// }
