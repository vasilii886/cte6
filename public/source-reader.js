'use strict';

let SOURCE_INDEX=null;
let SOURCE_ACTIVE_FRAME=null;

async function loadSourceIndex(){
  try{
    const r=await fetch('./source-index.json?v=20261105-1');
    if(!r.ok)throw new Error('source index unavailable');
    const d=await r.json();
    if(!Array.isArray(d.papers))throw new Error('invalid source index');
    const allowed=new Set(['english-exam.lazynote.cn','downloads.lazynote.cn']);
    SOURCE_INDEX={...d,papers:d.papers.filter(p=>{
      if(!/^paper-202[0-6]\.\d{2}-[1-3]-[12]$/.test(p.id))return false;
      return Object.values(p.links||{}).every(value=>{try{const u=new URL(value);return u.protocol==='https:'&&allowed.has(u.hostname);}catch{return false;}});
    })};
  }catch{SOURCE_INDEX=null;}
}
function sourcePapers(){return SOURCE_INDEX?.papers||[];}
function sourceById(id){return sourcePapers().find(s=>s.id===id);}
function wordBelongsToSource(word,id){return word?.articleId===id||(Array.isArray(word?.occurrences)&&word.occurrences.some(o=>o.articleId===id));}
function currentSource(){return sourceById(state.article);}
function sourceTitle(s){return `${s.period.replace('.',' 年 ')} 月 · 第 ${s.set} 套 · Passage ${s.passage}`;}
function setsForPeriod(p){
  const available=sourcePapers().filter(s=>s.period===p.id).map(s=>s.set);
  const imported=[...studyArticles(),...state.imports].filter(a=>a.period===p.id).map(a=>a.set);
  return [...new Set(available.length?[...available,...imported]:Array.from({length:p.sets},(_,i)=>i+1))].sort((a,b)=>a-b);
}
function sourceTabLabel(tab){return ({article:'原文精读',analysis:'译文与题目解析',paper:'真题卷面'})[tab]||'原文精读';}
function safeSourceTab(){return ['article','analysis','paper'].includes(state.sourceTab)?state.sourceTab:'article';}

