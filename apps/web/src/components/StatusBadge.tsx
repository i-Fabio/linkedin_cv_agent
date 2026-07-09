interface StatusBadgeProps {
  status: string;
  label?: string;
}

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  return <span className={`badge badge-${status}`}>{label ?? status}</span>;
}
