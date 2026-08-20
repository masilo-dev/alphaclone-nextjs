interface MicrosoftMeetingEmbedProps {
  meetingLink: string;
  displayName: string;
}

export default function MicrosoftMeetingEmbed({
  meetingLink,
  displayName,
}: MicrosoftMeetingEmbedProps) {
  return (
    <div className="h-full w-full bg-slate-950">
      <iframe
        src={meetingLink}
        title={`Microsoft Teams meeting for ${displayName}`}
        className="h-full w-full border-0"
        allow="camera; microphone; fullscreen; display-capture"
      />
    </div>
  );
}
