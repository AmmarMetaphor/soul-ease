import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Field';
import { useT } from '@/i18n';
import type { ProviderCapabilities } from '@/realtime/types';

interface AudioSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  capabilities: ProviderCapabilities | null;
  providerKind: string | null;
  /** Applies the chosen output device, when the browser allows it. */
  onSelectOutputDevice?: (deviceId: string) => void;
}

export function AudioSettingsSheet({
  open,
  onClose,
  capabilities,
  providerKind,
  onSelectOutputDevice,
}: AudioSettingsSheetProps) {
  const t = useT();
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const supportsOutputSelection =
    typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype && !!onSelectOutputDevice;

  useEffect(() => {
    if (!open || !navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => setOutputs(devices.filter((d) => d.kind === 'audiooutput')))
      .catch(() => setOutputs([]));
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('session.settings')}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium text-ink-700">{t('session.providerLabel')}</p>
          <p className="mt-1 text-sm text-ink-500">
            {providerKind === 'demo' ? 'Demo guide' : providerKind ?? '—'}
            {capabilities?.note ? ` — ${capabilities.note}` : ''}
          </p>
        </div>
        {supportsOutputSelection ? (
          <Select
            label={t('session.deviceLabel')}
            defaultValue="default"
            onChange={(e) => onSelectOutputDevice?.(e.target.value)}
          >
            <option value="default">System default</option>
            {outputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || d.deviceId.slice(0, 8)}
              </option>
            ))}
          </Select>
        ) : (
          <p className="text-sm text-ink-500">{t('session.deviceUnsupported')}</p>
        )}
      </div>
    </Dialog>
  );
}