function renderSourcePaper(source){
  const tab=safeSourceTab(),p=state.sourceProgress[source.id]||{},a=currentArticle();
  return `<div class="source-heading"><div class="tags"><span class="tag">六级真题 · SECTION C</span><span class="tag outline">来源：懒笔记</span>${p.read?'<span class="tag">已读</span>':''}</div><h2 class="source-title">${source.period.slice(0,4)} 年 ${Number(source.period.slice(-2))} 月</h2><p class="source-subtitle">第 ${source.set} 套 · Passage ${source.passage===1?'One':'Two'} <span>仔细阅读 ${source.passage===1?'46—50':'51—55'} 题</span></p><div class="source-intro">原文与译文解析在原站阅读。本站为这篇文章保留你的词汇、笔记和阅读状态。</div></div>
    <div class="source-tabbar"><div class="segmented" role="group" aria-label="原站阅读内容">${['article','analysis','paper'].map(t=>`<button class="${tab===t?'active':''}" data-action="source-tab" data-tab="${t}">${sourceTabLabel(t)}</button>`).join('')}</div><a id="source-open-link" class="source-open-link" href="${esc(source.links[tab])}" target="_blank" rel="noopener noreferrer">新窗口打开 ${icon('external',11)}</a></div>
    <div class="source-frame-slot" id="source-frame-slot">${renderSourceFrame(source)}</div>
    <div class="source-quicklinks"><span>${icon('download',12)} 原站文件</span><a href="${esc(source.links.pdf)}" target="_blank" rel="noopener noreferrer">真题 PDF ${icon('external',10)}</a><a href="${esc(source.links.answerPdf)}" target="_blank" rel="noopener noreferrer">解析 PDF ${icon('external',10)}</a><a href="${esc(source.links.word)}" target="_blank" rel="noopener noreferrer">Word ${icon('external',10)}</a><button data-action="import">${icon('upload',11)} ${a?'重新导入':'导入到本站精读'}</button></div>
    <div class="source-bottom"><div class="source-pagination">${sourcePageButton(-1)}${sourcePageButton(1)}</div><button class="btn small ${p.read?'':'primary'}" data-action="source-mark-read">${icon('check',12)} ${p.read?'已读 · 取消标记':'标记本篇已读'}</button></div>`;
}
function renderSourceFrame(source){
  if(SOURCE_ACTIVE_FRAME?.id===source.id){
    const tab=safeSourceTab();
    return `<div class="source-frame-caption"><span>${icon('external',11)} 由 english-exam.lazynote.cn 提供 · ${sourceTabLabel(tab)}</span><button data-action="source-close-frame" aria-label="收起原站阅读">${icon('close',12)} 收起</button></div><iframe class="source-frame" title="懒笔记 · ${esc(sourceTitle(source))} · ${sourceTabLabel(tab)}" src="${esc(source.links[tab])}" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads" loading="eager"></iframe><div class="source-frame-fallback">如果原站加载缓慢或无法显示，<a href="${esc(source.links[tab])}" target="_blank" rel="noopener noreferrer">在新窗口打开 ${icon('external',10)}</a>。</div>`;
  }
  return `<div class="source-welcome"><div class="source-welcome-symbol">${icon('book',32)}</div><div class="overline">READ THE ORIGINAL</div><h3>这一篇，已经为你找到。</h3><p>原文、译文和题目解析均有对应入口。<br>载入原站后，在这里阅读；遇到生词可用旁边的查词框收藏。</p><button class="btn primary" data-action="source-load-frame">${icon('book',14)} 在本页载入${sourceTabLabel(safeSourceTab())}</button><span class="source-attribution">内容直接由懒笔记原站加载，本站不保存全文副本。</span></div>`;
}
function sourcePageButton(delta){
  const list=sourcePapers(),i=list.findIndex(s=>s.id===state.article),next=list[i+delta];
  return `<button class="btn small" data-action="source-next" data-id="${esc(next?.id||'')}" ${next?'':'disabled'}>${delta<0?'← 上一篇':'下一篇 →'}</button>`;
}
function renderSourceRail(source){
  const record=state.sourceProgress[source.id]||{};
  return `<section class="rail-card"><div class="rail-title">${icon('search',14)} 随手查词 <small>EN → 中文</small></div><p class="annotation-text" style="margin-bottom:13px">原站阅读时输入单词，即可查义并收藏到这一篇。</p><form id="source-lookup-form"><label class="source-field">英文单词<input id="source-lookup-word" name="word" type="text" pattern="[A-Za-z]+(?:['’-][A-Za-z]+)*" maxlength="50" placeholder="如：sustainable" required autocomplete="off" spellcheck="false"></label><label class="source-field">文中原句（可选）<textarea id="source-context" name="context" maxlength="2000" placeholder="记住语境，会记得更牢。" rows="2"></textarea></label><button class="btn primary small full-width" type="submit">${icon('search',12)} 查词与收藏</button></form></section>
    <section class="rail-card"><div class="rail-title">${icon('star',14)} 本篇已收藏 <small id="source-saved-count">${words().filter(w=>wordBelongsToSource(w,source.id)).length} 词</small></div><div id="source-saved-words">${renderSourceSavedWords(source)}</div><button class="btn small full-width" data-action="view" data-view="vocab">去词库复习 ${icon('arrow',12)}</button></section>
    <section class="rail-card"><div class="rail-title">${icon('edit',14)} 本篇手记</div><form id="source-note-form"><label class="source-field"><span class="sr-only">我的本篇阅读笔记</span><textarea name="note" rows="5" maxlength="10000" placeholder="文章主旨、长难句、还没读懂的地方…">${esc(record.note||'')}</textarea></label><button class="btn small full-width" type="submit">保存本篇笔记</button></form><div class="source-note-status" id="source-note-status">${record.note?'笔记已保存在本机':'笔记只保存在当前浏览器'}</div></section>
    <div class="tiny-tip">${icon('leaf',18)}<span><strong>想直接点词精读？</strong><br>导入你持有的双语材料后，可切换到本站逐句对照和点击查词。</span></div>`;
}
function renderSourceSavedWords(source){
  const saved=words().filter(w=>wordBelongsToSource(w,source.id));
  return saved.length?saved.slice(0,6).map(w=>`<div class="word-list-item"><button class="word-list-info" data-action="source-saved-word" data-word="${esc(w.word)}" style="text-align:left;padding:0"><strong>${esc(w.word)}</strong><span>${esc(w.meaning.split('\n')[0])}</span></button><span style="color:var(--gold);font-size:14px">★</span></div>`).join(''):'<p class="annotation-text">还没有收藏。查一个文中遇到的词，从这里开始。</p>';
}
function refreshSourceWords(){
  const source=currentSource(),list=$('#source-saved-words');if(!source||!list)return;
  list.innerHTML=renderSourceSavedWords(source);if($('#source-saved-count'))$('#source-saved-count').textContent=words().filter(w=>wordBelongsToSource(w,source.id)).length+' 词';
}
function submitSourceLookup(form){
  const field=form.elements.word,word=field.value.trim();
  if(!/^[A-Za-z]+(?:['’-][A-Za-z]+)*$/.test(word)){toast('请输入一个英文单词，可包含连字符。');field.focus();return;}
  lookupWord(word.toLowerCase(),0,form.querySelector('button'));
}
function saveSourceNote(form){
  const source=currentSource();if(!source)return;
  state.sourceProgress[source.id]={...state.sourceProgress[source.id],note:form.elements.note.value,updated:Date.now()};persist();
  $('#source-note-status').textContent='笔记已保存在本机';toast('本篇笔记已保存。');
}
function renderSourceProgress(){
  const records=sourcePapers().filter(p=>state.sourceProgress[p.id]?.read||state.sourceProgress[p.id]?.note);
  if(!records.length)return '';
  return `<div class="source-progress-heading">原站阅读与笔记 <span>${records.length} 篇</span></div><div class="progress-list" style="margin-bottom:24px">${records.map(p=>`<div class="progress-item"><div><h3>${esc(sourceTitle(p))}</h3><p>${state.sourceProgress[p.id].read?'已读':'已保存笔记'} · 懒笔记原站</p></div><button class="btn small" data-action="article" data-id="${p.id}">回到本篇 ${icon('arrow',11)}</button></div>`).join('')}</div>`;
}
function openSourceDirectory(){
  openModal(`${modalHeader('2020—2026 · C 篇精读目录')}<p class="modal-description"><strong>${readyPaperCount()} 篇已可直接精读</strong>，含英文全文与逐句参考译文。其余篇目保留原站阅读入口，按资料实际覆盖显示。</p>${coverageSummary()}<div class="directory-filter"><label for="source-directory-year">筛选年份</label><select id="source-directory-year"><option value="all">全部年份</option>${[2026,2025,2024,2023,2022,2021,2020].map(y=>`<option value="${y}" ${Number(state.year)===y?'selected':''}>${y} 年</option>`).join('')}</select><span>按年份检索 · 逐句对照 · 点词释义</span></div><div id="source-directory-entries">${renderSourceDirectoryEntries(String(state.year))}</div><div class="form-hint" style="margin-top:17px">全文来自你提供的本地真题资料；其他资料入口来自懒笔记。学习记录保存在当前浏览器。</div>`,true);
}
function renderSourceDirectoryEntries(year){
  const papers=libraryPapers().filter(p=>year==='all'||String(p.year)===year),periods=[...new Set(papers.map(p=>p.period))];
  return periods.map(period=>`<section class="directory-period"><div class="directory-period-title"><strong>${period.slice(0,4)} 年 ${Number(period.slice(-2))} 月</strong><span>${papers.filter(p=>p.period===period&&p.ready).length} 篇已入库 / ${papers.filter(p=>p.period===period).length} 篇</span></div><div class="directory-grid">${papers.filter(p=>p.period===period).map(p=>`<button class="directory-paper ${p.ready?'is-ready':''}" data-action="source-directory-open" data-id="${p.id}"><span class="directory-paper-icon">${icon(p.ready?'check':'external',17)}</span><span><strong>第 ${p.set} 套 · Passage ${p.passage}</strong><small>${p.ready?'全文与译文已就绪 · 直接精读':state.sourceProgress[p.id]?.read?'已读 · 原站入口':'仅原站入口 · 本地资料未含'}</small></span>${icon('chevron',12)}</button>`).join('')}</div></section>`).join('')||'<div class="empty-view">该年份暂未关联篇目。</div>';
}

function handleSourceAction(action,button){
  const source=currentSource();
  switch(action){
    case 'source-directory':openSourceDirectory();return true;
    case 'source-directory-open':closeModal();openArticle(button.dataset.id);return true;
    case 'source-surface':state.surface=button.dataset.surface;persist();render();return true;
    case 'source-load-frame':
      if(!source)return true;
      SOURCE_ACTIVE_FRAME={id:source.id};$('#source-frame-slot').innerHTML=renderSourceFrame(source);return true;
    case 'source-close-frame':SOURCE_ACTIVE_FRAME=null;if(source)$('#source-frame-slot').innerHTML=renderSourceFrame(source);return true;
    case 'source-tab':
      if(!source)return true;
      state.sourceTab=button.dataset.tab;persist();
      $$('.source-tabbar [data-action="source-tab"]').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.sourceTab));
      $('#source-open-link').href=source.links[safeSourceTab()];$('#source-frame-slot').innerHTML=renderSourceFrame(source);return true;
    case 'source-mark-read':{
      if(!source)return true;
      const record=state.sourceProgress[source.id]||{};record.read=!record.read;record.updated=Date.now();state.sourceProgress[source.id]=record;persist();
      button.classList.toggle('primary',!record.read);button.innerHTML=icon('check',12)+(record.read?' 已读 · 取消标记':' 标记本篇已读');
      toast(record.read?'本篇已加入阅读记录。':'已取消本篇已读标记。');return true;
    }
    case 'source-next':if(button.dataset.id)openArticle(button.dataset.id);return true;
    case 'source-saved-word':lookupWord(button.dataset.word,0,button);return true;
    default:return false;
  }
}
