import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Wallapop Assistant',
    template: '%s · Wallapop Assistant',
  },
  description:
    'Panel privado de gestión asistida por IA para vendedores con varias cuentas de Wallapop.',
  // Es una herramienta privada: no debe indexarse.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'oklch(0.985 0.004 70)' },
    { media: '(prefers-color-scheme: dark)', color: 'oklch(0.165 0.008 60)' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
