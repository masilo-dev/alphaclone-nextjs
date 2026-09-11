import { IconBase } from '../IconBase';
import type { AlphaSvgProps } from '../types';

/** Trust — no card required */
export function TrustCardIcon(props: AlphaSvgProps) {
  return (
    <IconBase viewBox="0 0 24 24" className="alpha-icon--trust" {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 14.5h4" stroke="#6DE8E2" strokeWidth="1.8" strokeLinecap="round" />
    </IconBase>
  );
}

/** Trust — fast setup */
export function TrustClockIcon(props: AlphaSvgProps) {
  return (
    <IconBase viewBox="0 0 24 24" className="alpha-icon--trust" {...props}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v4.5l3 1.5" stroke="#6DE8E2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

/** Trust — cancel anytime */
export function TrustCancelIcon(props: AlphaSvgProps) {
  return (
    <IconBase viewBox="0 0 24 24" className="alpha-icon--trust" {...props}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 9l6 6M15 9l-6 6" stroke="#6DE8E2" strokeWidth="1.8" strokeLinecap="round" />
    </IconBase>
  );
}

/** Trust — secure */
export function TrustSecureIcon(props: AlphaSvgProps) {
  return (
    <IconBase viewBox="0 0 24 24" className="alpha-icon--trust" {...props}>
      <path
        d="M12 3.5l7 2.8v5.2c0 4.2-2.9 7.3-7 8.7-4.1-1.4-7-4.5-7-8.7V6.3L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9.8 12.1l1.6 1.6 3.2-3.4" stroke="#6DE8E2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

/** Check — pricing / list confirmation */
export function CheckIcon(props: AlphaSvgProps) {
  return (
    <IconBase viewBox="0 0 24 24" className="alpha-icon--check" {...props}>
      <circle cx="12" cy="12" r="9" fill="rgba(24,199,200,0.12)" stroke="#18C7C8" strokeWidth="1.7" />
      <path d="M8 12.2l2.6 2.6L16.2 9" stroke="#6DE8E2" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}
