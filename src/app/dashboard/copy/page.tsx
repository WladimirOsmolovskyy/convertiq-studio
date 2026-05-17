import { PenLine } from 'lucide-react';
import { ComingSoon } from '../_components/ComingSoon';

export default function CopyPage() {
  return (
    <ComingSoon
      title="Copy"
      description="Draft taglines, landing-page copy, and campaign blurbs that sound like you."
      icon={<PenLine size={28} strokeWidth={1.5} />}
    />
  );
}
