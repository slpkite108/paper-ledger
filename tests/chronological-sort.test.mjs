import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'vite';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ExcelJS from 'exceljs';

await build({configFile:false,logLevel:'silent',build:{outDir:'.build/chronological-sort-test',emptyOutDir:false,target:'esnext',lib:{entry:resolve('tests/chronological-sort-entry.ts'),formats:['es'],fileName:()=>'sort.mjs'},rolldownOptions:{external:['exceljs']}}});
const app=await import(pathToFileURL(resolve('.build/chronological-sort-test/sort.mjs')).href);
const author={id:'https://openalex.org/A1',display_name:'Researcher'};
const make=(date,id=date)=>({...app.toPaper({id,title:id},author,'Researcher'),values:{...app.toPaper({id,title:id},author,'Researcher').values,published:date}});
const layout=direction=>({...app.defaultLayout(),sort:[{key:'published',direction}]});
const dates=rows=>rows.map(p=>p.values.published);

test('chronological sort crosses years before comparing months in both directions',()=>{
  const ordered=['2024-12','2025-01','2025-02','2025-10','2025-12','2026-01'];
  const input=[ordered[4],ordered[2],ordered[5],ordered[0],ordered[3],ordered[1]].map(v=>make(v));
  assert.deepEqual(dates(app.sortPapers(input,layout('asc'))),ordered);
  assert.deepEqual(dates(app.sortPapers(input,layout('desc'))),[...ordered].reverse());
});
test('unknown month follows known months within its year without inventing January',()=>{
  const input=['2025','2026-01','2024','2025-01','2024-12','2025-12',''].map(v=>make(v));
  assert.deepEqual(dates(app.sortPapers(input,layout('asc'))),['2024-12','2024','2025-01','2025-12','2025','2026-01','']);
  assert.deepEqual(dates(app.sortPapers(input,layout('desc'))),['2026-01','2025-12','2025-01','2025','2024-12','2024','']);
});
test('invalid dates cannot precede valid chronology in either direction',()=>{
  const input=['2025-13','2025-02','2025-00','2024-12','0000','미상',''].map(v=>make(v));
  for(const direction of ['asc','desc']) {
    const sorted=app.sortPapers(input,layout(direction));
    assert.deepEqual(dates(sorted).slice(0,2),direction==='asc'?['2024-12','2025-02']:['2025-02','2024-12']);
    assert.equal(sorted.at(-1).values.published,'');
  }
});
test('mapped publication columns and custom date formats use chronological order',()=>{
  const base=layout('asc');const dateColumn=base.columns.find(c=>c.source==='published');
  const input=['2026-01','2025','2025-12','2025-02'].map(v=>make(v));
  for(const format of ['text','month','year','number']) {
    const mapped={...base,columns:[{...dateColumn,format}],sort:[{key:'column:'+dateColumn.id,direction:'asc'}]};
    assert.deepEqual(dates(app.sortPapers(input,mapped)),['2025-02','2025-12','2025','2026-01']);
  }
  const custom={...dateColumn,id:'custom-date',source:'manual',format:'month'};
  const rows=input.map(p=>({...p,customValues:{'custom-date':p.values.published}}));
  assert.deepEqual(dates(app.sortPapers(rows,{...base,columns:[custom],sort:[{key:'column:custom-date',direction:'asc'}]})),['2025-02','2025-12','2025','2026-01']);
});
test('same year-month retains secondary sort and stable ties without changing the input',()=>{
  const input=[make('2025-05','B'),make('2025-05','A'),make('2025-05','A2')];
  input[0].values.professor='나';input[1].values.professor='가';input[2].values.professor='가';
  const before=input.map(p=>p.id);
  const settings={...layout('desc'),sort:[{key:'published',direction:'desc'},{key:'professor',direction:'asc'}]};
  assert.deepEqual(app.sortPapers(input,settings).map(p=>p.id),[input[1].id,input[2].id,input[0].id]);
  assert.deepEqual(input.map(p=>p.id),before);
});
test('CSV and reopened XLSX retain the same chronological rows as the table',async()=>{
  const input=['2026-01','2025','2025-10','2024-12','2025-02'].map(v=>make(v));
  for(const direction of ['asc','desc']) {
    const settings=layout(direction);settings.columns=settings.columns.filter(c=>['title','published'].includes(c.source));
    const sorted=app.sortPapers(input,settings), expected=dates(sorted);
    const csv=app.layoutCsv(sorted,settings).split('\r\n').slice(1).map(line=>line.split(',')[1].replaceAll('"',''));
    assert.deepEqual(csv,expected);
    const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await app.ledgerXlsx(sorted,settings));
    const sheet=workbook.getWorksheet('연구실적');
    assert.deepEqual(expected.map((_,i)=>sheet.getCell(i+2,2).value),expected);
  }
});
