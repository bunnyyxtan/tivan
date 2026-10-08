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
export const IconActivity = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M3 12h4l2.5-6 5 12 2.5-6h4" />
  </Icon>
)
export const IconTag = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M4 4h7.5l8.5 8.5-7.5 7.5L4 11.5V4Z" />
    <circle cx="8.5" cy="8.5" r="1.5" />
  </Icon>
)
export const IconHelp = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 9.5a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6M12 17h.01" />
  </Icon>
)
export const IconCompass = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
  </Icon>
)
export const IconStar = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.3L12 16.3l-4.8 2.5.9-5.3-3.9-3.8 5.4-.8L12 4Z" />
  </Icon>
)
export const IconShare = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M12 15V4M8 8l4-4 4 4" />
    <path d="M6 12v6.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V12" />
  </Icon>
)
export const IconCheck = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M12 3.5 19 6v5.5c0 4.2-3 7.6-7 9-4-1.4-7-4.8-7-9V6l7-2.5Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Icon>
)
export const IconIn = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M17 7 7 17M7 9v8h8" />
  </Icon>
)
export const IconOut = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M7 17 17 7M9 7h8v8" />
  </Icon>
)
export const IconCamera = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
)
export const IconKeyboard = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <rect x="3" y="6.5" width="18" height="11" rx="2" />
    <path d="M7 10h.01M10 10h.01M13 10h.01M16 10h.01M7 13.5h.01M17 13.5h.01M10 13.5h4" />
  </Icon>
)
