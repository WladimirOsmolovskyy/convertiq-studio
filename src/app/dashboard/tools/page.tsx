import { LayoutGrid } from 'lucide-react';
import { ComingSoon } from '../_components/ComingSoon';

export default function ToolsPage() {
  return (
    <ComingSoon
      title="Tools"
      description="Small, sharp utilities for the moments between the big jobs."
      icon={<LayoutGrid size={28} strokeWidth={1.5} />}
    />
  );
}
