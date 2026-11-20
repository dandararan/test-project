import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '../src/db.js'

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.ADMIN_INITIAL_PASSWORD
const name = process.env.ADMIN_NAME?.trim() || 'Talent Bridging Admin'

if (!email || !password || password.length < 12) {
  throw new Error('Set ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD (at least 12 characters) in .env.local first.')
}

const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
})

const created = await auth.api.signUpEmail({ body: { name, email, password } })
if (!created.user) throw new Error('Could not create the administrator account.')
console.info(`Administrator account created for ${created.user.email}. Remove ADMIN_INITIAL_PASSWORD from the environment.`)
await prisma.$disconnect()
