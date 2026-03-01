"use client";

import { useNotificationCount } from "@/components/NotificationProvider";

export function NotificationBadge() {
  const { count } = useNotificationCount();

  return (
    <div className="relative flex h-8 w-8 items-center justify-center">
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
          {count}
        </span>
      ) : null}
      <span className="text-lg" aria-hidden="true">
        🔔
      </span>
      <span className="sr-only">{count} new notifications</span>
    </div>
  );
}
