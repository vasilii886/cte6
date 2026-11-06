'use strict';

const WRITING_STORAGE='shici.writing.v1';
let WRITING_GUIDE=null;
let WRITING={drafts:[],activeId:null,stage:'foundation',tab:'compose'};
try{const c=JSON.parse(localStorage.getItem(WRITING_STORAGE)||'{}');if(Array.isArray(c.drafts))WRITING.drafts=c.drafts.filter(d=>d&&typeof d.id==='string'&&typeof d.body==='string'&&['foundation','advanced','final','ability'].includes(d.stage));for(const d of WRITING.drafts){if(d.review)d.review=normalizeWritingReview(d.review);}WRITING.activeId=c.activeId;WRITING.stage=c.stage||'foundation';}catch{}
const writingWords=text=>(String(text||'').match(/[A-Za-z]+(?:['’\-][A-Za-z]+)*|\d+(?:[.,]\d+)*/g)||[]).length;
const shortWritingId=id=>String(id).slice(0,8);
const writingDate=value=>value?new Date(value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
function writingStage(id){return WRITING_GUIDE?.stages.find(s=>s.id===id)||WRITING_GUIDE?.stages[0];}
function writingLocation(submissionId=null){const u=new URL(location.href);u.searchParams.set('view','writing');if(submissionId)u.searchParams.set('submission',submissionId);else u.searchParams.delete('submission');if(WRITING.tab==='review')u.searchParams.set('tab','review');else u.searchParams.delete('tab');history.replaceState(null,'',u.pathname+u.search+u.hash);}
async function loadWritingGuide(){try{const r=await fetch('./writing-sop.json?v=3.1.0');if(!r.ok)throw Error();WRITING_GUIDE=await r.json();}catch{WRITING_GUIDE=null;}}
function writingPersist() {
  const drafts = WRITING.drafts.filter(draft => !draft.cloudOnly);
  const active = drafts.find(draft => draft.id === WRITING.activeId) ?? drafts[0];
  try {
    localStorage.setItem(WRITING_STORAGE, JSON.stringify({
      drafts, activeId: active?.id ?? null, stage: active?.stage ?? 'foundation',
    }));
    WRITING.localFailed = false;
    return true;
  } catch {
    WRITING.localFailed = true;
    return false;
  }
}
function writingDraft(){let d=WRITING.drafts.find(d=>d.id===WRITING.activeId);if(!d){d={id:crypto.randomUUID(),stage:writingStage(WRITING.stage)?.id||'foundation',title:'',prompt:'',body:'',outline:'',minWords:150,maxWords:200,minutes:null,checks:[],version:0,synced:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),parentSubmissionId:null};WRITING.drafts.unshift(d);WRITING.activeId=d.id;writingPersist();}d.checks=Array.isArray(d.checks)?d.checks:[];return d;}
function newWritingDraft(stage=WRITING.stage,base=null){
  const d={id:crypto.randomUUID(),stage:writingStage(stage)?.id||'foundation',title:base?.title||'',prompt:base?.prompt||'',body:base?.body||'',outline:base?.outline||'',minWords:base?.minWords??150,maxWords:base?.maxWords??200,minutes:null,checks:[],version:0,synced:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),parentSubmissionId:base?.parentSubmissionId||null,examId:base?.examId||null};
  d.training = normalizeWritingTraining(base?.training, d.parentSubmissionId);
  WRITING.drafts.unshift(d);WRITING.activeId=d.id;WRITING.stage=d.stage;WRITING.tab='compose';const e=writingExamById(d.examId);if(e)showWritingExam(e);writingLocation();writingPersist();render();window.scrollTo({top:0});
}
function writingStatus(){
  const draft = writingDraft();
  if (draft.cloudOnly) {
    return draft.cloudSnapshot === JSON.stringify(cloudDraftDocument(draft))
      ? '这一稿来自云端。'
      : '有未上传的修改。完成后请点击「保存到云端」。';
  }
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
  return `<aside class="sidebar writing-sidebar" aria-label="作文练习阶段"><div class="side-title"><strong>作文练习册</strong><span>STEP BY STEP</span></div><div class="writing-stage-list">${WRITING_GUIDE.stages.map(s=>`<button class="writing-stage ${s.id===stage?'active':''}" data-action="writing-stage" data-stage="${s.id}" aria-label="练习阶段 ${s.name}"><span>${s.number}</span><div><strong>${esc(s.name)}</strong><small>${esc(s.tag)}</small></div>${s.id===stage?icon('check',12):icon('chevron',11)}</button>`).join('')}</div><p class="writing-side-copy">按四阶段路线练习。选阶段用于设定本稿目标，晋级以教练验收为准。</p><div class="side-divider"></div><button class="btn primary full-width" data-action="writing-new">${icon('plus',13)} 新建练习</button><div class="writing-draft-heading"><span>我的草稿</span><small>${WRITING.drafts.length}</small></div><div class="writing-drafts">${WRITING.drafts.slice(0,12).map(x=>`<button class="writing-draft ${x.id===d.id?'active':''}" data-action="writing-open-draft" data-id="${esc(x.id)}"><strong>${esc(x.title||'未命名练习')}</strong><small>${esc(writingStage(x.stage)?.name||'基础款')} · ${writingDraftWords(x)} 词 · ${x.cloudOnly?'云端':'本机'}</small></button>`).join('')}</div><button class="demo-btn" data-action="writing-guide">${icon('book',14)}<span>本阶段练习方法</span>${icon('chevron',11)}</button><div class="side-note">本机草稿自动保存在当前浏览器。云端草稿需手动保存。</div></aside>`;
}
const foundationFormulas = [
  {
    number: 3, page: 10, purpose: '开头 · 驳论与表态',
    pattern: 'A pervasive misconception is that [错误观点]. In reality, what truly matters is that [我的观点].',
    check: '题目有值得回应的看法时用。两个 that 后各接一个完整陈述句。',
    example: '回应「只要用 AI 就会削弱创造力」，提出「用 AI 探索想法，创作决定由自己做」。',
  },
  {
    number: 5, page: 11, purpose: '主体 · 立论',
    pattern: 'The primary argument in favor of [做法] lies in its capacity to [具体作用].',
    check: 'in favor of 后接名词或动名词，capacity to 后接动词原形。',
    example: '用 using AI as a creative partner 指出做法，用 offer new ways to organize ideas 写清好处。',
  },
  {
    number: 8, page: 12, purpose: '主体 · 举例',
    pattern: 'Consider, for instance, the case of [具体人物或情境].',
    check: 'case of 后接名词短语。接着写这个人做了什么、产生了什么结果。',
    example: '用 a student writing an essay 引出同一个学生的两种做法：照搬 AI 作文，或先写提纲再请 AI 提建议。',
  },
  {
    number: 9, page: 12, purpose: '主体 · 例后分析',
    pattern: 'This example illustrates a crucial point: [例子怎样支持分论点].',
    check: '冒号后用完整句写清「做了什么 → 为什么有用」，扣回公式 5 的理由。',
    example: '比较 AI 的建议和自己的提纲，让学生练习判断哪些想法可用，以及怎样发展它们。',
  },
  {
    number: 13, page: 13, purpose: '结尾 · 总结',
    pattern: 'In essence, [主题] is not merely [表层用途] but [更重要的用途].',
    check: 'not merely 和 but 后用平行的结构，结论回扣正文已经论证的观点。',
    example: '用 a way to finish a task faster 和 a tool for exploring ideas 对照，最后重申由人做决定。',
  },
];

function renderFoundationFormulas(practice) {
  if (practice.stage !== 'foundation') return '';
  const showExamples = practice.examId === 'cet6-2025-06-1';
  return `<details class="foundation-formulas">
    <summary><strong>基础款固定公式</strong> <span>开头 3 → 主体 5 → 8 → 9 → 结尾 13</span></summary>
    <div class="foundation-formulas-content">
      <p>先定句子功能，再选公式，最后检查填进去的句子。题目有指定首句时，先按题面要求写；适合直接表态的题可以跳过公式 3 的驳论句。</p>
      ${showExamples ? '<p><strong>2025 年 6 月第 1 套 · AI 与人类创造力定稿用法</strong></p>' : ''}
      <ul>
        ${foundationFormulas.map(formula => `<li>
          <div class="foundation-formula-label">
            <strong>公式 ${formula.number} · ${formula.purpose}</strong>
            <small>《基础款》第 ${formula.page} 页</small>
          </div>
          <div>
            <p class="foundation-formula-pattern" lang="en">${formula.pattern}</p>
            <p>${formula.check}</p>
            ${showExamples ? `<p class="foundation-formula-example">${formula.example}</p>` : ''}
          </div>
        </li>`).join('')}
      </ul>
      <p><strong>写完自检</strong>　公式和句子功能匹配 · 语法和搭配正确 · 例子与分析能支持观点</p>
    </div>
  </details>`;
}

function renderWriting(){
  if(!WRITING_GUIDE)return '<div class="empty-view"><h2>暂未能加载作文方法</h2><button class="btn" data-action="reload">刷新重试</button></div>';
  const draft=writingDraft(),stage=writingStage(draft.stage);
  const practice = WRITING.tab === 'review' ? draft.review?.source ?? draft : draft;
  return `<div class="writing-page">${crumb('作文练习')}
    <div class="writing-heading"><div><div class="page-eyebrow"><i></i>YOUR WRITING NOTEBOOK</div>
    <h1>${esc(stage.headline)}</h1><p class="page-sub">选一道真题，练好这一稿。</p></div>${renderWritingCloudControls()}</div>
    <div class="review-tabs" role="group" aria-label="作文工作区">
      <button class="btn ${WRITING.tab==='compose'?'primary':''}" aria-pressed="${WRITING.tab==='compose'}" data-action="writing-switch-compose">写作草稿</button>
      <button class="btn ${WRITING.tab==='review'?'primary':''}" aria-pressed="${WRITING.tab==='review'}" data-action="writing-switch-review">作文批改</button>
    </div>
    ${renderWritingTrainingRoute(practice.stage)}
    ${WRITING.tab === 'review' || draft.training?.kind !== 'assessment' ? renderFoundationFormulas(practice) : ''}
    ${WRITING.tab==='review'?renderWritingReview(draft):renderWritingComposer(draft,stage)}
    <footer class="footnote"><span>词库和阅读进度保存在当前浏览器。作文可以保存到本机或云端。</span></footer>
  </div>`;
}
function renderWritingComposer(d,s){
  return `<div class="writing-stage-banner"><div class="writing-badge">${s.number}</div><div><span>当前练习 · ${esc(s.name)}</span><strong>${esc(s.goal)}</strong></div><button class="btn small" data-action="writing-guide">本阶段方法 ${icon('arrow',12)}</button></div><div class="writing-layout"><section class="writing-editor" aria-label="作文输入区"><form id="writing-form"><div class="writing-editor-head"><div><span class="overline">DRAFT / ${esc(shortWritingId(d.id))}</span><h2>${d.parentSubmissionId?'继续写第二稿':'留出一页，写下自己的观点。'}</h2></div><span class="writing-sync-dot ${d.synced?'synced':''}" aria-label="${d.synced?'已同步':'有本机草稿'}"></span></div><div class="writing-fields">${renderExamPicker(d)}<label class="form-field">练习名称<input name="title" maxlength="160" placeholder="例如：自律练习 · 第一稿" value="${esc(d.title)}"></label>${renderWritingPrompt(d)}${renderWritingTrainingFields(d)}<div class="writing-range-row"><label>目标最少词数<input name="minWords" type="number" min="0" max="5000" ${writingExamById(d.examId)?.full?'readonly':''} value="${esc(d.minWords)}"></label><span>—</span><label>目标最多词数<input name="maxWords" type="number" min="1" max="5000" ${writingExamById(d.examId)?.full?'readonly':''} value="${esc(d.maxWords)}"></label><label class="writing-minutes">本次用时（分钟，可选）<input name="minutes" type="number" min="0" max="1440" step="0.5" placeholder="不限时可留空" value="${d.minutes??''}"></label></div><details class="writing-outline" ${d.outline?'open':''}><summary>先列一个小提纲 <span>观点 → 理由 → 例子 → 解释</span></summary><label class="sr-only" for="writing-outline">我的写作提纲</label><textarea name="outline" id="writing-outline" rows="4" maxlength="6000" placeholder="我想说明什么？\n用什么具体例子？\n例子为什么能支持我的观点？">${esc(d.outline)}</textarea></details><div class="writing-body-label"><label for="writing-body">英文作文</label><span id="writing-word-count">${esc(writingCountLabel(d))}</span></div><textarea id="writing-body" name="body" class="writing-body" lang="en" spellcheck="true" maxlength="40000" placeholder="从第一句话开始。用空行分段，先写清楚，再慢慢打磨。">${esc(d.body)}</textarea>${writingExamById(d.examId)?.opening?`<p class="writing-opening-status" id="writing-opening-status" role="status">${esc(examOpeningStatus(d))}</p>`:''}<div class="writing-autosave"><span id="writing-save-status" role="status">${esc(writingStatus())}</span></div></div><div class="writing-editor-footer">
  <p>${d.cloudOnly ? '云端草稿修改后，请点击「保存到云端」。' : '草稿自动保存在当前浏览器。'}</p>
  <div>
    <button type="button" class="btn" data-action="writing-export-draft">${icon('download',12)} 下载草稿送批</button>
    ${d.cloudOnly ? '' : `<button type="button" class="btn primary" data-action="writing-save-local">${icon('check',12)} 保存到本机</button>`}
    <button type="button" class="btn" data-action="writing-switch-review">去批改</button>
    ${renderWritingCloudSave()}
  </div>
</div></form></section><aside class="writing-coach" aria-label="本阶段自检"><section class="rail-card"><div class="rail-title">${icon('leaf',15)} ${esc(s.name)} · 写完后自检</div><p class="writing-coach-intro">先检查功能是否完成，不必把每句话写得很复杂。</p><div class="writing-checks">${s.checks.map(c=>`<label><input type="checkbox" data-writing-check="${c.id}" ${d.checks.includes(c.id)?'checked':''}><span><strong>${esc(c.label)}</strong><small>${esc(c.help)}</small></span></label>`).join('')}</div><p class="writing-self-note">这是你的自检；批改时还会结合原文给出具体依据。</p></section><section class="writing-focus-card"><span class="overline">THIS STAGE</span><h3>这次先练好一件事</h3><p>${esc(s.avoid)}</p><button class="btn small" data-action="writing-copy-draft">${icon('plus',11)} 将当前草稿另存一份</button></section><p class="writing-next-note">${esc(s.ready)}<br>两篇独立新题连续达标后，看教练的晋级结论。</p></aside></div>`;
}
function openWritingGuide(){
  const s=writingStage(writingDraft().stage);
  openModal(`${modalHeader(s.name+' · 本阶段方法')}<p class="modal-description">${esc(s.goal)}</p><ol class="writing-guide-list">${s.focus.map(t=>`<li>${esc(t)}</li>`).join('')}</ol><div class="writing-guide-note">${esc(s.avoid)}</div><p class="writing-guide-source">依据你的 SOP 资料整理：${esc(s.source)}<br>这些是练习支架，不是官方评分量表；按实际题目和字数要求调整。</p><div class="modal-footer"><small>${esc(s.ready)}</small></div>`);
}
function handleWritingAction(action,button){
  if(handleWritingCloudAction(action,button)||handleWritingReviewAction(action,button))return true;
  if(!action.startsWith('writing-'))return false;
  void(async()=>{
    switch(action){
      case 'writing-switch-compose':
      case 'writing-switch-review':
        WRITING.tab=action==='writing-switch-review'?'review':'compose';
        writingLocation();
        render();
        window.scrollTo({top:0});
        break;
      case 'writing-new':newWritingDraft();break;
      case 'writing-diagnostic':
        newWritingDraft('foundation', {
          title: '基础诊断 F-D01 · 小组项目',
          prompt: 'In a college group project, students can choose tasks they already know how to do or take on unfamiliar tasks. Which choice helps students learn more, and under what conditions? Explain your view.',
          minWords: 70, maxWords: 100,
          outline: '对象：\n任务：\n限定：\n立场：',
          training: {kind: 'diagnostic', notes: '原创片段练习，可不计时。先用中文审题，再写一个英文主体段。'},
        });
        break;
      case 'writing-open-draft':{WRITING.activeId=button.dataset.id;const d=writingDraft(),e=writingExamById(d.examId);WRITING.stage=d.stage;if(e)showWritingExam(e);writingLocation();writingPersist();render();break;}
      case 'writing-stage':{const stage=button.dataset.stage;if(WRITING.tab==='compose'){const d=writingDraft();if(d.stage!==stage&&d.training?.kind==='assessment')d.training=normalizeWritingTraining({...d.training,kind:'practice'},d.parentSubmissionId);d.stage=stage;d.checks=[];d.synced=false;d.updatedAt=new Date().toISOString();WRITING.stage=stage;writingPersist();render();toast('本篇已切换为'+writingStage(stage).name+'练习。');}else {toast('请先回到「写作草稿」切换阶段。');}break;}
      case 'writing-guide':openWritingGuide();break;
      case 'writing-use-exam':applyWritingExam(button.dataset.id);break;
      case 'writing-custom-prompt':{const d=writingDraft();d.examId=null;if(d.training?.independent)d.training.independent=false;d.synced=false;d.updatedAt=new Date().toISOString();writingPersist();render();break;}
      case 'writing-save-local': {
        const saved = writingPersist();
        render();
        toast(saved ? '草稿已保存到当前浏览器。' : '浏览器保存失败，请下载草稿。');
        break;
      }
      case 'writing-export-draft': {
        const draft = writingDraft();
        download('作文草稿-'+shortWritingId(writingPracticeId(draft))+'.json', JSON.stringify(writingDraftExport(draft), null, 2));
        break;
      }
      case 'writing-copy-draft':{const d=writingDraft();newWritingDraft(d.stage,{...d,title:d.title?d.title+' · 副本':'草稿副本',training:null,parentSubmissionId:writingPracticeId(d)});break;}
    }
  })().catch(e=>{WRITING.error=e.message;toast(e.message);if(state.view==='writing')render();});return true;
}
document.addEventListener('input',e=>{
  if (!e.target.closest('#writing-form')) return;
  const target = e.target, name = target.name;
  const draft = writingDraft();
  if (!updateWritingTraining(target, draft)) {
    if (!['title', 'prompt', 'body', 'outline', 'minWords', 'maxWords', 'minutes'].includes(name)) return;
    if (name === 'prompt' && draft.prompt !== target.value && draft.training?.independent) {
      draft.training.independent = false;
      const declaration = document.querySelector('[name="training-independent"]');
      if (declaration) declaration.checked = false;
    }
    draft[name] = ['minWords', 'maxWords'].includes(name) ? Number(target.value)
      : name === 'minutes' ? (target.value === '' ? null : Number(target.value)) : target.value;
  }
  draft.synced = false;
  draft.updatedAt = new Date().toISOString();
  writingPersist();
  updateWritingIndicators();
});
document.addEventListener('change', e=>{
  if (e.target.name === 'training-kind' && e.target.closest('#writing-form')) {
    render();
    const details = document.querySelector('.writing-training-fields');
    details.open = true;
    details.querySelector('[name="training-kind"]').focus({preventScroll: true});
    return;
  }
  if(e.target.dataset.writingCheck){const d=writingDraft(),key=e.target.dataset.writingCheck;d.checks=e.target.checked?[...new Set([...d.checks,key])]:d.checks.filter(c=>c!==key);d.synced=false;d.updatedAt=new Date().toISOString();writingPersist();updateWritingIndicators();}
});
document.addEventListener('submit', e => {
  if (e.target.id === 'writing-form') e.preventDefault();
});
