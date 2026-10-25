export function relativeTime(iso: string, now = Date.now()) {
  const date = new Date(iso);
  const diff = Math.max(0, now - date.getTime());
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date(now).getFullYear() ? undefined : "numeric",
  });
}

export function absoluteTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function priorityLabel(priority: number) {
  switch (priority) {
    case 1:
      return "Min";
    case 2:
      return "Low";
    case 4:
      return "High";
    case 5:
      return "Max";
    default:
      return null;
  }
}

export function priorityColor(priority: number) {
  switch (priority) {
    case 1:
      return "bg-zinc-600";
    case 2:
      return "bg-sky-500";
    case 4:
      return "bg-amber-400";
    case 5:
      return "bg-red-500";
    default:
      return "bg-zinc-500";
  }
}

export function priorityTextColor(priority: number) {
  switch (priority) {
    case 1:
      return "text-zinc-400";
    case 2:
      return "text-sky-400";
    case 4:
      return "text-amber-400";
    case 5:
      return "text-red-400";
    default:
      return "text-zinc-500";
  }
}
