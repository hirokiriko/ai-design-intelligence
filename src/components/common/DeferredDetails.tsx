import { useState, type ReactNode } from 'react';

interface DeferredDetailsProps {
  children: ReactNode;
  className?: string;
  initiallyOpen?: boolean;
  summary: ReactNode;
  summaryClassName?: string;
  testId?: string;
}

export function DeferredDetails({
  children,
  className,
  initiallyOpen = false,
  summary,
  summaryClassName,
  testId,
}: DeferredDetailsProps) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);

  return (
    <details
      className={className}
      data-testid={testId}
      open={isOpen}
      onToggle={(event) => {
        setIsOpen(event.currentTarget.open);
      }}
    >
      <summary className={summaryClassName}>{summary}</summary>
      {isOpen ? children : null}
    </details>
  );
}
