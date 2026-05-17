import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Questionnaire Builder',
  description: 'Create interactive questionnaires with branching logic, scoring, and custom design',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
