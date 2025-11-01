import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BarberAI | Your Virtual Barber',
  description:
    'BarberAI is a friendly virtual barber assistant that books appointments, shares advice, and keeps clients in the loop.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <main className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-3xl">{children}</div>
        </main>
      </body>
    </html>
  );
}
