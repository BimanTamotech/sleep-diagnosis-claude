import { authOptions } from '../auth/[...nextauth]'
import { getServerSession } from 'next-auth/next'
import { prisma } from '~/lib/prisma'

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions)
    if (!session) return res.status(401).send({ error: 'Unauthorized' })

    const { useremail, page } = req.query
    // page is 1-based questionnaire section index
    const sectionIndex = page ? parseInt(page) - 1 : 0

    // Get all published questionnaires in order — same ordering as getStaticProps
    const questionnaires = await prisma.questionnaire.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { order: 'asc' },
      select: { id: true },
    })

    const questionnaire = questionnaires[sectionIndex]
    if (!questionnaire) return res.status(200).json([])

    const user = await prisma.user.findUnique({ where: { email: useremail } })
    if (!user) return res.status(200).json([])

    const responses = await prisma.response.findMany({
      where: {
        userId: user.id,
        question: { questionnaireId: questionnaire.id },
      },
      include: {
        option: true,
        question: true,
      },
    })

    // Transform to the format expected by the diagnosis page
    const data = responses.map((r) => ({
      _id: r.id,
      qid: r.questionId,
      group_id: sectionIndex + 1,
      psqiid: r.question.psqiId ?? r.questionId,
      question: r.question.text,
      score: r.score,
      answer: r.option?.label ?? r.textAnswer ?? '',
      selected: r.optionId ?? '',
    }))

    return res.status(200).json(data)
  } catch (error) {
    console.log('get pageanswer error', error)
    return res.status(500).send({ error: 'failed to fetch data' })
  }
}
