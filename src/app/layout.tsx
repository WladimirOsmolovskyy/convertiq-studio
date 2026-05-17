import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Questionnaire Builder',
  description: 'Create interactive questionnaires with branching logic, scoring, and custom design',
};

const envBanner = (() => {
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (env === 'production') return null;
  const isStaging = env === 'preview';
  const color = isStaging ? '#ff8c00' : '#ff0000';
  const label = isStaging ? 'STAGING' : 'LOCAL';
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        border: `4px solid ${color}`,
        zIndex: 9999,
      }}
    >
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          background: color,
          color: 'white',
          padding: '4px 10px',
          fontSize: 12,
          fontFamily: 'monospace',
          borderRadius: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
})();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {envBanner}
      </body>
    </html>
  );
}
