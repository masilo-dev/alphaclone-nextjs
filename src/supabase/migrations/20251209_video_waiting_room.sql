-- Add status column to call_participants to handle Waiting Room logic
ALTER TABLE public.call_participants 
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('waiting', 'approved', 'rejected', 'left')) DEFAULT 'waiting';

-- Ensure hosts are always approved
UPDATE public.call_participants SET status = 'approved' WHERE is_host = TRUE;

-- Add RLS policy: Participants can only update their own status (e.g. leaving) OR Admins/Host can update any status (admitting)
-- Actually, the "System can manage participants" policy in original file might be too broad or strict. 
-- Let's ensure Hosts can update participants for the call they own.

CREATE POLICY "Hosts can manage participants in their calls"
  ON public.call_participants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.video_calls
      WHERE video_calls.id = call_participants.call_id
      AND video_calls.host_id = auth.uid()
    )
  );
