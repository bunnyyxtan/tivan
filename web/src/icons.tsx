import type { ReactNode } from 'react'

// One icon family: 24px grid, 1.6 stroke, round caps and joins, currentColor. Nothing here is decorative.
const Icon = ({ children, size }: { children: ReactNode; size?: number }) => (
  <svg className="ico" viewBox="0 0 24 24" aria-hidden width={size} height={size}>
    {children}
  </svg>
)

export const IconMarkets = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </Icon>
)
export const IconCollection = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M12 4 3.5 8.5 12 13l8.5-4.5L12 4Z" />
    <path d="m3.5 12.5 8.5 4.5 8.5-4.5" />
    <path d="m3.5 16 8.5 4.5 8.5-4.5" />
  </Icon>
)
export const IconVault = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </Icon>
)
export const IconLeague = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
    <path d="M8 6H5a2 2 0 0 0 2 4M16 6h3a2 2 0 0 1-2 4" />
    <path d="M12 13v4M9 20h6" />
  </Icon>
)
export const IconYou = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
  </Icon>
)
export const IconSettings = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Icon>
)
export const IconSun = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="3.8" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
  </Icon>
)
export const IconColour = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M12 3.5c3.5 4 6 6.8 6 10a6 6 0 0 1-12 0c0-3.2 2.5-6 6-10Z" />
  </Icon>
)
export const IconMotion = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M3 12c2.5-6 4.5-6 6 0s3.5 6 6 0 3.5-6 6 0" />
  </Icon>
)
export const IconGrid = ({ size }: { size?: number }) => <IconMarkets size={size} />
export const IconList = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M4 6h2M4 12h2M4 18h2M9 6h11M9 12h11M9 18h11" />
  </Icon>
)
export const IconBell = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Icon>
)
export const IconClose = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)
export const IconChevron = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
)
export const IconSearch = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="11" cy="11" r="6" />
    <path d="m20 20-4.2-4.2" />
  </Icon>
)
