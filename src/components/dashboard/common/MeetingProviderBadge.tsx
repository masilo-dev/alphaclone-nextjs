import {
  getMeetingProviderDisplay,
  resolveMeetingProvider,
  type MeetingProviderInput,
} from '@/services/instantMeetingService';

type MeetingProviderBadgeProps = {
  meeting: MeetingProviderInput;
};

export default function MeetingProviderBadge({ meeting }: MeetingProviderBadgeProps) {
  const provider = resolveMeetingProvider(meeting);
  const { label, className } = getMeetingProviderDisplay(provider);

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${className}`}
      title={`Meeting provider: ${label}`}
    >
      {label}
    </span>
  );
}
