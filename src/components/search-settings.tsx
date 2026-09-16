'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { accountRequest, type AccountInfo } from '@/lib/account-client';
import { isStandalone } from '@/lib/client-api';

export function SearchSettings({ open, onOpenChange, account, onAccountChange, accountError, tabKeyActive, serverKeyConfigured, onApply, disabled }: {
  open: boolean; onOpenChange: (v: boolean) => void; account: AccountInfo | null; onAccountChange: (v: AccountInfo) => void; accountError: string; tabKeyActive: boolean; serverKeyConfigured: boolean; onApply: (key: string) => void; disabled: boolean;
}) {
  const [draft, setDraft] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const local = isStandalone();
  function valid() { if (!/^[\x21-\x7e]{8,512}$/.test(draft.trim())) { setError('OpenAlex에서 발급한 API 키를 입력하세요.'); return false; } return true; }
  function close(v: boolean) { if (busy) return; if (!v) { setDraft(''); setError(''); setMessage(''); } onOpenChange(v); }
  async function store(remove = false) {
    if (!remove && !valid()) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await accountRequest('/api/account/key', remove ? 'DELETE' : 'PUT', remove ? undefined : { apiKey: draft.trim() });
      if (account) onAccountChange({ ...account, hasSavedKey: !remove });
      if (!remove) { setDraft(''); onApply(''); }
      setMessage(remove ? '계정에 저장한 키를 삭제했습니다.' : '계정에 키를 저장했습니다. 다음 조회부터 자동으로 사용합니다.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={close}><DialogContent className="settings-dialog"><DialogHeader><DialogTitle>검색 설정과 계정 저장</DialogTitle><DialogDescription>무료 OpenAlex 개인 키로 본인의 조회 한도를 사용하세요.</DialogDescription></DialogHeader>
    {!local && <div className="account-box"><strong>{account?.user ? account.user.displayName : '사이트 계정'}</strong><p>{account?.user ? account.user.email + ' · ChatGPT 계정 인증' : '즐겨찾기와 개인 키 저장에는 로그인이 필요합니다.'}</p>{!account?.user && <a href="/signin-with-chatgpt?return_to=%2F" target="_top">사이트 계정으로 로그인 ↗</a>}{accountError && <p className="error">{accountError}</p>}<small>Google 직접 로그인: 설정 대기 · 아직 연결되지 않았습니다.</small></div>}
    <ol className="settings-steps"><li><a href="https://openalex.org/settings/api" target="_blank" rel="noopener noreferrer">OpenAlex에서 무료 키 발급 ↗</a><p>OpenAlex에 로그인한 뒤 API 키를 복사하세요.</p></li><li>키를 입력하고 {local ? '‘이 탭에 적용’을 누르세요.' : '‘계정에 저장’ 또는 ‘이 탭에 적용’을 누르세요.'}</li></ol>
    <label htmlFor="openalex-key">OpenAlex API 키</label><Input id="openalex-key" type="password" autoComplete="off" spellCheck={false} value={draft} onChange={e => setDraft(e.target.value)} placeholder={account?.hasSavedKey ? '저장된 키 있음 · 변경할 때만 새 키 입력' : '발급받은 개인 키 붙여넣기'} maxLength={512} disabled={busy}/>
    <p className="field-hint">{local ? 'HTML 앱의 키는 이 탭의 메모리에만 보관하며 조회 시 OpenAlex로 직접 전송합니다. 새로고침하면 다시 입력해야 합니다.' : '계정에 저장한 키는 암호화해 보관하고 서버에서만 사용합니다. 원문 키는 화면에 다시 표시하지 않습니다. ‘이 탭에 적용’은 새로고침하면 해제됩니다.'} 키는 URL·CSV·즐겨찾기에 넣지 않습니다.</p>
    <p className="field-hint">현재: {tabKeyActive ? '이 탭의 개인 키 우선 사용' : account?.hasSavedKey ? '계정에 저장된 개인 키 사용' : serverKeyConfigured ? '서버 키 사용' : '키 없이 조회'}</p>
    <div className="settings-note">개인 키에도 사용 한도가 있습니다. 키 저장은 유효성 검증을 뜻하지 않으며, 실제 조회 시 키가 거절되면 오류가 표시됩니다.</div>
    {error && <p className="error" role="alert">{error}</p>}{message && <p className="field-hint" role="status">{message}</p>}
    <DialogFooter className="key-actions">{tabKeyActive && <Button variant="outline" disabled={disabled || busy} onClick={() => { onApply(''); setMessage('이 탭의 개인 키를 해제했습니다.'); }}>탭 키 해제</Button>}{account?.hasSavedKey && !local && <Button variant="outline" disabled={disabled || busy} onClick={() => store(true)}>저장된 키 삭제</Button>}<Button variant="outline" disabled={disabled || busy} onClick={() => { if (valid()) { onApply(draft.trim()); close(false); } }}>이 탭에 적용</Button>{!local && <Button disabled={disabled || busy || !account?.user || !account?.keyStorageReady} onClick={() => store()}>계정에 저장</Button>}</DialogFooter>
  </DialogContent></Dialog>;
}
