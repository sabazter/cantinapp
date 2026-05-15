/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval requerido por Next.js dev
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "font-src 'self'",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
            "frame-ancestors 'none'",
          ].join("; "),
        },
      ],
    },
  ],

  // Redirigir HTTP → HTTPS en producción
  async redirects() {
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/(.*)",
        has: [{ type: "header", key: "x-forwarded-proto", value: "http" }],
        destination: "https://:host/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
