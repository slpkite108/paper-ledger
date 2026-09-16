import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { PublicationRange } from '../lib/publication-range';

export function PublicationRangeControls({ value, onChange, disabled }: { value: PublicationRange; onChange: (range: PublicationRange) => void; disabled: boolean }) {
  return <>{(['from', 'to'] as const).map(side => {
    const label = side === 'from' ? '시작' : '종료';
    const monthKey = side === 'from' ? 'fromMonth' : 'toMonth';
    return <div className="period-field" key={side}>
      <label htmlFor={'year-' + side}>{label} 연월</label>
      <div className="period-inputs">
        <Input id={'year-' + side} aria-label={label + ' 연도'} type="number" min="1000" max="2100" placeholder="전체 연도" value={value[side]} onChange={e => onChange({ ...value, [side]: e.target.value, [monthKey]: e.target.value ? value[monthKey] : '' })} disabled={disabled}/>
        <Select value={value[monthKey] || 'all'} onValueChange={month => onChange({ ...value, [monthKey]: month === 'all' ? '' : month })} disabled={disabled || !value[side]}>
          <SelectTrigger aria-label={label + ' 월'}><SelectValue/></SelectTrigger>
          <SelectContent><SelectItem value="all">전체 월</SelectItem>{Array.from({ length: 12 }, (_, i) => <SelectItem key={i} value={String(i + 1).padStart(2, '0')}>{i + 1}월</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>;
  })}</>;
}
