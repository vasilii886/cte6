'use strict';

const WRITING_STORAGE='shici.writing.v1';
let WRITING_GUIDE=null;
let WRITING={drafts:[],activeId:null,stage:'foundation',tab:'compose'};
try{const c=JSON.parse(localStorage.getItem(WRITING_STORAGE)||'{}');if(Array.isArray(c.drafts))WRITING.drafts=c.drafts.filter(d=>d&&typeof d.id==='string'&&typeof d.body==='string'&&['foundation','advanced','final','ability'].includes(d.stage));WRITING.activeId=c.activeId;WRITING.stage=c.stage||'foundation';}catch{}
const writingWords=text=>(String(text||'').match(/[A-Za-z]+(?:['’\-][A-Za-z]+)*|\d+(?:[.,]\d+)*/g)||[]).length;
const shortWritingId=id=>String(id).slice(0,8);
const writingDate=value=>value?new Date(value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
function writingStage(id){return WRITING_GUIDE?.stages.find(s=>s.id===id)||WRITING_GUIDE?.stages[0];}
function writingLocation(submissionId=null){const u=new URL(location.href);u.searchParams.set('view','writing');if(submissionId)u.searchParams.set('submission',submissionId);else u.searchParams.delete('submission');history.replaceState(null,'',u.pathname+u.search+u.hash);}
async function loadWritingGuide(){try{const r=await fetch('./writing-sop.json?v=3.1.0');if(!r.ok)throw Error();WRITING_GUIDE=await r.json();}catch{WRITING_GUIDE=null;}}
function writingPersist(){try{localStorage.setItem(WRITING_STORAGE,JSON.stringify({drafts:WRITING.drafts,activeId:WRITING.activeId,stage:WRITING.stage}));WRITING.localFailed=false;return true;}catch{WRITING.localFailed=true;WRITING.error='本机缓存空间不足，请保存到云端或下载草稿。';return false;}}
function writingDraft(){let d=WRITING.drafts.find(d=>d.id===WRITING.activeId);if(!d){d={id:crypto.randomUUID(),stage:writingStage(WRITING.stage)?.id||'foundation',title:'',prompt:'',body:'',outline:'',minWords:150,maxWords:200,minutes:null,checks:[],version:0,synced:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),parentSubmissionId:null};WRITING.drafts.unshift(d);WRITING.activeId=d.id;writingPersist();}d.checks=Array.isArray(d.checks)?d.checks:[];return d;}
function newWritingDraft(stage=WRITING.stage,base=null){
  const d={id:crypto.randomUUID(),stage:writingStage(stage)?.id||'foundation',title:base?.title?base.title+(base.parentSubmissionId?' · 重写':''):'',prompt:base?.prompt||'',body:base?.body||'',outline:base?.outline||'',minWords:base?.minWords??150,maxWords:base?.maxWords??200,minutes:null,checks:[],version:0,synced:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),parentSubmissionId:base?.parentSubmissionId||null,examId:base?.examId||null};
  WRITING.drafts.unshift(d);WRITING.activeId=d.id;WRITING.stage=d.stage;WRITING.tab='compose';const e=writingExamById(d.examId);if(e)showWritingExam(e);writingLocation();writingPersist();render();window.scrollTo({top:0});
}
function writingStatus(){
  return WRITING.localFailed
    ? '浏览器保存失败，请下载草稿。'
    : '输入内容自动保存在当前浏览器。';
}
function updateWritingIndicators(){
  const d=writingDraft(),wc=writingDraftWords(d),n=document.querySelector('#writing-word-count'),status=document.querySelector('#writing-save-status');
  if(n){n.textContent=writingCountLabel(d);n.classList.toggle('outside-range',wc>0&&(wc<d.minWords||wc>d.maxWords));}
  if(status)status.textContent=writingStatus();const opening=document.querySelector('#writing-opening-status');if(opening)opening.textContent=examOpeningStatus(d);
}
function renderWritingSidebar(){
  if(!WRITING_GUIDE)return '<aside class="sidebar" aria-label="作文练习阶段"><div class="side-note">作文方法暂未加载，请刷新。</div></aside>';
  const d=writingDraft(),stage=d.stage;
  return `<aside class="sidebar writing-sidebar" aria-label="作文练习阶段"><div class="side-title"><strong>作文练习册</strong><span>STEP BY STEP</span></div><div class="writing-stage-list">${WRITING_GUIDE.stages.map(s=>`<button class="writing-stage ${s.id===stage?'active':''}" data-action="writing-stage" data-stage="${s.id}" aria-label="练习阶段 ${s.name}"><span>${s.number}</span><div><strong>${esc(s.name)}</strong><small>${esc(s.tag)}</small></div>${s.id===stage?icon('check',12):icon('chevron',11)}</button>`).join('')}</div><p class="writing-side-copy">阶段由你选择。先把基础练稳，再慢慢往上走。</p><div class="side-divider"></div><button class="btn primary full-width" data-action="writing-new">${icon('plus',13)} 新建练习</button><div class="writing-draft-heading"><span>我的草稿</span><small>${WRITING.drafts.length}</small></div><div class="writing-drafts">${WRITING.drafts.slice(0,12).map(x=>`<button class="writing-draft ${x.id===d.id&&WRITING.tab==='compose'?'active':''}" data-action="writing-open-draft" data-id="${esc(x.id)}"><strong>${esc(x.title||'未命名练习')}</strong><small>${esc(writingStage(x.stage)?.name||'基础款')} · ${writingDraftWords(x)} 词 · 本机</small></button>`).join('')}</div><button class="demo-btn" data-action="writing-guide">${icon('book',14)}<span>本阶段练习方法</span>${icon('chevron',11)}</button><div class="side-note">草稿仅保存在当前浏览器。<br>点击「下载草稿」可备份，或把草稿文件带去批改。</div></aside>`;
}
function renderWriting(){
  if(!WRITING_GUIDE)return '<div class="empty-view"><h2>暂未能加载作文方法</h2><button class="btn" data-action="reload">刷新重试</button></div>';
  const draft=writingDraft(),stage=writingStage(draft.stage);
  return `<div class="writing-page">${crumb('作文练习')}
    <div class="writing-heading"><div><div class="page-eyebrow"><i></i>YOUR WRITING NOTEBOOK</div>
    <h1>${esc(stage.headline)}</h1><p class="page-sub">选一道真题，练好这一稿。作文会自动保存在当前浏览器。</p></div></div>
    ${renderWritingComposer(draft,stage)}
    <footer class="footnote"><span>词库、阅读进度和草稿保存在当前浏览器。</span></footer>
  </div>`;
}
function renderWritingComposer(d,s){
  return `<div class="writing-stage-banner"><div class="writing-badge">${s.number}</div><div><span>当前练习 · ${esc(s.name)}</span><strong>${esc(s.goal)}</strong></div><button class="btn small" data-action="writing-guide">本阶段方法 ${icon('arrow',12)}</button></div><div class="writing-layout"><section class="writing-editor" aria-label="作文输入区"><form id="writing-form"><div class="writing-editor-head"><div><span class="overline">DRAFT / ${esc(shortWritingId(d.id))}</span><h2>${d.parentSubmissionId?'继续写第二稿':'留出一页，写下自己的观点。'}</h2></div><span class="writing-sync-dot ${d.synced?'synced':''}" aria-label="${d.synced?'已同步':'有本机草稿'}"></span></div><div class="writing-fields">${renderExamPicker(d)}<label class="form-field">练习名称<input name="title" maxlength="160" placeholder="例如：自律练习 · 第一稿" value="${esc(d.title)}"></label>${renderWritingPrompt(d)}<div class="writing-range-row"><label>目标最少词数<input name="minWords" type="number" min="0" max="5000" ${writingExamById(d.examId)?.full?'readonly':''} value="${esc(d.minWords)}"></label><span>—</span><label>目标最多词数<input name="maxWords" type="number" min="1" max="5000" ${writingExamById(d.examId)?.full?'readonly':''} value="${esc(d.maxWords)}"></label><label class="writing-minutes">本次用时（分钟，可选）<input name="minutes" type="number" min="0" max="1440" step="0.5" placeholder="不限时可留空" value="${d.minutes??''}"></label></div><details class="writing-outline" ${d.outline?'open':''}><summary>先列一个小提纲 <span>观点 → 理由 → 例子 → 解释</span></summary><label class="sr-only" for="writing-outline">我的写作提纲</label><textarea name="outline" id="writing-outline" rows="4" maxlength="6000" placeholder="我想说明什么？\n用什么具体例子？\n例子为什么能支持我的观点？">${esc(d.outline)}</textarea></details><div class="writing-body-label"><label for="writing-body">英文作文</label><span id="writing-word-count">${esc(writingCountLabel(d))}</span></div><textarea id="writing-body" name="body" class="writing-body" lang="en" spellcheck="true" maxlength="40000" placeholder="从第一句话开始。用空行分段，先写清楚，再慢慢打磨。">${esc(d.body)}</textarea>${writingExamById(d.examId)?.opening?`<p class="writing-opening-status" id="writing-opening-status" role="status">${esc(examOpeningStatus(d))}</p>`:''}<div class="writing-autosave"><span id="writing-save-status" role="status">${esc(writingStatus())}</span></div></div><div class="writing-editor-footer">
  <p>草稿保存在当前浏览器。需要留一份文件时，可以下载草稿。</p>
  <div>
    <button type="button" class="btn" data-action="writing-export-draft">${icon('download',12)} 下载草稿</button>
    <button type="button" class="btn primary" data-action="writing-save-local">${icon('check',12)} 保存到本机</button>
  </div>
</div></form></section><aside class="writing-coach" aria-label="本阶段自检"><section class="rail-card"><div class="rail-title">${icon('leaf',15)} ${esc(s.name)} · 写完后自检</div><p class="writing-coach-intro">先检查功能是否完成，不必把每句话写得很复杂。</p><div class="writing-checks">${s.checks.map(c=>`<label><input type="checkbox" data-writing-check="${c.id}" ${d.checks.includes(c.id)?'checked':''}><span><strong>${esc(c.label)}</strong><small>${esc(c.help)}</small></span></label>`).join('')}</div><p class="writing-self-note">这是你的自检；批改时还会结合原文给出具体依据。</p></section><section class="writing-focus-card"><span class="overline">THIS STAGE</span><h3>这次先练好一件事</h3><p>${esc(s.avoid)}</p><button class="btn small" data-action="writing-copy-draft">${icon('plus',11)} 将当前草稿另存一份</button></section><p class="writing-next-note">${esc(s.ready)}<br>阶段由你决定，不自动升级。</p></aside></div>`;
}
function openWritingGuide(){
  const s=writingStage(writingDraft().stage);
  openModal(`${modalHeader(s.name+' · 本阶段方法')}<p class="modal-description">${esc(s.goal)}</p><ol class="writing-guide-list">${s.focus.map(t=>`<li>${esc(t)}</li>`).join('')}</ol><div class="writing-guide-note">${esc(s.avoid)}</div><p class="writing-guide-source">依据你的 SOP 资料整理：${esc(s.source)}<br>这些是练习支架，不是官方评分量表；按实际题目和字数要求调整。</p><div class="modal-footer"><small>${esc(s.ready)}</small></div>`);
}
function handleWritingAction(action,button){
  if(!action.startsWith('writing-'))return false;
  void(async()=>{
    switch(action){
      case 'writing-new':newWritingDraft();break;
      case 'writing-open-draft':{WRITING.activeId=button.dataset.id;WRITING.tab='compose';const d=writingDraft(),e=writingExamById(d.examId);WRITING.stage=d.stage;if(e)showWritingExam(e);writingLocation();writingPersist();render();break;}
      case 'writing-stage':{const stage=button.dataset.stage;if(WRITING.tab==='compose'){const d=writingDraft();d.stage=stage;d.checks=[];d.synced=false;d.updatedAt=new Date().toISOString();WRITING.stage=stage;writingPersist();render();toast('本篇已切换为'+writingStage(stage).name+'练习。');}else newWritingDraft(stage);break;}
      case 'writing-guide':openWritingGuide();break;
      case 'writing-use-exam':applyWritingExam(button.dataset.id);break;
      case 'writing-custom-prompt':{const d=writingDraft();d.examId=null;d.synced=false;d.updatedAt=new Date().toISOString();writingPersist();render();break;}
      case 'writing-save-local': {
        const saved = writingPersist();
        render();
        toast(saved ? '草稿已保存到当前浏览器。' : '浏览器保存失败，请下载草稿。');
        break;
      }
      case 'writing-export-draft':download('作文草稿-'+shortWritingId(writingDraft().id)+'.json',JSON.stringify({format:'cet6-writing-draft-v1',draft:writingDraft()},null,2));break;
      case 'writing-copy-draft':{const d=writingDraft();newWritingDraft(d.stage,{...d,title:d.title?d.title+' · 副本':'草稿副本'});break;}
    }
  })().catch(e=>{WRITING.error=e.message;toast(e.message);if(state.view==='writing')render();});return true;
}
document.addEventListener('input',e=>{
  if(!e.target.closest('#writing-form'))return;const name=e.target.name;if(!['title','prompt','body','outline','minWords','maxWords','minutes'].includes(name))return;
  const d=writingDraft();d[name]=['minWords','maxWords'].includes(name)?Number(e.target.value):name==='minutes'?(e.target.value===''?null:Number(e.target.value)):e.target.value;d.synced=false;d.updatedAt=new Date().toISOString();writingPersist();updateWritingIndicators();
});
document.addEventListener('change',async e=>{
  if(e.target.dataset.writingCheck){const d=writingDraft(),key=e.target.dataset.writingCheck;d.checks=e.target.checked?[...new Set([...d.checks,key])]:d.checks.filter(c=>c!==key);d.synced=false;d.updatedAt=new Date().toISOString();writingPersist();updateWritingIndicators();}
});
document.addEventListener('submit', e => {
  if (e.target.id === 'writing-form') e.preventDefault();
});
