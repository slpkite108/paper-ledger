import React, { useEffect, useRef, useState } from 'react';
import {createRoot} from 'react-dom/client';
import App from './app/page';
import { PatentSearchPage } from './components/patent-search-page';
import './app/globals.css';

function ResearchApp() {
  const [patents, setPatents] = useState(() => location.hash === '#/patents');
  const [papersVisited, setPapersVisited] = useState(() => location.hash !== '#/patents');
  const [patentsVisited, setPatentsVisited] = useState(() => location.hash === '#/patents');
  const previousPage = useRef(patents);
  useEffect(() => {
    const navigate = () => { const next = location.hash === '#/patents'; setPatents(next); if (next) setPatentsVisited(true); else setPapersVisited(true); };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  useEffect(() => {
    document.title = patents ? '국내 특허 검색 · 논문대장' : '논문대장 · 저자별 연구실적';
    if (previousPage.current !== patents) {
      window.scrollTo(0, 0);
      const heading = document.querySelector<HTMLElement>('.research-page:not([hidden]) h1');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
      previousPage.current = patents;
    }
  }, [patents]);
  // Keep visited pages mounted so navigating back preserves in-progress paper edits and search inputs.
  return <><div className="research-page" hidden={patents}>{papersVisited && <App/>}</div><div className="research-page" hidden={!patents}>{patentsVisited && <PatentSearchPage/>}</div></>;
}

createRoot(document.getElementById('root')!).render(<ResearchApp/>);
