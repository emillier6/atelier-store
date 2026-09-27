import Link from "next/link";

type SectionHeaderProps = {
  title: string;
  meta?: string;
  action?: { label: string; href: string };
};

export function SectionHeader({ title, meta, action }: SectionHeaderProps) {
  return (
    <div className="container-page flex items-end justify-between gap-4 pb-6 md:pb-8">
      <div className="stack gap-1">
        <h2 className="type-title">{title}</h2>
        {meta && <p className="type-meta">{meta}</p>}
      </div>
      {action && (
        <Link href={action.href} className="link shrink-0 text-body-sm">
          {action.label}
        </Link>
      )}
    </div>
  );
}
