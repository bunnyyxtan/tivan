import type { ReactNode } from 'react'

// Shared loading, empty and error states. Skeletons match the geometry of what replaces them.

export const Skeleton = ({ h = 16, w = '100%', r = 8 }: { h?: number; w?: number | string; r?: number }) => <i className="sk" aria-hidden style={{ height: h, width: w, borderRadius: r }} />

export const ItemCardSkeleton = () => (
  <div className="item-card" aria-hidden>
    <div className="item-media">
      <i className="sk" style={{ width: '70%', aspectRatio: '600 / 825', borderRadius: 6 }} />
    </div>
    <div className="item-body">
      <Skeleton h={40} r={6} />
      <Skeleton h={14} w="60%" r={6} />
      <Skeleton h={66} r={6} />
    </div>
  </div>
)

export const RowSkeleton = () => (
  <div className="mrow" aria-hidden>
    <Skeleton h={62} w={44} r={6} />
    <div className="mrow-info">
      <Skeleton h={16} w="55%" r={6} />
      <Skeleton h={13} w="35%" r={6} />
    </div>
    <Skeleton h={38} w={92} r={6} />
  </div>
)

/** Nothing here, and why. One next step if there is one. */
export const Empty = ({ title, detail, action }: { title: string; detail?: ReactNode; action?: ReactNode }) => (
  <div className="state" role="status">
    <b>{title}</b>
    {detail && <p>{detail}</p>}
    {action}
  </div>
)

/** What happened, the known reason, and what to do next. */
export const ErrorNote = ({ what, why, next, onRetry }: { what: string; why?: string; next: string; onRetry?: () => void }) => (
  <div className="state state-error" role="alert">
    <b>{what}</b>
    <p>
      {why ? `${why.replace(/\.$/, '')}. ` : ''}
      {next}
    </p>
    {onRetry && (
      <button className="ghost line" onClick={onRetry}>
        Try again
      </button>
    )}
  </div>
)
