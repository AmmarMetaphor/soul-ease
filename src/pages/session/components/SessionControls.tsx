import { KeyboardIcon, MicIcon, MicOffIcon, PauseIcon, PlayIcon, SettingsIcon, StopIcon, TranscriptIcon, WaveIcon } from '@/components/ui/Icons';
import type { InteractionMode } from '@/data/types';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import type { ConversationState, MicPermissionState } from '@/realtime/types';

interface SessionControlsProps {
  conversation: ConversationState;
  micPermission: MicPermissionState;
  mode: InteractionMode;
  transcriptOpen: boolean;
  disabled?: boolean;
  onToggleMic: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onToggleMode: () => void;
  onToggleTranscript: () => void;
  onOpenSettings: () => void;
}

function ControlButton({
  label,
  active,
  danger,
  large,
  onClick,
  disabled,
  children,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  large?: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center gap-1.5 text-[11px] font-medium text-ink-500 transition-colors disabled:opacity-40',
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full ring-1 transition-all',
          large ? 'h-16 w-16' : 'h-12 w-12',
          danger
            ? 'bg-white text-danger-600 ring-danger-600/20 hover:bg-danger-100'
            : active
              ? 'bg-emerald-700 text-ivory-50 ring-emerald-700 shadow-soft'
              : 'bg-white text-ink-700 ring-ink-900/10 hover:bg-ivory-50',
        )}
      >
        {children}
      </span>
      <span className="hidden sm:block">{label}</span>
    </button>
  );
}

export function SessionControls({
  conversation,
  micPermission,
  mode,
  transcriptOpen,
  disabled,
  onToggleMic,
  onPause,
  onResume,
  onEnd,
  onToggleMode,
  onToggleTranscript,
  onOpenSettings,
}: SessionControlsProps) {
  const t = useT();
  const paused = conversation === 'paused';
  const micOn = micPermission === 'granted' && (conversation === 'listening' || conversation === 'speaking' || conversation === 'thinking');

  return (
    <div className="flex items-end justify-center gap-4 sm:gap-6" role="toolbar" aria-label="Session controls">
      <ControlButton label={transcriptOpen ? t('session.hideTranscript') : t('session.transcript')} active={transcriptOpen} onClick={onToggleTranscript}>
        <TranscriptIcon size={20} />
      </ControlButton>

      <ControlButton label={mode === 'audio' ? t('session.textMode') : t('session.voiceMode')} onClick={onToggleMode} disabled={disabled}>
        {mode === 'audio' ? <KeyboardIcon size={20} /> : <WaveIcon size={20} />}
      </ControlButton>

      <ControlButton label={micOn ? t('session.micOff') : t('session.mic')} active={micOn} large onClick={onToggleMic} disabled={disabled || paused}>
        {micOn ? <MicIcon size={26} /> : <MicOffIcon size={26} />}
      </ControlButton>

      <ControlButton label={paused ? t('session.resume') : t('session.pause')} active={paused} onClick={paused ? onResume : onPause} disabled={disabled}>
        {paused ? <PlayIcon size={20} /> : <PauseIcon size={20} />}
      </ControlButton>

      <ControlButton label={t('session.end')} danger onClick={onEnd} disabled={disabled}>
        <StopIcon size={18} />
      </ControlButton>

      <ControlButton label={t('session.settings')} onClick={onOpenSettings}>
        <SettingsIcon size={20} />
      </ControlButton>
    </div>
  );
}
