import type React from "react"
import "@/app/globals.css"
import { ThemeProvider } from "@/components/theme-provider"

export const metadata = {
  title: "Compress PNG & JPG Images Without Quality Loss – ImageCompressor Pro",
  description:
    "Free online tool to compress your PNG and JPG images without quality loss. Fast, secure, and browser-based image optimization.",
  openGraph: {
    title: "Compress PNG & JPG Images Without Quality Loss – ImageCompressor Pro",
    description:
      "Free online tool to compress your PNG and JPG images without quality loss. Fast, secure, and browser-based image optimization.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ImageCompressor Pro",
      },
    ],
  },
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
