import { InlineNotice } from '@/components/ui/States';
import { useT } from '@/i18n';
import type { MicPermissionState, ProviderCapabilities } from '@/realtime/types';

interface MicNoticeProps {
  micPermission: MicPermissionState;
  capabilities: ProviderCapabilities | null;
  mode: 'audio' | 'text';
}

export function MicNotice({ micPermission, capabilities, mode }: MicNoticeProps) {
  const t = useT();
  if (mode !== 'audio') return null;

  if (micPermission === 'denied') {
    return (
      <InlineNotice tone="warn">
        <strong className="block">{t('session.micDeniedTitle')}</strong>
        {t('session.micDeniedBody')}
      </InlineNotice>
    );
  }
  if (micPermission === 'unavailable') {
    return (
      <InlineNotice tone="warn">
        <strong className="block">{t('session.micUnavailableTitle')}</strong>
        {t('session.micUnavailableBody')}
      </InlineNotice>
    );
  }
  if (capabilities && !capabilities.voiceInput) {
    return (
      <InlineNotice tone="neutral">
        <strong className="block">{t('session.unsupportedTitle')}</strong>
        {t('session.unsupportedBody')}
      </InlineNotice>
    );
  }
  return null;
}
