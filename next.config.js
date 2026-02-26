/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    scrollRestoration: true,
  },
  // i18n only applies to Pages Router routes (src/pages/).
  // App Router routes in app/ are unaffected and won't receive locale prefixes.
  i18n: {
    locales: ['en', 'zh'],
    defaultLocale: 'en',
  },
  webpack: (config, { isServer }) => {
    // Prevent inlining DB URLs so runtime uses container env (e.g. docker-compose DATABASE_URL)
    if (isServer) {
      const definePlugin = config.plugins.find((p) => p.constructor?.name === 'DefinePlugin')
      if (definePlugin?.definitions) {
        delete definePlugin.definitions['process.env.DATABASE_URL']
        delete definePlugin.definitions['process.env.DATABASE_URL_UNPOOLED']
      }
    }
    return config
  },
}

module.exports = nextConfig
