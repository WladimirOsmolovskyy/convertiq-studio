

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
}

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const isHex = value.startsWith('#');
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
      <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--app-text)' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
         <span style={{ fontSize: '0.75rem', color: 'var(--app-text-muted)', fontFamily: 'monospace' }}>{value}</span>
         <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            overflow: 'hidden',
            border: '1px solid var(--app-border)',
            position: 'relative'
         }}>
           <input
             type={isHex ? "color" : "text"}
             value={value}
             onChange={(e) => onChange(e.target.value)}
             style={{
               position: 'absolute',
               inset: -5,
               width: 'calc(100% + 10px)',
               height: 'calc(100% + 10px)',
               cursor: 'pointer',
               border: 'none',
               padding: 0,
               background: !isHex ? value : 'transparent',
               color: 'transparent'
             }}
           />
         </div>
      </div>
    </div>
  );
}
