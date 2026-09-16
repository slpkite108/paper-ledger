import { MAX_REFERENCE_ROWS, referenceRowSchema, type Reference } from './criteria';

export const MAX_REFERENCE_BYTES=10_000_000;
export type ReferenceImportMode='mixed'|'scie';
// Excel copy/paste and quoted CSV, including embedded commas, tabs and newlines.
export function referenceTable(text:string):string[][] {
  if(text.length>MAX_REFERENCE_BYTES)throw new Error('기준표는 10MB 이하로 가져오세요.');
  const value=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  let quoted=false,delimiter=',';
  for(let i=0;i<value.length;i++) {if(value[i]==='"')quoted=!quoted;else if(!quoted&&value[i]==='\t'){delimiter='\t';break;}else if(!quoted&&value[i]==='\n')break;}
  const rows:string[][]=[];let row:string[]=[],cell='';quoted=false;
  for(let i=0;i<value.length;i++) {
    const ch=value[i];
    if(ch==='"'&&(quoted||cell==='')) {if(quoted&&value[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(!quoted&&(ch===delimiter||ch==='\n')) {row.push(cell);cell='';if(ch==='\n'){rows.push(row);row=[];}}
    else cell+=ch;
    if(rows.length>MAX_REFERENCE_ROWS+1)throw new Error('기준표는 최대 30,000행입니다.');
  }
  if(quoted)throw new Error('닫히지 않은 따옴표가 있습니다. 원본 표를 확인하세요.');
  row.push(cell);rows.push(row);return rows.filter(r=>r.some(c=>c.trim()));
}
export function importReferenceRows(text:string,mode:ReferenceImportMode='mixed') {
  const data=referenceTable(text);
  if(data.length<2)throw new Error('머리글과 데이터 행을 함께 가져오세요.');
  if(data.length-1>MAX_REFERENCE_ROWS)throw new Error('기준표는 최대 30,000행입니다.');
  const headers=data[0].map(s=>s.trim().toLowerCase().replace(/[\s_()/-]/g,''));
  const locate=(aliases:string[])=>headers.findIndex(s=>aliases.includes(s));
  const title=locate(['학술지명','학술대회명','학회명','이름','venue','journaltitle','journalname','journal','title','fulljournaltitle']);
  const category=locate(['구분','category']);
  const index=locate(['index','indexes','indices','webofscienceindex','webofscienceindexes','webofscienceindices','wosindex','wosindexes','wosindices','edition','editions','webofsciencecorecollection']);
  if(title<0)throw new Error('학술지명 또는 Journal Title 머리글이 필요합니다.');
  if(mode==='mixed'&&category<0&&index<0)throw new Error('구분/Index 열이 필요합니다. SCIE만 담긴 공식 목록이면 SCIE 전용 목록을 선택하세요.');
  const pick=(row:string[],aliases:string[])=>row[locate(aliases)]?.trim()||'';
  const rows:Reference['rows']=[];let skipped=0,duplicates=0;const seen=new Set<string>();
  for(const [i,row] of data.slice(1).entries()) {
    const indexValue=index>=0?row[index]?.trim()||'':'';
    const scie=/\bSCIE\b|\bScience Citation Index Expanded\b/i.test(indexValue);
    // Explicit index data wins over a broad SCIE-only import setting or JIF column.
    let classification=category>=0?row[category]?.trim()||'':'';
    if(index>=0) {if(!scie){skipped++;continue;}classification='SCIE';}
    else if(mode==='scie') {if(classification&&classification!=='SCIE'){skipped++;continue;}classification='SCIE';}
    const parsed=referenceRowSchema.safeParse({venue:row[title]?.trim()||'',issn:[pick(row,['issn','pissn','printissn']),pick(row,['eissn','electronicissn','onlineissn'])].filter(Boolean).join(';'),alias:pick(row,['약칭','alias']),category:classification,value:pick(row,['값','h5index','h5','value']),impactFactor:pick(row,['인정if','if','impactfactor'])});
    if(!parsed.success)throw new Error(`${i+2}행의 학술지명·구분·h5 값을 확인하세요. 구분: SCIE / BK인정 / CS우수학술대회 / h5-index / 참고`);
    const key=JSON.stringify(parsed.data);if(seen.has(key)){duplicates++;continue;}seen.add(key);rows.push(parsed.data);
  }
  if(!rows.length)throw new Error('대조할 행이 없습니다. Index 열에서 SCIE / Science Citation Index Expanded를 확인하세요.');
  return {rows,skipped,duplicates};
}
