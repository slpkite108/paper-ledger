'use client';
import { useSyncExternalStore } from 'react';
import { Check, Loader2, UserRound, AlertCircle } from 'lucide-react';
import { googleConnection, googleUser, subscribeGoogle } from '@/lib/google-store';

export function GoogleConnectionStatus({onOpen}: {onOpen: () => void}) {
  const connection = useSyncExternalStore(subscribeGoogle, googleConnection, () => 'disconnected');
  const user = useSyncExternalStore(subscribeGoogle, googleUser, () => null);
  const label = connection === 'restoring' ? 'Google 연결 복원 중' : connection === 'expired' ? 'Google 재연결 필요' : user ? 'Google 연결됨' : 'Google 미연결';
  const detail = user?.email || (connection === 'expired' ? '눌러서 다시 연결' : connection === 'restoring' ? '계정을 확인하고 있습니다' : '이 브라우저에 저장');
  return <div className="google-connection" role="status" aria-live="polite">
    <button type="button" className="google-connection-button" data-connection={connection} onClick={onOpen} title={`${label} · ${detail}`} aria-label={`${label}, ${detail}. Google 설정 열기`}>
      {connection === 'restoring' ? <Loader2 size={17} className="animate-spin"/> : connection === 'expired' ? <AlertCircle size={17}/> : user ? <Check size={17}/> : <UserRound size={17}/>}
      <span><strong>{label}</strong><small>{detail}</small></span>
    </button>
  </div>;
}
