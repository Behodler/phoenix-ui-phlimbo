import type { ContextBoxProps } from '../../types/vault';

export default function ContextBox({
  children,
  visible = true,
  className = ''
}: ContextBoxProps) {
  // Don't render if not visible
  if (!visible) {
    return null;
  }

  return (
    <div className={`phoenix-card p-6 ${className}`.trim()}>
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
}
