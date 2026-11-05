'use strict';

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (name,size=16) => {
  const p = {book:'<path d="M12 6c-3-2-6-3-10-2v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-4-1-7 0-10 2z"/><path d="M12 6v15"/>',leaf:'<path d="M20 3c1 9-3 16-10 16-4 0-6-2-6-5C4 7 12 5 20 3z"/><path d="M3 22 16 9"/>',star:'<path d="m12 3 2.7 5.6 6.2.9-4.5 4.4 1.1 6.1-5.5-2.9L6.5 20l1-6.1L3 9.5l6.2-.9z"/>',chart:'<path d="M4 3v18h17M9 16v-5m5 5V7m5 9V4"/>',plus:'<path d="M12 5v14M5 12h14"/>',chevron:'<path d="m9 5 7 7-7 7"/>',down:'<path d="m6 9 6 6 6-6"/>',check:'<path d="m5 12 4 4L19 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',sound:'<path d="m11 5-6 4H2v6h3l6 4zM15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',external:'<path d="M14 3h7v7m0-7L10 14M10 4H4v16h16v-6"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 17v4h16v-4"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',edit:'<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14z"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',layers:'<path d="m12 3 10 6-10 6L2 9zm-10 12 10 6 10-6M2 13l10 6 10-6"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>'};
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p[name]||p.book}</svg>`;
};
const STORAGE='shici.cet6.v1';
const CONTENT_VERSION='20261105-1';
let storageFailed=false, saved={};
try { saved=JSON.parse(localStorage.getItem(STORAGE)||'{}'); if (!saved || typeof saved!=='object' || Array.isArray(saved)) saved={}; } catch { storageFailed=true; }
const objectOrEmpty=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
let state={view:'reader',year:2026,period:'2026.06',article:'paper-2026.06-1-1',mode:'bilingual',highlight:true,size:18,words:{},progress:{},imports:[],sourceProgress:{},surface:'local',sourceTab:'article',...saved};
state.words=objectOrEmpty(state.words); state.progress=objectOrEmpty(state.progress);
state.sourceProgress=objectOrEmpty(state.sourceProgress);
state.imports=Array.isArray(state.imports)?state.imports.filter(a=>a&&typeof a.id==='string'&&Array.isArray(a.sentences)&&a.sentences.every(s=>s&&typeof s.en==='string')):[];
state.size=Math.max(15,Math.min(24,Number(state.size)||18));
if(!['reader','vocab','progress','writing'].includes(state.view))state.view='reader';
if(!['bilingual','english','chinese'].includes(state.mode))state.mode='bilingual';
let DATA, core={}, dictionaryReady=false, shardCache={}, wordFilter='all', searchText='', selectedSentence=0, currentLookup=null, lookupSequence=0, review=null, toastTimer, modalFocus=null, speaking=false;
let pendingImport=null;

function persist(){
  try{localStorage.setItem(STORAGE,JSON.stringify(state));}
  catch{storageFailed=true; toast('当前浏览器无法保存，请导出备份以免丢失。');}
}
function toast(message){const n=$('#toast');n.textContent=message;n.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.classList.remove('show'),3000);}
function articles(){return [...new Map([...DATA.articles,...studyArticles(),...state.imports].map(a=>[a.id,a])).values()];}
function currentArticle(){return articles().find(a=>a.id===state.article);}
function currentPeriod(){return DATA.periods.find(p=>p.id===state.period)||DATA.periods[0];}
function words(){return Object.values(state.words).filter(w=>w&&typeof w.word==='string');}
function learned(a){return (state.progress[a.id]?.done||[]).filter(i=>Number.isInteger(i)&&i>=0&&i<a.sentences.length);}
function setTitle(){if(state.view==='writing'){document.title='作文练习 · 拾词';return;}const a=currentArticle(),source=currentSource();document.title=state.view==='vocab'?'我的词库 · 拾词':state.view==='progress'?'学习进度 · 拾词':`${a?.subtitle||(source?sourceTitle(source):'六级精读室')} · 拾词`;}

async function boot(){
  try{
    const [r]=await Promise.all([fetch('./data.json'),loadSourceIndex(),loadStudyLibrary(),loadWritingGuide(),loadWritingExams()]);if(!r.ok)throw new Error('内容加载失败');DATA=await r.json();
    if(!saved.article&&studyArticles().length){const a=studyArticles()[0];state.article=a.id;state.period=a.period;state.year=a.year;}
    if(!DATA.periods.some(p=>p.id===state.period))state.period='2026.06';
    if(![2020,2021,2022,2023,2024,2025,2026].includes(Number(state.year)))state.year=2026;
    if(!currentArticle()&&!state.article.startsWith('paper-'))state.article=DATA.articles[0].id;
    const pageQuery=new URLSearchParams(location.search);if(pageQuery.get('view')==='writing'){state.view='writing';if(pageQuery.get('tab')==='review')WRITING.tab='review';}
    render();
    fetch('./dict/core.json?v='+CONTENT_VERSION).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(d=>{core=d;dictionaryReady=true;if(state.view==='reader')refreshReaderWords();}).catch(()=>{toast('基础词典暂未加载，点击单词时会重试分卷词典。');});
    if(storageFailed)toast('本地存储不可用或数据损坏。请使用导出备份。');
  }catch(e){$('#app').innerHTML=`<div class="empty-reader"><h2>暂时未能打开书桌</h2><p>请检查网络后重试。</p><button class="btn primary" data-action="reload">重新加载</button></div>`;}
}

function render(){
  setTitle();closeLookup();
  $('#app').innerHTML=`<header class="topbar">
    <button class="icon-btn mobile-menu" data-action="menu" aria-label="${state.view==='writing'?'选择练习阶段与草稿':'选择年份与篇目'}">${icon('menu',20)}</button>
    <a href="#reader" class="brand" data-action="view" data-view="reader"><span class="brand-icon">${icon('book',26)}</span><span><strong>拾词<span style="font-weight:350;color:#a2aa98"> / </span>六级精读室</strong><small>READ. UNDERSTAND. REMEMBER.</small></span></a>
    <nav class="main-nav" aria-label="主导航">${[['reader','book','精读书架'],['vocab','star','我的词库'],['progress','chart','学习进度'],['writing','edit','作文练习']].map(([v,i,t])=>`<button class="nav-btn ${state.view===v?'active':''}" data-action="view" data-view="${v}">${icon(i,14)}${t}${v==='vocab'?`<span class="count-pill" id="word-count">${words().length}</span>`:''}</button>`).join('')}</nav>
    <div class="top-actions"><span class="local-label"><i></i>${state.view==='writing'?(writingCloudEnabled?'作文草稿·本机与云端':'作文保存在当前浏览器'):storageFailed?'请导出备份':'学习记录保存在本机'}</span>${state.view==='writing'?`<button class="btn primary" data-action="writing-new">${icon('plus',14)}新建练习</button>`:`<button class="btn primary" data-action="import">${icon('plus',14)}导入资料</button>`}</div>
  </header><div class="workspace"><div class="mobile-side-backdrop" data-action="close-menu"></div>${state.view==='writing'?renderWritingSidebar():renderSidebar()}<main class="main" id="main-content">${state.view==='writing'?renderWriting():state.view==='reader'?renderReader():state.view==='vocab'?renderVocab():renderProgress()}</main></div>`;
  applyFont();
}
function renderSidebar(){
  const p=currentPeriod();
  return `<aside class="sidebar" aria-label="年份与篇目"><div class="side-title"><strong>阅读档案</strong><span>2020 — 2026</span></div>
    <div class="years">${Array.from({length:7},(_,i)=>2020+i).map(y=>`<button class="year-btn ${Number(state.year)===y?'active':''}" data-action="year" data-year="${y}">${y}</button>`).join('')}</div>
    <label class="label" for="period-select">选择考次</label><select class="period-select" id="period-select">${DATA.periods.filter(p=>p.year===Number(state.year)).map(p=>`<option value="${p.id}" ${p.id===state.period?'selected':''}>${p.year} 年 ${String(p.month).padStart(2,'0')} 月${p.future?' · 尚未开考':''}</option>`).join('')}</select>
    <div class="catalogue">${p.future?`<div class="side-note">2026 年 12 月 12 日笔试。<br>考试尚未举行，暂无真题。</div>`:setsForPeriod(p).map(set=>`<div class="catalogue-set"><div class="set-label"><span>第 ${['一','二','三'][set-1]} 套 · SECTION C</span></div>${[1,2].map(pass=>{
      const id=`paper-${p.id}-${set}-${pass}`,a=articles().find(a=>a.id===id);
      const linked=sourceById(id),read=state.sourceProgress[id]?.read;
      return `<button class="passage-btn ${state.article===id?'active':''}" data-action="article" data-id="${id}"><span class="passage-num">0${pass}</span><span class="passage-title">${a?esc(a.subtitle||a.title):`Passage ${pass===1?'One':'Two'}`}<span class="passage-status">${a?(a.sentences.every(s=>s.zh)?'已入库 · 逐句精读':'已导入 · 译文待补充'):linked?(read?'已读 · 原站可读':'原站可读 · 原文与解析'):'暂无逐篇来源'}</span></span><span class="small-dot ${a||linked?'ready':''}"></span></button>`;
    }).join('')}</div>`).join('')}</div>
    <div class="side-divider"></div><div class="overline" style="margin-bottom:10px">THE READING DESK</div>
    ${DATA.articles.map(a=>`<button class="demo-btn ${state.article===a.id?'active':''}" data-action="article" data-id="${a.id}">${icon(a.id==='demo-nature'?'leaf':'book',14)}<span>${esc(a.topic)}</span><small style="font-size:9px;color:#99a58b">原创示范</small></button>`).join('')}
    <button class="demo-btn" data-action="source-directory">${icon('layers',14)}<span>真题篇目总览</span><small>${sourcePapers().length}</small></button>
    <button class="demo-btn" data-action="sources">${icon('external',14)}<span>真题资料与来源</span>${icon('chevron',11)}</button>
    <button class="demo-btn" data-action="import">${icon('upload',14)}<span>导入原文与译文</span></button>
    <div class="side-note">${studyArticles().length?`已入库 ${studyArticles().length} 篇完整 C 篇。<br>打开文章即可点词、对照译文、记录重点。`:SOURCE_INDEX?`已关联 ${sourcePapers().length} 篇 C 篇原站入口。<br>原文与解析由懒笔记提供，本站保存你的词汇和笔记。`:'源站目录暂未加载，仍可使用导入资料。'}</div>
  </aside>`;
}
function crumb(label){return `<div class="breadcrumb"><span>你的学习空间</span>${icon('chevron',9)}<span>${label}</span><span style="margin-left:auto">${icon('leaf',11)}&nbsp; 每一次认真阅读，都算数</span></div>`;}
function renderReader(){
  const a=currentArticle();const p=currentPeriod(),source=currentSource(),sourceMode=source&&(!a||state.surface==='source');
  const total=a?.sentences.length||0,done=a?learned(a).length:0;
  return `${crumb('精读书架')}<div class="page-top"><div><div class="page-eyebrow"><i></i>YOUR DAILY READING</div><h1>把每一篇，读懂。</h1><p class="page-sub">从一句话到一个观点，让读过的文字成为自己的积累。</p></div>${sourceMode?`<div class="study-tiny"><div><b>${String(sourcePapers().filter(s=>s.period===p.id).length).padStart(2,'0')}</b><small> 篇</small></div>本考次原站篇目<br><button data-action="source-directory" style="color:var(--green);font-size:10px;text-decoration:underline">查看全部 ${sourcePapers().length} 篇</button></div>`:`<div class="study-tiny"><div><b>${String(done).padStart(2,'0')}</b><small> / ${String(total).padStart(2,'0')} 句</small></div>本篇精读进度<div class="stat-line"><div style="width:${total?done/total*100:0}%"></div></div></div>`}</div>
    ${studyArticles().length&&(!a||a.demo)?studyNotice():!sourceMode&&SOURCE_INDEX?`<div class="source-update"><span>${icon('layers',14)} ${readyPaperCount()} 篇真题已就绪 · 按年份选择，逐句读懂</span><button data-action="source-directory">全部篇目 ${icon('arrow',12)}</button></div>`:''}
    ${source&&a?`<div class="surface-switch segmented"><button class="${!sourceMode?'active':''}" data-action="source-surface" data-surface="local">本站精读 · 已入库</button><button class="${sourceMode?'active':''}" data-action="source-surface" data-surface="source">原站对照 · 懒笔记</button></div>`:''}
    <div class="reading-layout ${sourceMode?'source-layout':''}"><section class="reader" aria-label="阅读正文">${sourceMode?renderSourcePaper(source):a?renderArticle(a):renderEmptyPaper(p)}</section><aside class="context-rail" aria-label="词汇与精读笔记">${sourceMode?renderSourceRail(source):renderRail(a)}</aside></div>
    <footer class="footnote"><span>拾词 · 少一点匆忙，多一点理解。</span><span><button data-action="sources">资料与词典来源 ${icon('external',10)}</button> &nbsp; 学习数据仅保存在当前浏览器</span></footer>`;
}
function renderArticle(a){
  const wc=(a.sentences.map(s=>s.en).join(' ').match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)||[]).length;
  return `<div class="toolbar"><div class="segmented" role="group" aria-label="阅读模式">${[['bilingual','双语对照'],['english','只看英文'],['chinese','只看译文']].map(([m,t])=>`<button class="${state.mode===m?'active':''}" data-action="mode" data-mode="${m}">${t}</button>`).join('')}</div><div class="reader-options"><label class="check-label"><input type="checkbox" id="highlight-toggle" ${state.highlight?'checked':''}>重点词</label><span style="color:#d5dbcb">│</span><button class="font-btn" data-action="font" data-delta="-1" aria-label="缩小字号">A−</button><span class="font-size-val">${state.size}</span><button class="font-btn" data-action="font" data-delta="1" aria-label="放大字号">A+</button></div></div>
    <div class="reader-head"><div class="tags"><span class="tag">${a.demo?'原创精读示范':esc(`${a.period} · 第 ${a.set} 套`)}</span><span class="tag outline">${esc(a.topic||'Section C')}</span>${a.demo?'':`<span class="tag outline">Passage ${a.passage}</span>`}${a.provided?'<span class="tag">资料全文已入库</span>':''}</div><h2 class="article-title">${esc(a.title)}</h2><p class="article-subtitle">${esc(a.subtitle||'逐句理解，慢慢积累。')}</p><div class="article-meta"><span>${icon('book',11)} ${wc} 词</span><span>${icon('clock',11)} 建议精读 ${Math.max(8,Math.round(wc/22))} 分钟</span><span>${icon('layers',11)} ${a.sentences.length} 句 · ${new Set(a.sentences.map(s=>s.paragraph)).size} 段</span><button data-action="speak-article" style="margin-left:auto;font-size:9px;color:#8c9b7c">${icon('sound',12)} ${speaking?'停止朗读':'朗读全文'}</button>${!a.demo?`<button data-action="edit-article" style="font-size:9px;color:#8c9b7c">${icon('edit',11)} 编辑</button>`:''}</div>${a.provided?`<p class="article-provenance">${esc(a.translationCredit||'AI 辅助逐句参考译文，可在编辑中调整。')}<br>原文：${esc(a.sourceFile||'你提供的真题资料')}</p>`:''}</div>
    <div class="hint-strip">${icon('info',12)} 点击英文单词查词，点星号收藏；下划线为词典 CET6 标签词。</div>
    ${state.mode==='bilingual'?'<div class="column-labels"><span>ORIGINAL TEXT · 英文原文</span><span>TRANSLATION · 逐句译文</span></div>':''}
    <div id="sentences">${renderSentences(a)}</div>
    <div class="reader-end"><div class="end-note">${a.demo?'本站原创学习示范，非历年真题。':a.provided?'来自你提供的资料 · 逐句参考译文。':'个人导入资料 · 译文以导入内容为准。'}<br>读懂之后，记得回来看看收藏的词。</div><button class="btn primary" data-action="complete-article">${icon('check',13)}${learned(a).length===a.sentences.length?'已完成本篇精读':'完成本篇精读'}</button></div>`;
}
function renderSentences(a){
  const done=learned(a);
  return a.sentences.map((s,i)=>`<div class="sentence ${state.mode==='bilingual'?'':state.mode} ${i===0||s.paragraph!==a.sentences[i-1].paragraph?'par-start':''} ${selectedSentence===i?'selected':''}" data-sentence="${i}"><span class="sentence-num">${String(i+1).padStart(2,'0')}</span><div class="en">${tokenize(s.en,i)}</div><div class="zh">${s.zh?esc(s.zh):'<span class="translation-pending">这句译文还未导入。可在「编辑」中补充。</span>'}</div><div class="sentence-tools"><button data-action="select-sentence" data-index="${i}">${icon('edit',10)} ${s.note?'句式笔记':'添加笔记'}</button><button data-action="speak-sentence" data-index="${i}" aria-label="朗读第 ${i+1} 句">${icon('sound',10)} 朗读</button><button class="${done.includes(i)?'done':''}" data-action="complete-sentence" data-index="${i}">${icon('check',10)} ${done.includes(i)?'已读懂':'标记读懂'}</button></div></div>`).join('');
}
function coreEntry(w){let raw=core[w];if(raw?.length===1){w=raw[0];raw=core[w];}return raw?.length>1?{word:w,phonetic:raw[0],meaning:raw[1],cet6:!!raw[2]}:null;}
function tokenize(text,index){
  return text.split(/([A-Za-z]+(?:['’-][A-Za-z]+)*)/g).map((token,i)=>{
    if(i%2===0)return esc(token);
    const w=token.toLowerCase().replaceAll('’',"'"),entry=coreEntry(w),key=entry?.word||w;
    return `<span class="word ${entry?.cet6&&state.highlight?'keyword':''} ${state.words[key]?'saved':''}" role="button" tabindex="0" data-word="${esc(w)}" data-index="${index}" aria-label="查询 ${esc(token)}">${esc(token)}</span>`;
  }).join('');
}
function refreshReaderWords(){
  const a=currentArticle();if(!a||state.view!=='reader')return;
  if(currentSource()&&state.surface==='source'){refreshSourceWords();return;}
  const sentences=$('#sentences');if(sentences)sentences.innerHTML=renderSentences(a);
  const rail=$('.context-rail');if(rail)rail.innerHTML=renderRail(a);
}
function renderEmptyPaper(p){
  const [,,set,pass]=state.article.split('-');
  return `<div class="empty-reader"><div class="empty-illustration">${icon(p.future?'clock':'book',32)}</div><div class="overline">${esc(p.id)} · SECTION C${p.future?'':` · 第 ${set||1} 套 · PASSAGE ${pass||1}`}</div><h2>${p.future?'这一场考试，还在未来':'把这篇文章，放到书桌上'}</h2><p>${p.future?'2026 年 12 月笔试定于 12 月 12 日举行，目前尚无本次真题。':`已准备好本篇的精读位置。${p.available?'可前往 GitHub 查看该考次的原资料，导入你持有的英文原文与译文后，即可逐句对照、点击查词和收藏。':'已检索的 GitHub 仓库暂缺该考次。你也可以导入自己的材料，继续精读。'}`}</p><div class="empty-actions">${p.future?`<a class="btn" href="https://cet-kw.neea.edu.cn/" target="_blank" rel="noopener noreferrer">查看考试安排 ${icon('external',12)}</a>`:`<button class="btn primary" data-action="import">${icon('plus',13)} 导入本篇资料</button><a class="btn" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">查看 GitHub 原资料 ${icon('external',12)}</a>`}</div><button class="btn ghost" data-action="article" data-id="demo-focus" style="margin-top:18px">先体验原创精读示范 ${icon('arrow',12)}</button></div>`;
}
function articleKeywords(a){
  if(!a)return[];const found=new Map();
  for(const s of a.sentences){for(const w of s.en.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g)||[]){const e=coreEntry(w);if(e?.cet6&&!found.has(e.word))found.set(e.word,{...e,context:s.en,articleId:a.id,source:a.subtitle||a.title});}}
  return [...found.values()];
}
function renderRail(a){
  const keys=articleKeywords(a),shown=keys.slice(0,5),s=a?.sentences[selectedSentence]||a?.sentences[0];
  return `<section class="rail-card"><div class="rail-title">${icon('star',14)} 本篇重点词 <small>${dictionaryReady?`${keys.length} WORDS`:'词典加载中'}</small></div>${shown.length?shown.map(w=>`<div class="word-list-item"><button class="word-list-info" data-action="rail-word" data-word="${esc(w.word)}" style="text-align:left;padding:0"><strong>${esc(w.word)}</strong><span>${esc(w.meaning.split('\n')[0].slice(0,49))}</span></button><button class="star-btn ${state.words[w.word]?'active':''}" data-action="save-keyword" data-word="${esc(w.word)}" aria-label="${state.words[w.word]?'取消收藏':'收藏'} ${esc(w.word)}">${state.words[w.word]?'★':'☆'}</button></div>`).join(''):`<p class="annotation-text">${a?'点击英文单词，随时查词收藏。':'导入文章后，将自动识别带 CET6 标签的重点词。'}</p>`}<button class="btn small full-width" data-action="collect-all" ${!keys.length?'disabled':''}>${icon('plus',12)} 收藏本篇全部重点词</button></section>
    <section class="rail-card" id="annotation-card"><div class="rail-title">${icon('edit',14)} 精读手记 <small>${a?`句 ${String(selectedSentence+1).padStart(2,'0')}`:'READING NOTES'}</small></div><div class="annotation-type">${s?.note?'句式 · 语义 · 表达':'留下你的理解'}</div>${s?`<blockquote class="annotation-quote">${esc(s.en)}</blockquote>`:''}<p class="annotation-text">${esc(s?.note||'点击句子下方的「添加笔记」，记录句子结构、短语或你自己的理解。')}</p>${a?`<button class="btn small full-width" data-action="edit-note" data-index="${selectedSentence}">${icon('edit',11)} ${s?.note?'编辑我的笔记':'添加本句笔记'}</button>`:''}</section>
    <div class="tiny-tip">${icon('leaf',18)}<span><strong>先理解，再记忆。</strong><br>词库保留原句与出处，复习时把词放回语境。</span></div>`;
}
function renderVocab(){
  const all=words(),due=all.filter(w=>!w.mastered),mastered=all.filter(w=>w.mastered);
  return `<div class="wide-page">${crumb('我的词库')}<div class="view-header"><div><div class="page-eyebrow"><i></i>YOUR WORD COLLECTION</div><h1>遇见的词，记得住。</h1><p class="page-sub">让每一个生词，都有一句属于它的语境。</p></div><div class="view-actions"><button class="btn" data-action="export-words">${icon('download',13)} 导出词库</button><button class="btn primary" data-action="review" ${all.length?'':'disabled'}>${icon('layers',14)} 词卡复习</button></div></div>
    <div class="stats-grid"><div class="stat-card"><span>收藏词汇</span><strong>${String(all.length).padStart(2,'0')}</strong></div><div class="stat-card"><span>待巩固</span><strong>${String(due.length).padStart(2,'0')}</strong></div><div class="stat-card"><span>已掌握</span><strong>${String(mastered.length).padStart(2,'0')}</strong></div></div>
    <div class="word-controls"><input class="search-input" id="vocab-search" type="search" placeholder="搜索单词或中文释义…" aria-label="搜索词库" value="${esc(searchText)}"><div class="segmented">${[['all','全部'],['learning','待巩固'],['mastered','已掌握']].map(([f,t])=>`<button class="${wordFilter===f?'active':''}" data-action="filter-words" data-filter="${f}">${t}</button>`).join('')}</div></div><div id="word-results">${renderWordResults()}</div>
    <footer class="footnote"><span>释义来源：ECDICT · 结合原句判断词义。</span><span>建议定期导出备份，清除浏览器数据会清空词库。</span></footer></div>`;
}
function renderWordResults(){
  const items=words().filter(w=>(wordFilter==='all'||(wordFilter==='mastered'?w.mastered:!w.mastered))&&`${w.word} ${w.meaning}`.toLowerCase().includes(searchText.toLowerCase())).sort((a,b)=>(b.added||0)-(a.added||0));
  if(!items.length)return `<div class="empty-view">${icon('star',28)}<h2>${words().length?'暂时没有匹配的词':'先收藏一个让你停留的词'}</h2><p>${words().length?'试试其他关键词或筛选条件。':'在文章里点击单词，再点「加入我的词库」。<br>词义、例句和文章出处，会一起留下。'}</p>${words().length?'':`<button class="btn" data-action="view" data-view="reader">去读一篇文章 ${icon('arrow',12)}</button>`}</div>`;
  return `<div class="word-grid">${items.map(w=>`<article class="vocab-card"><div class="vocab-top"><strong>${esc(w.word)}</strong><button class="icon-btn" data-action="speak-word" data-word="${esc(w.word)}" aria-label="朗读 ${esc(w.word)}">${icon('sound',16)}</button></div><div class="vocab-phonetic">${w.phonetic?`/${esc(w.phonetic)}/`:'音标暂缺'} ${w.cet6?'<span class="tag">CET6</span>':''}</div><div class="vocab-meaning">${esc(w.meaning)}</div>${w.context?`<div class="vocab-context">“${esc(w.context)}”</div>`:''}<div class="vocab-source">来自：${esc(w.source||'手动收藏')}</div><div class="vocab-actions"><button class="btn small ${w.mastered?'primary':''}" data-action="master-word" data-word="${esc(w.word)}">${icon('check',11)} ${w.mastered?'已掌握':'标记掌握'}</button><button class="icon-btn" data-action="remove-word" data-word="${esc(w.word)}" aria-label="移除 ${esc(w.word)}">${icon('trash',13)}</button></div></article>`).join('')}</div>`;
}
function renderProgress(){
  const all=articles(),started=all.filter(a=>learned(a).length),finished=all.filter(a=>learned(a).length===a.sentences.length),sentences=all.reduce((n,a)=>n+learned(a).length,0),imported=readyPaperCount();
  const finishedCount=new Set([...finished.map(a=>a.id),...sourcePapers().filter(p=>state.sourceProgress[p.id]?.read).map(p=>p.id)]).size;
  return `<div class="wide-page">${crumb('学习进度')}<div class="view-header"><div><div class="page-eyebrow"><i></i>SMALL STEPS, REAL PROGRESS</div><h1>认真读过，就有痕迹。</h1><p class="page-sub">按自己的节奏，积累每一次理解。</p></div><div class="view-actions"><button class="btn" data-action="backup">${icon('download',13)} 备份阅读记录</button><button class="btn" data-action="restore">${icon('upload',13)} 恢复阅读备份</button></div></div>
    <div class="stats-grid"><div class="stat-card"><span>读懂的句子</span><strong>${String(sentences).padStart(2,'0')}</strong></div><div class="stat-card"><span>完成 / 标记已读</span><strong>${String(finishedCount).padStart(2,'0')}</strong></div><div class="stat-card"><span>可直接精读的真题</span><strong>${String(imported).padStart(2,'0')}</strong></div></div>
    <div class="content-status">真题全文与逐句译文已入库 ${studyArticles().length} 篇；另有 ${state.imports.length} 篇个人编辑或导入记录。原站阅读已标记 ${Object.values(state.sourceProgress).filter(p=>p?.read).length} 篇。<button data-action="source-directory" style="text-decoration:underline;color:var(--green)">打开精读目录</button></div>
    ${coverageSummary()}
    ${renderSourceProgress()}
    ${started.length?`<div class="progress-list">${started.map(a=>`<div class="progress-item"><div><h3>${esc(a.subtitle||a.title)}</h3><p>${a.demo?'原创示范':`${esc(a.period)} · 第 ${a.set} 套 · Passage ${a.passage}`}</p></div><div class="progress-right"><span>${learned(a).length}/${a.sentences.length} 句</span><button class="btn small" data-action="article" data-id="${esc(a.id)}">${learned(a).length===a.sentences.length?'再读一遍':'继续精读'} ${icon('arrow',11)}</button></div></div>`).join('')}</div>`:`<div class="empty-view">${icon('book',28)}<h2>从读懂第一句话开始</h2><p>读完一句，点「标记读懂」。<br>你走过的每一步，都会留在这里。</p><button class="btn primary" data-action="view" data-view="reader">回到精读书桌 ${icon('arrow',12)}</button></div>`}
    <footer class="footnote"><span>阅读记录保存在当前浏览器，不跨设备同步。</span><span>备份包含阅读文章、词汇、笔记与精读进度；作文在作文页单独导出。</span></footer></div>`;
}

function applyFont(){document.documentElement.style.setProperty('--reader-size',state.size+'px');}
function stopSpeech(){if('speechSynthesis'in window)window.speechSynthesis.cancel();speaking=false;}
function say(text,onEnd){
  if(!('speechSynthesis'in window)){toast('当前浏览器不支持朗读。');return;}
  stopSpeech();const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=.86;
  const voices=window.speechSynthesis.getVoices();u.voice=voices.find(v=>v.lang==='en-US')||voices.find(v=>v.lang.startsWith('en'))||null;
  u.onend=()=>{speaking=false;onEnd?.();};u.onerror=()=>{speaking=false;onEnd?.();};window.speechSynthesis.speak(u);speaking=true;
}
function openArticle(id){
  stopSpeech();state.article=id;state.view='reader';state.surface='local';selectedSentence=0;SOURCE_ACTIVE_FRAME=null;
  const m=id.match(/^paper-(\d{4}\.\d{2})-/);if(m){state.period=m[1];state.year=Number(m[1].slice(0,4));}
  persist();render();window.scrollTo({top:0,behavior:'smooth'});
}
function setView(view){stopSpeech();state.view=view;const u=new URL(location.href);if(view==='writing')u.searchParams.set('view','writing');else{u.searchParams.delete('view');u.searchParams.delete('submission');}history.replaceState(null,'',u.pathname+u.search+u.hash);persist();render();window.scrollTo({top:0});}
function selectSentence(i){
  const a=currentArticle();if(!a||!a.sentences[i])return;selectedSentence=i;
  $$('.sentence').forEach(el=>el.classList.toggle('selected',Number(el.dataset.sentence)===i));
  const rail=$('.context-rail');if(rail)rail.innerHTML=renderRail(a);
}
function markSentence(i){
  const a=currentArticle();if(!a)return;
  const done=new Set(learned(a));done.has(i)?done.delete(i):done.add(i);
  state.progress[a.id]={...state.progress[a.id],done:[...done],updated:Date.now()};persist();
  const scroll=window.scrollY;render();window.scrollTo(0,scroll);
}

async function fetchShard(letter){
  if(!/^[a-z]$/.test(letter))return{};
  if(!shardCache[letter])shardCache[letter]=fetch(`./dict/${letter}.json?v=${CONTENT_VERSION}`).then(r=>{if(!r.ok)throw new Error('加载失败');return r.json();}).catch(e=>{delete shardCache[letter];throw e;});
  return shardCache[letter];
}
async function findWord(raw){
  const normal=raw.toLowerCase().replaceAll('’',"'");let entry=coreEntry(normal);if(entry)return entry;
  const candidates=[normal];if(normal.endsWith("'s"))candidates.push(normal.slice(0,-2));if(normal.endsWith('ies'))candidates.push(normal.slice(0,-3)+'y');if(normal.endsWith('s'))candidates.push(normal.slice(0,-1),normal.slice(0,-2));if(normal.endsWith('ing')){const b=normal.slice(0,-3);candidates.push(b,b+'e',b.at(-1)===b.at(-2)?b.slice(0,-1):b);}if(normal.endsWith('ed')){const b=normal.slice(0,-2);candidates.push(b,normal.slice(0,-1),b.at(-1)===b.at(-2)?b.slice(0,-1):b);}
  for(let w of [...new Set(candidates)].filter(Boolean)){
    const data=await fetchShard(w[0]);let d=data[w];
    if(d?.length===1){w=d[0];d=(await fetchShard(w[0]))[w];}
    if(d?.length>1)return {word:w,phonetic:d[0],meaning:d[1],cet6:!!d[2]};
  }
  return null;
}
async function lookupWord(word,index,anchor){
  const rect=anchor?.getBoundingClientRect?.();
  if(rect){const stable={left:rect.left,top:rect.top,bottom:rect.bottom};anchor={getBoundingClientRect:()=>stable};}
  const seq=++lookupSequence,a=currentArticle();if(!(currentSource()&&(!a||state.surface==='source')))selectSentence(index);
  const meta=currentSource(),external=meta&&(!a||state.surface==='source');
  const context=external?($('#source-context')?.value.trim()||''):(a?.sentences[index]?.en||''),source=external?sourceTitle(meta):(a?.subtitle||a?.title||'');
  currentLookup={word,context,source,articleId:a?.id||meta?.id,index,entry:null,anchor};
  showLookup('<div class="lookup-top"><strong>'+esc(word)+'</strong><button class="icon-btn" data-action="close-lookup" aria-label="关闭查词">'+icon('close',14)+'</button></div><p class="lookup-definition">正在查找词义…</p>',anchor);
  try{
    const e=await findWord(word);if(seq!==lookupSequence||!currentLookup)return;
    currentLookup.entry=e;renderLookup(e);
  }catch{
    if(seq!==lookupSequence||!currentLookup)return;
    showLookup(`<div class="lookup-top"><strong>${esc(word)}</strong><button class="icon-btn" data-action="close-lookup" aria-label="关闭">${icon('close',14)}</button></div><p class="lookup-definition">词典暂时未能加载，请重试。</p><button class="btn small full-width" data-action="retry-lookup">重新查词</button>`,anchor);
  }
}
function showLookup(html,anchor){
  const root=$('#lookup-root');root.innerHTML=`<div class="lookup" role="dialog" aria-label="单词释义">${html}</div>`;
  const el=$('.lookup'),rect=anchor?.getBoundingClientRect?.()||{left:innerWidth/2-150,top:160,bottom:190};
  const w=el.offsetWidth,h=el.offsetHeight;const x=Math.max(12,Math.min(innerWidth-w-12,rect.left-15));let y=rect.bottom+10;
  if(y+h>innerHeight-15)y=Math.max(12,rect.top-h-10);
  el.style.left=x+'px';el.style.top=Math.max(12,Math.min(innerHeight-h-12,y))+'px';
}
function renderLookup(e){
  const l=currentLookup;if(!l)return;
  const w=e?.word||l.word,already=!!state.words[w],newContext=already&&l.articleId&&!wordBelongsToSource(state.words[w],l.articleId);
  showLookup(`<div class="lookup-top"><strong>${esc(w)}</strong><div><button class="icon-btn" data-action="speak-word" data-word="${esc(w)}" aria-label="朗读 ${esc(w)}">${icon('sound',15)}</button><button class="icon-btn" data-action="close-lookup" aria-label="关闭查词">${icon('close',14)}</button></div></div>${e?`<div class="lookup-phonetic">${e.phonetic?`/${esc(e.phonetic)}/`:''} ${e.cet6?'<span class="tag">CET6</span>':''}${w!==l.word?` · 原形（${esc(l.word)}）`:''}</div><div class="lookup-definition">${esc(e.meaning)}</div><div class="lookup-context">${l.context?'原句：'+esc(l.context):'收藏时会保留当前文章出处。'}</div><button class="btn ${already&&!newContext?'':'primary'} full-width" data-action="save-lookup">${icon(already&&!newContext?'check':'plus',13)} ${newContext?'已收藏 · 记录本篇语境':already?'已加入词库 · 点击移除':'加入我的词库'}</button><div class="lookup-foot">ECDICT 英汉词典 · 释义需结合原句判断</div>`:`<p class="lookup-definition">本地词典暂未收录这个词。你可以补充释义，或前往外部词典查询。</p><div class="lookup-manual"><label for="manual-meaning">我的释义</label><input id="manual-meaning" placeholder="输入这个词在文中的意思"><button class="btn primary" data-action="save-manual">${icon('plus',12)} 收藏手动释义</button><a href="https://www.youdao.com/result?word=${encodeURIComponent(w)}&lang=en" target="_blank" rel="noopener noreferrer">前往有道查词 ${icon('external',11)}</a></div>`}`,l.anchor);
}
function closeLookup(){currentLookup=null;lookupSequence++;$('#lookup-root').innerHTML='';}
function toggleWord(entry,context='',articleId='',source=''){
  if(state.words[entry.word]&&articleId&&!wordBelongsToSource(state.words[entry.word],articleId)){
    const w=state.words[entry.word];w.occurrences=[...(w.occurrences||[]),{context,articleId,source,added:Date.now()}];toast('已保存这个词在本篇的语境。');
  }
  else if(state.words[entry.word]){delete state.words[entry.word];toast('已移出词库');}
  else{state.words[entry.word]={...entry,context,articleId,source,added:Date.now(),mastered:false,reviews:0};toast('已加入词库，连同原句一起记住。');}
  persist();const count=$('#word-count');if(count)count.textContent=words().length;
  refreshReaderWords();
  refreshSourceWords();
}

function openModal(html,wide=false){
  modalFocus=document.activeElement;closeLookup();
  $('#modal-root').innerHTML=`<div class="modal-overlay"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-label="操作面板">${html}</section></div>`;
  document.body.style.overflow='hidden';requestAnimationFrame(()=>$('.modal input,.modal textarea,.modal button')?.focus());
}
function closeModal(){
  $('#modal-root').innerHTML='';document.body.style.overflow='';pendingImport=null;review=null;modalFocus?.focus?.();
}
function modalHeader(title){return `<div class="modal-header"><h2>${title}</h2><button class="icon-btn" data-action="close-modal" aria-label="关闭对话框">${icon('close',18)}</button></div>`;}
function openSources(){
  openModal(`${modalHeader('资料与来源')}<p class="modal-description">已从你提供的本地真题资料整理 ${studyArticles().length} 篇 C 篇全文，配有 AI 辅助逐句参考译文、重点表达说明与点词功能。译文未宣称全部人工精翻，均可在「编辑」中调整。</p>${coverageSummary()}<ul class="source-list"><li><a href="https://github.com/YinsinSirius/CET6-Resources" target="_blank" rel="noopener noreferrer">CET6-Resources · 你提供的资料来源 ${icon('external',11)}</a><small>网页中的 60 篇全文来自你提供的本地文件夹；原始文件未被改动。</small></li><li><a href="https://english-exam.lazynote.cn/cet6/sections/reading/" target="_blank" rel="noopener noreferrer">懒笔记 · 六级仔细阅读目录 ${icon('external',11)}</a><small>另保留 ${sourcePapers().length} 篇原站入口，供查看试卷、解析或补充缺失场次；这些入口不代表正文均已入库。</small></li>${DATA.sources.filter(s=>!s.url.includes('YinsinSirius')).map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ${icon('external',11)}</a><small>${esc(s.note)}</small></li>`).join('')}</ul><div class="content-status" style="margin-top:18px;margin-bottom:0">精读标题为学习概括，并非试卷原题。学习记录仅保存在当前浏览器，可在学习进度页备份。<br>词典保留 <a href="./dict/LICENSE.txt" target="_blank">MIT 许可</a>，词典释义需结合原句判断。</div>`);
}
function openImport(edit=false){
  const a=edit?currentArticle():null,p=currentPeriod();if(a?.demo){toast('原创示范可添加个人笔记；真题可通过导入新增。');return;}
  const m=state.article.match(/^paper-(\d{4}\.\d{2})-(\d)-(\d)$/);
  const period=a?.period||(m?m[1]:p.future?'2026.06':p.id),set=a?.set||Number(m?.[2])||1,pass=a?.passage||Number(m?.[3])||1;
  const joinSentences=(field)=>a?a.sentences.map(s=>s[field]||'').join('\n'):'';
  openModal(`${modalHeader(edit?'编辑本篇资料':'把你的资料，带进精读室')}<p class="modal-description">粘贴你持有的英文原文与中文译文，或导入结构化 JSON。双语按行对齐；空行可保留分段。只有英文也可先导入，译文之后再补充。</p>
    <div class="file-area"><label class="btn small">${icon('upload',12)} 选择资料文件<input type="file" id="material-file" accept=".json,.txt,.md" hidden></label><span id="file-status">支持 .txt / .md 原文，或含逐句翻译的 .json；PDF / Word 请先复制文字。</span><button class="btn small" data-action="download-template">下载 JSON 模板</button></div>
    <form id="import-form"><div class="form-grid"><label class="form-field">考次<select name="period">${DATA.periods.filter(p=>!p.future).map(p=>`<option value="${p.id}" ${p.id===period?'selected':''}>${p.year} 年 ${p.month} 月</option>`).join('')}</select></label><label class="form-field">套卷<select name="set">${[1,2,3].map(n=>`<option value="${n}" ${set===n?'selected':''}>第 ${n} 套</option>`).join('')}</select></label><label class="form-field">篇目<select name="passage">${[1,2].map(n=>`<option value="${n}" ${pass===n?'selected':''}>Passage ${n}</option>`).join('')}</select></label><label class="form-field">主题<input name="topic" placeholder="如：教育与社会" maxlength="40" value="${esc(a?.topic||'')}"></label><label class="form-field full">英文标题（可选，真题无标题时自行概括）<input name="title" maxlength="160" placeholder="如：Technology and human attention" value="${esc(a?.title||'')}"></label><label class="form-field full">中文标题（可选）<input name="subtitle" maxlength="100" placeholder="为这篇文章留一个容易记住的名字" value="${esc(a?.subtitle||'')}"></label></div>
    <div class="form-texts"><label class="form-field">英文原文 · 一行一句<textarea name="english" placeholder="粘贴英文原文…">${esc(joinSentences('en'))}</textarea></label><label class="form-field">中文精翻 · 与英文逐行对应<textarea name="chinese" placeholder="粘贴对应译文；暂无译文可留空…">${esc(joinSentences('zh'))}</textarea></label></div><div class="form-hint">若同时输入译文，英文与中文的非空行数必须一致。JSON 可同时导入多篇；文件内容只在当前浏览器处理。</div><div id="import-error" class="form-error" role="alert"></div><div class="modal-footer"><small>将保存在本机，建议定期导出备份。<br>导入后可补充每句的句式笔记。</small><button type="submit" class="btn primary">${icon('check',14)} ${edit?'保存修改':'导入并开始精读'}</button></div></form>`,true);
  if(a)pendingImport={editing:a.id,notes:a.sentences.map((s,i)=>noteFor(a,i)),paragraphs:a.sentences.map(s=>s.paragraph)};
}
function errorImport(message){const el=$('#import-error');el.textContent=message;el.classList.add('visible');el.scrollIntoView({block:'nearest'});}
function normalizeArticle(raw){
  if(!raw||typeof raw!=='object')throw new Error('文章格式不正确。');
  const period=String(raw.period||''),set=Number(raw.set),passage=Number(raw.passage);
  const p=DATA.periods.find(p=>p.id===period);if(!p||p.future)throw new Error('考次必须是目录中已经举行的考试。');
  if(![1,2,3].includes(set)||![1,2].includes(passage))throw new Error('套卷须为 1—3，篇目须为 1 或 2。');
  if(!Array.isArray(raw.sentences)||!raw.sentences.length||raw.sentences.length>500)throw new Error('每篇须含 1—500 个句子。');
  const sentences=raw.sentences.map((s,i)=>{
    if(!s||typeof s.en!=='string'||!s.en.trim())throw new Error(`第 ${i+1} 句缺少英文原文。`);
    if(s.en.length>10000||String(s.zh||'').length>10000||String(s.note||'').length>10000)throw new Error('单句文字过长，请检查材料。');
    return{en:s.en.trim(),zh:String(s.zh||'').trim(),note:String(s.note||'').trim(),paragraph:Number.isInteger(s.paragraph)?s.paragraph:Math.floor(i/4)};
  });
  return{id:`paper-${period}-${set}-${passage}`,year:p.year,period,set,passage,title:String(raw.title||`${period} · Section C · Passage ${passage}`).slice(0,160),subtitle:String(raw.subtitle||'').slice(0,100),topic:String(raw.topic||'Section C').slice(0,40),source:'个人导入资料',demo:false,sentences};
}
function installArticles(items,notes={}){
  const normalized=items.map(normalizeArticle);const ids=normalized.map(a=>a.id);if(new Set(ids).size!==ids.length)throw new Error('同一份 JSON 存在重复的考次、套卷与篇目。');
  const collisions=normalized.filter(a=>state.imports.some(old=>old.id===a.id));
  const commit=()=>{
    for(const a of normalized){const at=state.imports.findIndex(old=>old.id===a.id);if(at>=0)state.imports[at]=a;else state.imports.push(a);delete state.progress[a.id];}
    persist();closeModal();openArticle(normalized[0].id);toast(`已导入 ${normalized.length} 篇文章。`);
  };
  if(collisions.length&&!notes.editing){openModal(`${modalHeader('替换已有文章？')}<p class="modal-description">${collisions.length} 篇资料与已有考次、套卷、篇目相同。替换会更新这些文章的内容与笔记，并重置其精读进度；已收藏词汇仍会保留。</p><div class="modal-footer"><button class="btn" data-action="close-modal">取消</button><button class="btn primary" id="confirm-replace">替换并导入</button></div>`);$('#confirm-replace').onclick=commit;}
  else commit();
}
function submitImport(form){
  try{
    if(pendingImport?.articles){installArticles(pendingImport.articles);return;}
    const f=new FormData(form),english=String(f.get('english')||'').trim(),chinese=String(f.get('chinese')||'').trim();
    if(!english)throw new Error('请先粘贴英文原文。');
    let lines=english.split(/\r?\n/).filter(s=>s.trim());const zhLines=chinese?chinese.split(/\r?\n/).filter(s=>s.trim()):[];
    if(zhLines.length&&zhLines.length!==lines.length)throw new Error(`英文有 ${lines.length} 行，中文有 ${zhLines.length} 行。请调整为一行英文对应一行中文，或先留空译文。`);
    let sentences;
    if(!zhLines.length&&lines.length<=3){sentences=[];english.split(/\n\s*\n/).forEach((paragraph,pi)=>{const seg=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('en',{granularity:'sentence'}).segment(paragraph.replaceAll('\n',' '))].map(x=>x.segment):paragraph.match(/[^.!?]+[.!?]+(?:["')]*\s*|$)|.+$/g)||[paragraph];for(const en of seg.filter(x=>x.trim()))sentences.push({en:en.trim(),zh:'',note:'',paragraph:pi});});}
    else{let pi=0,i=0;sentences=[];for(const line of english.split(/\r?\n/)){if(!line.trim()){pi++;continue;}sentences.push({en:line,zh:zhLines[i]||'',note:pendingImport?.notes?.[i]||'',paragraph:pendingImport?.paragraphs?.[i]??pi});i++;}}
    const a={period:f.get('period'),set:Number(f.get('set')),passage:Number(f.get('passage')),title:f.get('title'),subtitle:f.get('subtitle'),topic:f.get('topic'),sentences};
    installArticles([a],pendingImport||{});
  }catch(e){errorImport(e.message);}
}
async function handleMaterialFile(file){
  if(!file)return;if(file.size>5*1024*1024){errorImport('文件请小于 5 MB。');return;}
  try{
    const content=await file.text();if(file.name.toLowerCase().endsWith('.json')){
      const data=JSON.parse(content),list=Array.isArray(data)?data:Array.isArray(data.articles)?data.articles:[data];
      if(!list.length||list.length>120)throw new Error('一次支持导入 1—120 篇文章。');
      const normalized=list.map(normalizeArticle);
      pendingImport={articles:normalized};$('#file-status').textContent=`已读取 ${normalized.length} 篇双语文章。点击「导入并开始精读」保存。`;
      $('#import-form').querySelectorAll('input,select,textarea').forEach(el=>el.disabled=true);
      $('#import-error').classList.remove('visible');
    }else{
      pendingImport=null;$('#import-form').querySelectorAll('input,select,textarea').forEach(el=>el.disabled=false);$('#import-form [name="english"]').value=content;$('#file-status').textContent=`已载入 ${file.name}，请补充考次与译文。`;
    }
  }catch(e){errorImport('文件未导入：'+(e instanceof SyntaxError?'JSON 格式不正确。':e.message));}
}
function download(name,content,type='application/json'){
  const b=new Blob([content],{type:type+';charset=utf-8'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
}
function downloadTemplate(){download('拾词-批量导入模板.json',JSON.stringify({articles:[{period:'2026.06',set:1,passage:1,title:'Your article title',subtitle:'你的文章标题',topic:'学习与社会',sentences:[{en:'Careful reading helps us understand an argument.',zh:'仔细阅读有助于我们理解一套论证。',note:'help somebody do something：帮助某人做某事。',paragraph:0},{en:'It also gives new words a meaningful context.',zh:'它也能为新词提供有意义的语境。',note:'It 指前一句的 careful reading。',paragraph:0}]}]},null,2));}
function openNote(index){
  const a=currentArticle();if(!a?.sentences[index])return;selectedSentence=index;
  const note=state.progress[a.id]?.notes?.[index]??a.sentences[index].note??'';
  openModal(`${modalHeader('第 '+(index+1)+' 句 · 我的精读手记')}<blockquote class="annotation-quote">${esc(a.sentences[index].en)}</blockquote><form id="note-form" data-index="${index}"><label class="form-field">句式结构、短语或你的理解<textarea name="note" maxlength="10000" placeholder="写下一点自己的理解…">${esc(note)}</textarea></label><div class="modal-footer"><small>笔记只保存在当前浏览器。</small><button type="submit" class="btn primary">保存笔记</button></div></form>`);
}
function noteFor(a,index){return state.progress[a.id]?.notes?.[index]??a.sentences[index]?.note??'';}
// Store personal notes separately so editing an original demonstration never changes its source text.
const originalRenderRail=renderRail;
renderRail=function(a){if(!a)return originalRenderRail(a);const copy={...a,sentences:a.sentences.map((s,i)=>({...s,note:noteFor(a,i)}))};return originalRenderRail(copy);};

function startReview(){
  const queue=words().filter(w=>!w.mastered);if(!queue.length)queue.push(...words());if(!queue.length){toast('先在文章中收藏一些词。');return;}
  review={queue:[...queue].sort(()=>Math.random()-.5).slice(0,20),index:0,remembered:0,answer:false};showReview();
}
function showReview(){
  const r=review;if(!r)return;
  if(r.index>=r.queue.length){const result={...r};openModal(`${modalHeader('又积累了一点理解')}<div class="review-body">${icon('leaf',35)}<h2 style="font-weight:400">本轮复习完成</h2><p class="modal-description">复习 ${result.queue.length} 个词，记住了 ${result.remembered} 个。<br>没记牢的词仍在「待巩固」里，下一次再遇见。</p><button class="btn primary" data-action="finish-review">回到我的词库</button></div>`);return;}
  const w=r.queue[r.index];const snapshot=r;
  openModal(`${modalHeader('词卡复习')}<div class="review-body"><div class="review-number">${String(r.index+1).padStart(2,'0')} / ${String(r.queue.length).padStart(2,'0')}</div><h3 class="flash-word">${esc(w.word)}</h3><div class="flash-phonetic">${w.phonetic?'/'+esc(w.phonetic)+'/':''}<button class="icon-btn" data-action="speak-word" data-word="${esc(w.word)}" aria-label="朗读">${icon('sound',15)}</button></div><p class="flash-context">${w.context?'“'+esc(w.context)+'”':'试着回想这个词的意思。'}</p>${r.answer?`<div class="flash-answer">${esc(w.meaning)}</div><div class="flash-actions"><button class="btn" data-action="review-answer" data-remembered="false">还不熟，再练练</button><button class="btn primary" data-action="review-answer" data-remembered="true">${icon('check',14)} 记住了</button></div>`:`<button class="btn primary" data-action="reveal-answer">翻看释义 ${icon('arrow',12)}</button>`}<div class="review-progress"><div style="width:${r.index/r.queue.length*100}%"></div></div></div>`);
  review=snapshot;
}
function answerReview(remembered){
  if(!review)return;const w=review.queue[review.index],stored=state.words[w.word];if(stored){stored.reviews=(stored.reviews||0)+1;stored.mastered=remembered;stored.lastReviewed=Date.now();}if(remembered)review.remembered++;review.index++;review.answer=false;persist();showReview();
}
function backup(){download('拾词-学习备份-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({format:'shici-backup-v1',exportedAt:new Date().toISOString(),state},null,2));toast('备份已导出，包含文章、词库和笔记。');}
function restoreDialog(){
  openModal(`${modalHeader('恢复学习备份')}<p class="modal-description">选择由本站导出的学习备份。预览备份后再确认恢复；恢复会替换当前浏览器中的学习记录，建议先导出当前备份。</p><div class="file-area"><label class="btn">${icon('upload',14)} 选择备份文件<input id="restore-file" type="file" accept=".json" hidden></label><span id="restore-status">只读取你选择的文件。</span></div><div id="restore-error" class="form-error"></div><div class="modal-footer"><button class="btn" data-action="backup">先备份当前记录</button><button class="btn primary" id="confirm-restore" disabled>确认恢复</button></div>`);
}
async function prepareRestore(file){
  const status=$('#restore-status'),error=$('#restore-error'),button=$('#confirm-restore');button.disabled=true;
  try{
    if(!file||file.size>15*1024*1024)throw new Error('请选择小于 15 MB 的备份文件。');
    const d=JSON.parse(await file.text());if(d.format!=='shici-backup-v1'||!d.state||typeof d.state!=='object')throw new Error('不是有效的拾词备份。');
    const s=d.state;if(!Array.isArray(s.imports)||!s.words||!s.progress)throw new Error('备份缺少必要字段。');
    s.imports=s.imports.map(normalizeArticle);s.words=objectOrEmpty(s.words);s.progress=objectOrEmpty(s.progress);s.sourceProgress=objectOrEmpty(s.sourceProgress);
    if(Object.values(s.words).some(w=>!w||typeof w.word!=='string'||typeof w.meaning!=='string'))throw new Error('词库格式不正确。');
    s.size=Math.max(15,Math.min(24,Number(s.size)||18));
    status.textContent=`${s.imports.length} 篇文章 · ${Object.keys(s.words).length} 个词 · 备份时间 ${new Date(d.exportedAt).toLocaleString('zh-CN')}`;error.classList.remove('visible');button.disabled=false;
    button.onclick=()=>{state={...state,...s,view:'progress'};persist();closeModal();render();toast('学习记录已恢复。');};
  }catch(e){error.textContent=e.message;error.classList.add('visible');}
}

document.addEventListener('click',async e=>{
  const word=e.target.closest('[data-word].word');if(word){lookupWord(word.dataset.word,Number(word.dataset.index),word);return;}
  const button=e.target.closest('[data-action]');
  if(!button){if(!e.target.closest('.lookup'))closeLookup();return;}
  const action=button.dataset.action;if(button.tagName==='A'&&action)e.preventDefault();
  if(handleWritingAction(action,button)||handleStudyAction(action)||handleSourceAction(action,button))return;
  switch(action){
    case 'reload':location.reload();break;
    case 'view':setView(button.dataset.view);break;
    case 'year':{const year=Number(button.dataset.year),periods=DATA.periods.filter(p=>p.year===year&&!p.future);const p=periods.filter(p=>articles().some(a=>a.period===p.id)).at(-1)||periods.at(-1)||DATA.periods.find(p=>p.year===year);openArticle(`paper-${p.id}-1-1`);break;}
    case 'article':openArticle(button.dataset.id);break;
    case 'mode':state.mode=button.dataset.mode;persist();{const scroll=window.scrollY;render();window.scrollTo(0,scroll);}break;
    case 'font':state.size=Math.max(15,Math.min(24,state.size+Number(button.dataset.delta)));persist();applyFont();if($('.font-size-val'))$('.font-size-val').textContent=state.size;break;
    case 'select-sentence':{const i=Number(button.dataset.index);selectSentence(i);if(!noteFor(currentArticle(),i))openNote(i);break;}
    case 'complete-sentence':markSentence(Number(button.dataset.index));break;
    case 'complete-article':{const a=currentArticle();if(!a)break;state.progress[a.id]={...state.progress[a.id],done:a.sentences.map((_,i)=>i),updated:Date.now()};persist();const scroll=window.scrollY;render();window.scrollTo(0,scroll);toast('这一篇，认真读懂了。');break;}
    case 'speak-word':say(button.dataset.word);break;
    case 'speak-sentence':{const s=currentArticle()?.sentences[Number(button.dataset.index)];if(s)say(s.en);break;}
    case 'speak-article':{if(speaking){stopSpeech();button.innerHTML=icon('sound',12)+' 朗读全文';}else{const a=currentArticle();if(a){say(a.sentences.map(s=>s.en).join(' '),()=>{button.innerHTML=icon('sound',12)+' 朗读全文';});button.innerHTML=icon('sound',12)+' 停止朗读';}}break;}
    case 'close-lookup':closeLookup();break;
    case 'retry-lookup':if(currentLookup){const l=currentLookup;lookupWord(l.word,l.index,l.anchor);}break;
    case 'save-lookup':if(currentLookup?.entry){const l=currentLookup;toggleWord(l.entry,l.context,l.articleId,l.source);renderLookup(l.entry);}break;
    case 'save-manual':{const meaning=$('#manual-meaning')?.value.trim();if(!meaning){toast('请先填写释义。');break;}const l=currentLookup;if(l){toggleWord({word:l.word,meaning,phonetic:'',cet6:false},l.context,l.articleId,l.source);closeLookup();}break;}
    case 'save-keyword':{const a=currentArticle(),w=articleKeywords(a).find(w=>w.word===button.dataset.word);if(w)toggleWord(w,w.context,a.id,w.source);break;}
    case 'rail-word':{const a=currentArticle(),i=Math.max(0,a.sentences.findIndex(s=>s.en.toLowerCase().includes(button.dataset.word)));lookupWord(button.dataset.word,i,button);break;}
    case 'collect-all':{const a=currentArticle(),keys=articleKeywords(a);let count=0;for(const w of keys)if(!state.words[w.word]){state.words[w.word]={...w,added:Date.now(),mastered:false,reviews:0};count++;}persist();refreshReaderWords();if($('#word-count'))$('#word-count').textContent=words().length;toast(count?`已收藏 ${count} 个重点词。`:'本篇重点词已经都在词库里了。');break;}
    case 'import':openImport();break;
    case 'edit-article':openImport(true);break;
    case 'sources':openSources();break;
    case 'close-modal':closeModal();break;
    case 'download-template':downloadTemplate();break;
    case 'edit-note':openNote(Number(button.dataset.index));break;
    case 'filter-words':wordFilter=button.dataset.filter;render();break;
    case 'master-word':if(state.words[button.dataset.word]){state.words[button.dataset.word].mastered=!state.words[button.dataset.word].mastered;persist();render();}break;
    case 'remove-word':delete state.words[button.dataset.word];persist();render();toast('已移出词库');break;
    case 'export-words':if(!words().length){toast('词库还是空的，先收藏几个词。');break;}download('拾词-我的词库.json',JSON.stringify({format:'shici-words-v1',exportedAt:new Date().toISOString(),words:words()},null,2));break;
    case 'backup':backup();break;
    case 'restore':restoreDialog();break;
    case 'review':startReview();break;
    case 'reveal-answer':if(review){review.answer=true;showReview();}break;
    case 'review-answer':answerReview(button.dataset.remembered==='true');break;
    case 'finish-review':closeModal();setView('vocab');break;
    case 'menu':$('.sidebar').classList.toggle('open');$('.mobile-side-backdrop').classList.toggle('open');break;
    case 'close-menu':$('.sidebar').classList.remove('open');$('.mobile-side-backdrop').classList.remove('open');break;
  }
});
document.addEventListener('change',e=>{
  if(e.target.id==='source-directory-year'){const target=$('#source-directory-entries');if(target)target.innerHTML=renderSourceDirectoryEntries(e.target.value);}
  if(e.target.id==='period-select')openArticle(`paper-${e.target.value}-1-1`);
  if(e.target.id==='highlight-toggle'){state.highlight=e.target.checked;persist();refreshReaderWords();}
  if(e.target.id==='material-file')handleMaterialFile(e.target.files[0]);
  if(e.target.id==='restore-file')prepareRestore(e.target.files[0]);
});
document.addEventListener('input',e=>{if(e.target.id==='vocab-search'){searchText=e.target.value;$('#word-results').innerHTML=renderWordResults();}});
document.addEventListener('submit',e=>{
  if(e.target.id==='source-lookup-form'){e.preventDefault();submitSourceLookup(e.target);return;}
  if(e.target.id==='source-note-form'){e.preventDefault();saveSourceNote(e.target);return;}
  if(e.target.id==='import-form'){e.preventDefault();submitImport(e.target);}
  if(e.target.id==='note-form'){
    e.preventDefault();const a=currentArticle(),i=Number(e.target.dataset.index),p=state.progress[a.id]||{done:[]};p.notes={...p.notes,[i]:new FormData(e.target).get('note')};state.progress[a.id]=p;persist();closeModal();selectSentence(i);toast('笔记已保存。');
  }
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if($('.lookup'))closeLookup();else if($('.modal'))closeModal();else if($('.sidebar.open')){$('.sidebar').classList.remove('open');$('.mobile-side-backdrop').classList.remove('open');}}
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('.word')){e.preventDefault();lookupWord(e.target.dataset.word,Number(e.target.dataset.index),e.target);}
  if(e.key==='Tab'&&$('.modal')){const focusable=$$('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',$('.modal')).filter(el=>el.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
});
window.addEventListener('resize',()=>closeLookup());
window.addEventListener('beforeunload',()=>stopSpeech());
window.addEventListener('storage',e=>{if(e.key===STORAGE)toast('另一标签页更新了学习记录，刷新后查看最新内容。');});
boot();
