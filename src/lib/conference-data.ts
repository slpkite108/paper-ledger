import { dateFromParts, normalizedDoi, type DateParts, type DateCandidate } from './publication-dates';

export type ConferenceInfo={name:string;acronym:string;start:string;end:string;url:string;proceedings:string};
export type ConferenceMetadata={DOI?:string;type?:string;'container-title'?:string[];event?:{name?:string;acronym?:string;start?:DateParts;end?:DateParts};assertion?:{name?:string;value?:string;group?:{name?:string}}[]};
const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
export function conferenceDate(value:string):string {
  const text=value.trim();
  if(/^\d{4}(?:-\d{2}){0,2}$/.test(text))return dateFromParts({'date-parts':[text.split('-').map(Number)]});
  const match=text.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i);
  if(!match)return '';
  const month=months.indexOf(match[2].toLowerCase())+1;
  return month?dateFromParts({'date-parts':[[Number(match[3]),month,Number(match[1])]]}):'';
}
export function crossrefConference(m:ConferenceMetadata):ConferenceInfo|undefined {
  const assertion=(name:string)=>{
    const values=[...new Set((m.assertion||[]).filter(a=>a.name===name && (!a.group?.name || a.group.name==='ConferenceInfo')).map(a=>a.value?.trim()).filter((v):v is string=>!!v))];
    return values.length===1?values[0]:'';
  };
  const name=m.event?.name?.trim()||assertion('conference_name');
  if(!name)return undefined;
  const start=dateFromParts(m.event?.start)||conferenceDate(assertion('conference_start_date'))||conferenceDate(assertion('conference_year'));
  const rawEnd=dateFromParts(m.event?.end)||conferenceDate(assertion('conference_end_date'));
  const end=rawEnd && (!start || rawEnd>=start)?rawEnd:'';
  return {name,acronym:m.event?.acronym||assertion('conference_acronym'),start,end,url:'https://api.crossref.org/works/'+encodeURIComponent(normalizedDoi(m.DOI||'')),proceedings:m['container-title']?.join(' / ')||''};
}
export function conferenceCandidate(info?:ConferenceInfo):DateCandidate[] {
  return info?.start?[{source:'conference-event',date:info.start,url:info.url,note:info.name+(info.end?' · 개최기간 '+info.start+' ~ '+info.end:'')+' · 개최 시작일 기준'}]:[];
}
