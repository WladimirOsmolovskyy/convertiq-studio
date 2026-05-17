import { Palette } from 'lucide-react';
import { ComingSoon } from '../_components/ComingSoon';

export default function BrandPage() {
  return (
    <ComingSoon
      title="Brand"
      description="Generate a full brand stack — palette, type, logos, voice — from a single prompt."
      icon={<Palette size={28} strokeWidth={1.5} />}
    />
  );
}
