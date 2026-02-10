import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Logquim Manutenção',
  description: 'OS + Estoque + Produtividade',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
