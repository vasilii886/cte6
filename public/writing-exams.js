'use strict';

let WRITING_EXAMS=null;
async function loadWritingExams(){try{const r=await fetch('./writing-exams.json?v=1.0.0');if(!r.ok)throw Error();const d=await r.json();if(!Array.isArray(d.exams))throw Error();WRITING_EXAMS=d;}catch{WRITING_EXAMS=null;}}
function writingExamById(id){return WRITING_EXAMS?.exams.find(x=>x.id===id)||null;}
function matchedExamOpening(body,e){if(!e?.opening)return true;const normal=t=>String(t||'').trim().replace(/[‘’]/g,"'").replace(/\s+/g,' ');const b=normal(body),o=normal(e.opening);return b===o||b.startsWith(o+' ');}
function writingDraftWords(d){const e=writingExamById(d.examId),all=writingWords(d.body);return e?.excludeOpeningFromCount&&matchedExamOpening(d.body,e)?all-writingWords(e.opening):all;}
function writingCountLabel(d){const e=writingExamById(d.examId);return `${writingDraftWords(d)} 词${e?.excludeOpeningFromCount?'（指定首句不计）':''} / 目标 ${d.minWords}—${d.maxWords}`;}
function examOpeningStatus(d){const e=writingExamById(d.examId);if(!e?.opening)return '';return d.body.trim()?(matchedExamOpening(d.body,e)?'已匹配题面指定首句。':'题目要求用给定句开头，目前正文尚未匹配。'):'本题要求用上方给定句开头。';}
function examSessionLabel(period){const [y,m]=period.split('.');return `${y} 年 ${Number(m)} 月`;}
function examPaperLabel(e){return `${e.period} · 第 ${e.set} 套`;}
function writingExamBrowse(d){
  const all=WRITING_EXAMS?.exams||[],attached=writingExamById(d.examId);
  const year=WRITING.examYear??attached?.year??all[0]?.year??2025;
  const terms=[...new Set(all.filter(e=>e.year===year).map(e=>e.period))];
  const period=terms.includes(WRITING.examPeriod)?WRITING.examPeriod:terms.includes(attached?.period)?attached.period:terms[0];
  const papers=all.filter(e=>e.period===period);
  const paper=papers.find(e=>e.id===WRITING.examPick)||papers.find(e=>e.id===attached?.id)||papers[0]||null;
  return {year,terms,period,papers,paper};
}
function showWritingExam(e){WRITING.examYear=e.year;WRITING.examPeriod=e.period;WRITING.examPick=e.id;}
function renderExamFigure(e){return e?.figure?`<figure class="writing-exam-figure"><a href="${esc(e.figure)}" target="_blank" rel="noopener" aria-label="打开原卷图表"><img src="${esc(e.figure)}" alt="${esc(e.figureAlt||e.title+'原卷图表')}"></a><figcaption>原卷附图 · 点击查看大图</figcaption></figure>`:'';}
function renderExamSource(e){return `<small class="writing-exam-source">来源：${esc(e.sourceFile)}${e.page?` · PDF 第 ${e.page} 页`:''} · Part I Writing</small>`;}
function preserveWritingDraft(d){return Boolean(d.review)||Boolean(d.body.trim()||d.outline.trim()||d.prompt.trim()&&!d.examId);}
function renderExamQuestion(e,{preview=false}={}){
  return `<section class="writing-exam-question ${preview?'exam-preview':''}" aria-label="${preview?'真题预览':'本稿真题题面'}"><div class="writing-exam-question-head"><div><span class="tag">${esc(examPaperLabel(e))}</span><span class="tag outline">${esc(e.kind)}</span></div><span>${e.minutes} 分钟 · ${e.minWords}—${e.maxWords} 词</span></div><h3>${esc(e.title)}</h3><p class="writing-exam-directions" lang="en">${esc(e.prompt)}</p>${e.opening?`<div class="writing-exam-opening"><strong>题面指定首句</strong><p lang="en">${esc(e.opening)}</p></div>`:''}${renderExamFigure(e)}${renderExamSource(e)}</section>`;
}
function renderExamPicker(d){
  if(!WRITING_EXAMS)return `<p class="writing-form-hint">真题库暂未加载，可刷新后选择，也可粘贴你持有的卷面题目。</p>`;
  const {year,terms,period,papers,paper}=writingExamBrowse(d);
  const attached=writingExamById(d.examId),hasWork=preserveWritingDraft(d);
  return `<section class="writing-exam-picker" aria-label="历年作文真题"><div class="writing-exam-picker-head"><div><span class="overline">CET6 · PART I WRITING</span><h3>从历年真题选一篇</h3></div><span class="tag">${WRITING_EXAMS.count} 道完整题面</span></div><div class="writing-exam-selectors"><label for="writing-exam-year">年份<select id="writing-exam-year">${[2026,2025,2024,2023,2022,2021,2020].map(y=>`<option value="${y}" ${year===y?'selected':''}>${y} 年${WRITING_EXAMS.exams.some(e=>e.year===y)?'':' · 暂缺'}</option>`).join('')}</select></label><label for="writing-exam-period">考次<select id="writing-exam-period" ${terms.length?'':'disabled'}>${terms.length?terms.map(p=>`<option value="${p}" ${period===p?'selected':''}>${esc(examSessionLabel(p))}</option>`).join(''):'<option>暂无收录考次</option>'}</select></label><label for="writing-exam-paper">套卷<select id="writing-exam-paper" ${paper?'':'disabled'}>${papers.length?papers.map(e=>`<option value="${e.id}" ${paper?.id===e.id?'selected':''}>第 ${e.set} 套 · ${esc(e.title)}</option>`).join(''):'<option>暂无可选套卷</option>'}</select></label></div>${paper&&paper.id!==attached?.id?`${renderExamQuestion(paper,{preview:true})}<div class="writing-exam-use"><small>${hasWork?'当前有正文或提纲；使用新题会另建草稿。':'选用后，完整题面与考次会随作文一起保存。'}</small><button type="button" class="btn primary small" data-action="writing-use-exam" data-id="${paper.id}">用这道真题 ${icon('arrow',12)}</button></div>`:paper?`<p class="writing-exam-attached">${icon('check',12)} 已选 ${esc(examPaperLabel(paper))}，题面见下方。</p>`:`<p class="writing-form-hint">这份资料暂无 ${year} 年的完整作文题。可以在下方粘贴你持有的题面。</p>`}<details class="writing-exam-coverage"><summary>查看真题覆盖范围</summary><p>${WRITING_EXAMS.periodCount} 个考次 · ${WRITING_EXAMS.count} 道完整题面，含 3 道原卷图表题。暂缺 ${esc(WRITING_EXAMS.missing.join('、'))}；2026.12 尚未开考。</p><p>${esc(WRITING_EXAMS.provenance)}</p></details></section>`;
}
function renderWritingPrompt(d){
  const e=writingExamById(d.examId);
  if(e)return `<div class="writing-active-exam"><div class="writing-active-exam-head"><strong>本稿作文真题</strong><button type="button" class="btn small" data-action="writing-custom-prompt">改用自定义题目</button></div>${renderExamQuestion(e)}</div>`;
  return `<label class="form-field">作文题目与要求<textarea name="prompt" rows="3" maxlength="6000" placeholder="可选用上面的真题，也可粘贴你手上的原卷题面。">${esc(d.prompt)}</textarea></label><p class="writing-form-hint">自定义题目适合补充尚未收录的真题。</p>`;
}
function renderSubmissionExam(s){const e=writingExamById(s.exam_id);return e?renderExamQuestion({...e,prompt:s.prompt}):`<div class="writing-original-prompt"><strong>题目与要求</strong><p>${esc(s.prompt)}</p></div>`;}
function applyWritingExam(id){
  const e=writingExamById(id);if(!e)return;
  let d=writingDraft();
  if(d.examId===id)return;
  if(preserveWritingDraft(d)){
    newWritingDraft(d.stage);d=writingDraft();
  }
  Object.assign(d,{examId:e.id,title:`${examPaperLabel(e)} · ${e.title}`,prompt:e.prompt,minWords:e.minWords,maxWords:e.maxWords,checks:[],synced:false,updatedAt:new Date().toISOString()});
  showWritingExam(e);writingPersist();render();toast('已选真题，原题随本稿保存。');
}
document.addEventListener('change',e=>{
  const id=e.target.id;if(!['writing-exam-year','writing-exam-period','writing-exam-paper'].includes(id))return;
  if(id==='writing-exam-year'){WRITING.examYear=Number(e.target.value);WRITING.examPeriod=null;WRITING.examPick=null;}
  if(id==='writing-exam-period'){WRITING.examPeriod=e.target.value;WRITING.examPick=null;}
  if(id==='writing-exam-paper')WRITING.examPick=e.target.value;
  render();document.getElementById(id)?.focus({preventScroll:true});
});
