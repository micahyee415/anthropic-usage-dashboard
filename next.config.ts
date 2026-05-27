import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Prevent the page from being embedded in iframes
          { key: "X-Frame-Options", value: "DENY" },
          // Stop browsers from sniffing the MIME type
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Enable HSTS (only send over HTTPS; 1 year)
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Don't send referrer header to cross-origin requests
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Permissions Policy — disable features this dashboard doesn't use
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Content Security Policy — tightened for this dashboard
          // - default-src 'self': only load resources from same origin
          // - script-src 'self' 'unsafe-inline': Next.js needs inline scripts
          // - style-src 'self' 'unsafe-inline': Tailwind uses inline styles
          // - img-src 'self' data:: favicons use data: URIs
          // - connect-src 'self': API calls only to same origin
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "connect-src 'self'",
              "font-src 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
