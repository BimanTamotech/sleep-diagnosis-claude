import { authOptions } from '../auth/[...nextauth]'
import { getServerSession } from 'next-auth/next'
import { prisma } from '~/lib/prisma'

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions)
    if (!session) return res.status(401).send({ error: 'Unauthorized' })

    const { useremail } = req.query

    // Get all published questionnaires in creation order — same as getStaticProps
    const questionnaires = await prisma.questionnaire.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { order: 'asc' },
      select: { id: true },
    })

    const maxPage = questionnaires.length || 1

    const user = await prisma.user.findUnique({ where: { email: useremail } })
    if (!user) return res.status(200).json({ currentPage: 1, maxPage })

    // Find the last questionnaire section the user has any responses in
    let lastAnsweredIdx = -1
    for (let i = 0; i < questionnaires.length; i++) {
      const count = await prisma.response.count({
        where: {
          userId: user.id,
          question: { questionnaireId: questionnaires[i].id },
        },
      })
      if (count > 0) lastAnsweredIdx = i
      else break // stop at first unanswered section
    }

    // Send user to the next unanswered section, or keep on last section if all done
    const currentPage =
      lastAnsweredIdx < maxPage - 1 ? lastAnsweredIdx + 2 : maxPage

    return res.status(200).json({ currentPage, maxPage })
  } catch (error) {
    console.log('get page error', error)
    return res.status(500).send({ error: 'failed to get page' })
  }
}
