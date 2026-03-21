/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // !! אזהרה: מתעלם משגיאות TS בזמן בילד
    ignoreBuildErrors: true,
  },
  eslint: {
    // מתעלם משגיאות ESLint בזמן בילד
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig