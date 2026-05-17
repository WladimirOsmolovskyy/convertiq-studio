

interface TextInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
}

export function TextInput({ label, value, onChange }: TextInputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
      <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--app-text)' }}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          backgroundColor: 'var(--app-bg)',
          border: '1px solid var(--app-border)',
          borderRadius: '6px',
          padding: '0.5rem 0.75rem',
          color: 'var(--app-text)',
          fontSize: '0.875rem',
          outline: 'none',
          transition: 'border-color 0.2s',
        }}
        onFocus={(e) => (e.target.style.borderColor = 'var(--app-accent)')}
        onBlur={(e) => (e.target.style.borderColor = 'var(--app-border)')}
      />
    </div>
  );
}
