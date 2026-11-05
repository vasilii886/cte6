'use strict';

let STUDY_LIBRARY={articles:[],coverage:[]};
async function loadStudyLibrary(){
  try{
    const r=await fetch('./library.json?v=2.0.0');if(!r.ok)throw new Error('library unavailable');
    const data=await r.json();
    if(!Array.isArray(data.articles))throw new Error('invalid library');
    STUDY_LIBRARY={...data,articles:data.articles.filter(a=>a&&typeof a.id==='string'&&Array.isArray(a.sentences)&&a.sentences.length&&a.sentences.every(s=>s&&typeof s.en==='string'&&typeof s.zh==='string'))};
  }catch{STUDY_LIBRARY={articles:[],coverage:[]};}
}
function studyArticles(){return STUDY_LIBRARY.articles;}
function studyById(id){return studyArticles().find(a=>a.id===id);}
function readyPaperCount(){return new Set([...studyArticles(),...state.imports].filter(a=>!a.demo).map(a=>a.id)).size;}
function libraryPapers(){
  const result=new Map(sourcePapers().map(p=>[p.id,{...p,ready:!!studyById(p.id)||state.imports.some(a=>a.id===p.id)}]));
  for(const a of [...studyArticles(),...state.imports])if(!a.demo)result.set(a.id,{...result.get(a.id),id:a.id,year:a.year||Number(a.period.slice(0,4)),period:a.period,set:a.set,passage:a.passage,ready:true});
  return [...result.values()].sort((a,b)=>b.period.localeCompare(a.period)||a.set-b.set||a.passage-b.passage);
}
function studyNotice(){
  if(!studyArticles().length)return '';
  return `<div class="study-library-banner"><div><span class="study-library-label">你的真题资料已入库</span><strong>${studyArticles().length} 篇 C 篇 · 打开即可逐句精读</strong><p>英文原文、逐句参考译文、点词释义与重点词收藏，已放在同一张书桌上。</p></div><button class="btn primary small" data-action="open-study-latest">开始精读 ${icon('arrow',12)}</button></div>`;
}
function coverageSummary(){
  if(!studyArticles().length)return '';
  const periods=DATA.periods.filter(p=>!p.future&&!studyArticles().some(a=>a.period===p.id));
  return `<div class="library-coverage"><span>${icon('info',13)} 资料覆盖</span><p>已入库 ${studyArticles().length} 篇，来自你提供的本地资料。${periods.length?`${periods.map(p=>p.id).join('、')} 的原文文件未包含在这份资料中，保留原站入口。`:''}2026 年 12 月尚未开考。</p><button class="btn small" data-action="export-study-library">${icon('download',11)} 下载全部精读数据</button></div>`;
}
function handleStudyAction(action){
  if(action==='open-study-latest'){const a=studyArticles()[0];if(a)openArticle(a.id);return true;}
  if(action==='export-study-library'){download('拾词-C篇逐句精读数据.json',JSON.stringify({articles:studyArticles()},null,2));return true;}
  return false;
}
