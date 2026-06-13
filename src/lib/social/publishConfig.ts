export function isSocialPublishEnabled(): boolean {
  const override = process.env.SOCIAL_PUBLISH_ENABLED;
  if (override === 'false') return false;
  return true;
}
