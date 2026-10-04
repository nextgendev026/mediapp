'use client';

import { useState, useEffect, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';
import { EmptyState } from './EmptyState';

interface DataStateProps {
  isLoading: boolean;
  error: string | null;
  isEmpty: boolean;
  children: ReactNode;
  onRetry?: () => void;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  emptyStateIcon?: LucideIcon;
  loadingLabel?: string;
  className?: string;
}

export function DataState({
  isLoading,
  error,
  isEmpty,
  children,
  onRetry,
  emptyStateTitle = 'No data available',
  emptyStateDescription,
  emptyStateIcon,
  loadingLabel,
  className,
}: DataStateProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  if (isLoading) {
    return (
      <div
        className={cn(
          'transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0',
          className
        )}
        aria-busy="true"
      >
        <LoadingState label={loadingLabel} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          'transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0',
          className
        )}
      >
        <ErrorState message={error} onRetry={onRetry} />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div
        className={cn(
          'transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0',
          className
        )}
      >
        <EmptyState
          icon={emptyStateIcon ?? EmptyStateDefaultIcon}
          title={emptyStateTitle}
          description={emptyStateDescription}
          action={onRetry ? { label: 'Refresh', onClick: onRetry } : undefined}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0',
        className
      )}
    >
      {children}
    </div>
  );
}

function EmptyStateDefaultIcon(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
  );
}
