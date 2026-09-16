'use client';
import { useState } from 'react';
import { Star, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { createFavorite, deleteFavorite, readFavorites } from '@/lib/account-client';
import { favoriteInputSchema, type Favorite, type FavoritePayload } from '@/lib/favorites';
import { isStandalone } from '@/lib/client-api';
import { kindLabels } from '@/lib/publications';
import { googleUser } from '@/lib/google-store';

export function AuthorFavorites({ payload, onRestore, disabled }: { payload: FavoritePayload; onRestore: (value: Favorite) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false); const [name, setName] = useState('');
  const [favorites, setFavorites] = useState<Favorite[]>([]); const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [deleting, setDeleting] = useState('');
  async function refresh() {
    setBusy(true); setError(''); setReady(false);
    try { setFavorites(await readFavorites()); setReady(true); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function save() {
    const parsed = favoriteInputSchema.safeParse({ name, payload });
    if (!parsed.success) { setError('목록 이름과 선택한 저자(1~100명), 조회 연도를 확인하세요.'); return; }
    setBusy(true); setError(''); setMessage('');
    try { const favorite = await createFavorite(parsed.data.name, parsed.data.payload); setFavorites(prev => [favorite, ...prev]); setName(''); setMessage('저자 목록과 조회 조건을 저장했습니다.'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true); setError(''); setMessage('');
    try { await deleteFavorite(id); setFavorites(prev => prev.filter(f => f.id !== id)); setDeleting(''); setMessage('즐겨찾기를 삭제했습니다.'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <><Button variant="outline" onClick={() => { setOpen(true); setMessage(''); setDeleting(''); void refresh(); }} disabled={disabled}><Star size={16}/>저자 즐겨찾기</Button>
    <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}><DialogContent className="favorites-dialog"><DialogHeader><DialogTitle>저자 목록 즐겨찾기</DialogTitle><DialogDescription>{isStandalone() ? googleUser() ? googleUser()!.email + '의 Google 저장소에 저장합니다.' : '이 브라우저에 저장합니다. Google 동기화는 검색 설정에서 계정을 연결하세요. 브라우저 데이터 삭제 시 이 기기의 즐겨찾기는 사라집니다.' : '현재 로그인한 사이트 계정에 저장합니다. 같은 계정으로 다시 열면 불러올 수 있습니다.'}</DialogDescription></DialogHeader>
      <div className="favorite-save"><label htmlFor="favorite-name">현재 선택 {payload.authors.length}명 저장</label><div><Input id="favorite-name" value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder="예: 연구실 참여교수" disabled={busy}/><Button onClick={save} disabled={busy || !ready || !payload.authors.length || !name.trim()}>저장</Button></div><p className="field-hint">참여교수 표기명·기간·arXiv 제외·최신 1편·학술유형 조건을 함께 저장합니다. 논문 편집 내용은 CSV로 별도 저장하세요.</p></div>
      {busy && <p className="inline-status"><Loader2 size={16} className="animate-spin"/>저장소에 연결 중입니다.</p>}{error && <p className="error" role="alert">{error}</p>}{message && <p className="field-hint" role="status">{message}</p>}
      {!ready && !busy && <Button variant="outline" onClick={refresh}>다시 불러오기</Button>}
      <div className="favorites-list">{ready && !favorites.length && <p className="field-hint">저장된 목록이 없습니다. 저자를 선택한 뒤 목록 이름을 입력하세요.</p>}{favorites.map(f => <div className="favorite-row" key={f.id}><div><strong>{f.name}</strong><p>{f.payload.authors.map(a => f.payload.professorNames[a.id] || a.display_name).join(' · ')}</p><small>{f.payload.authors.length}명 · {f.payload.from || '전체'}–{f.payload.to || '전체'} · {f.payload.excludeArxiv ? 'arXiv 제외' : 'arXiv 포함'} · {f.payload.mergeLatest ? '최신 1편' : '중복 포함'} · {f.payload.publicationKind === 'all' ? '모든 유형' : kindLabels[f.payload.publicationKind]}</small></div><div className="favorite-actions"><Button variant="outline" size="sm" disabled={busy} onClick={() => { onRestore(f); setOpen(false); }}>불러오기</Button>{deleting === f.id ? <><Button variant="destructive" size="sm" disabled={busy} onClick={() => remove(f.id)}>삭제 확인</Button><Button variant="ghost" size="sm" onClick={() => setDeleting('')} disabled={busy}>취소</Button></> : <Button variant="ghost" size="icon" disabled={busy} aria-label={f.name + ' 즐겨찾기 삭제'} onClick={() => setDeleting(f.id)}><Trash2 size={16}/></Button>}</div></div>)}</div>
      <p className="field-hint">불러오면 현재 선택을 저장된 목록으로 바꿉니다. ‘선택 저자 논문 불러오기’를 눌러 최신 문헌을 조회하세요.</p>
    </DialogContent></Dialog></>;
}
