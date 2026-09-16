'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { connectGoogle, deleteGoogleKey, disconnectGoogle, googleUser, prepareGoogle, readGoogleKey, saveGoogleKey, subscribeGoogle } from '@/lib/google-store';

export function GoogleSettings({ open, onOpenChange, onApply, keyActive, disabled }: { open: boolean; onOpenChange: (v: boolean) => void; onApply: (key: string) => void; keyActive: boolean; disabled: boolean }) {
  const user = useSyncExternalStore(subscribeGoogle, googleUser, () => null);
  const [draft, setDraft] = useState(''); const [ready, setReady] = useState(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  async function prepare() { try { await prepareGoogle(); setReady(true); } catch (e) { setError((e as Error).message); } }
  useEffect(() => { if (window.location.protocol !== 'file:') void prepare(); }, []);
  const fileMode = typeof window !== 'undefined' && window.location.protocol === 'file:';
  function close(v: boolean) { if (busy) return; if (!v) { setDraft(''); setError(''); setMessage(''); } onOpenChange(v); }
  function valid() { if (!/^[\x21-\x7e]{8,512}$/.test(draft.trim())) { setError('OpenAlex에서 발급한 개인 API 키를 입력하세요.'); return false; } return true; }
  async function login() {
    setBusy(true); setError(''); setMessage(''); onApply('');
    try { await connectGoogle(); const key = await readGoogleKey(); onApply(key); setMessage(key ? 'Google 계정에 연결하고 저장된 개인 키를 적용했습니다.' : 'Google 계정에 연결했습니다. 즐겨찾기와 키를 계정에 저장할 수 있습니다.'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function store(remove = false) {
    if (!remove && !valid()) return;
    setBusy(true); setError(''); setMessage('');
    try { if (remove) { await deleteGoogleKey(); onApply(''); } else { await saveGoogleKey(draft.trim()); onApply(draft.trim()); setDraft(''); } setMessage(remove ? 'Google 저장소의 개인 키를 삭제했습니다.' : 'Google 저장소에 키를 저장하고 이 탭에 적용했습니다.'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={close}><DialogContent className="settings-dialog"><DialogHeader><DialogTitle>Google 계정과 검색 설정</DialogTitle><DialogDescription>Google 계정으로 즐겨찾기와 개인 API 키를 동기화합니다.</DialogDescription></DialogHeader>
    <div className="account-box"><strong>{user?.name || 'Google 계정'}</strong><p>{user?.email || 'Google 계정을 연결하면 즐겨찾기·프리셋·개인 키를 여러 기기에서 불러올 수 있습니다.'}</p><div className="record-actions"><Button variant="outline" disabled={!ready || fileMode || busy || disabled} onClick={login}>{user ? 'Google 계정 다시 연결' : 'Google 계정으로 연결'}</Button>{!ready && !fileMode && error && <Button variant="ghost" disabled={busy} onClick={() => { setError(''); void prepare(); }}>연결 준비 다시 시도</Button>}{user && <Button variant="ghost" disabled={busy} onClick={() => { disconnectGoogle(); onApply(''); setMessage('Google 연결과 이 탭의 키를 해제했습니다.'); }}>연결 종료</Button>}</div><small>{fileMode ? 'Google 연결은 GitHub Pages의 HTTPS 주소에서 사용할 수 있습니다.' : user ? '저장 위치: 이 Google 계정의 앱 전용 저장소' : '현재 저장 위치: 이 브라우저'}</small></div>
    <p className="field-hint">Google Drive의 앱 전용 비공개 영역을 사용합니다. 이름·이메일과 이 앱의 저장 데이터만 사용하며, 일반 Drive 문서 접근 권한은 요청하지 않습니다. 새로고침 또는 연결 만료 후에는 다시 연결해 저장된 키를 불러오세요.</p>
    <label htmlFor="openalex-key">OpenAlex API 키</label><Input id="openalex-key" type="password" autoComplete="off" spellCheck={false} value={draft} onChange={e => setDraft(e.target.value)} maxLength={512} placeholder={user?.hasSavedKey ? '저장된 키 있음 · 변경할 키 입력' : '발급받은 개인 키 붙여넣기'} disabled={busy}/>
    <a className="field-hint" href="https://openalex.org/settings/api" target="_blank" rel="noopener noreferrer">OpenAlex에서 무료 키 발급 ↗</a><p className="field-hint">현재: {keyActive ? '개인 키 적용됨' : '키 없이 조회'}. ‘Google에 저장’을 누른 경우에만 개인 키를 Google Drive에 저장합니다. ‘이 탭에 적용’은 메모리에만 보관합니다. 원문 키를 HTML·GitHub·CSV·브라우저 저장소에 기록하지 않습니다.</p>
    {error && <p className="error" role="alert">{error}</p>}{message && <p className="field-hint" role="status">{message}</p>}
    <DialogFooter className="key-actions">{keyActive && <Button variant="outline" disabled={busy || disabled} onClick={() => onApply('')}>탭 키 해제</Button>}{user?.hasSavedKey && <Button variant="outline" disabled={busy || disabled} onClick={() => store(true)}>Google 키 삭제</Button>}<Button variant="outline" disabled={busy || disabled} onClick={() => { if (valid()) { onApply(draft.trim()); close(false); } }}>이 탭에 적용</Button><Button disabled={!user || busy || disabled} onClick={() => store()}>Google에 저장</Button></DialogFooter>
  </DialogContent></Dialog>;
}
