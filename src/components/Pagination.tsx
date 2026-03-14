import Link from "next/link";
import type { ReactNode } from "react";

const baseButtonClass =
  "inline-flex items-center justify-center rounded-lg border px-3 py-1 text-sm font-medium transition";

function PaginationLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className={`${baseButtonClass} cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400`}
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`${baseButtonClass} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
    >
      {children}
    </Link>
  );
}

export function Pagination({
  page,
  totalPages,
  basePath,
}: {
  page: number;
  totalPages: number;
  basePath: string;
}) {
  const safeTotalPages = Math.max(totalPages, 1);
  const safePage = Math.min(Math.max(page, 1), safeTotalPages);

  const makeHref = (targetPage: number) =>
    targetPage <= 1 ? basePath : `${basePath}?page=${targetPage}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-slate-600">
      <PaginationLink href={makeHref(safePage - 1)} disabled={safePage <= 1}>
        Previous
      </PaginationLink>
      <span className="font-medium text-slate-700">Page {safePage} of {safeTotalPages}</span>
      <PaginationLink href={makeHref(safePage + 1)} disabled={safePage >= safeTotalPages}>
        Next
      </PaginationLink>
    </div>
  );
}
