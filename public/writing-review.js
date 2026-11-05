'use strict';

const reviewFormat = 'cet6-review-notebook-v1';
const reviewCategories = ['审题', '立意', '立论', '驳论', '举例', '分析', '对比', '选词', '语法', '结尾', '其他'];
const reviewColors = {yellow: '黄色', green: '绿色', blue: '蓝色', pink: '粉色'};
const reviewLimits = {original: 1600, revised: 1600, reason: 1200, basis: 300};
const reviewMaxEntries = 30;
const reviewText = (value, limit) => typeof value === 'string' ? value.slice(0, limit) : '';
const reviewSameText = (a, b) => a.replace(/\r\n?/g, '\n').trim() === b.replace(/\r\n?/g, '\n').trim();

function reviewSource(draft) {
  return {
    examId: reviewText(draft.examId, 100) || null,
    stage: ['foundation', 'advanced', 'final', 'ability'].includes(draft.stage) ? draft.stage : 'foundation',
    title: reviewText(draft.title, 160),
    prompt: reviewText(draft.prompt, 6000),
    body: reviewText(draft.body, 40000),
  };
}

function reviewRanges(value, length) {
  if (!Array.isArray(value)) return [];
  const candidates = value.filter(range => range
    && Number.isInteger(range.start) && Number.isInteger(range.end)
    && range.start >= 0 && range.end > range.start && range.end <= length
  ).slice(0, 12).sort((a, b) => a.start - b.start);
  const ranges = [];
  for (const range of candidates) {
    if (!ranges.length || ranges.at(-1).end <= range.start) {
      ranges.push({start: range.start, end: range.end});
    }
  }
  return ranges;
}

function normalizeReviewEntry(entry = {}) {
  const fields = Object.fromEntries(Object.entries(reviewLimits).map(
    ([key, limit]) => [key, reviewText(entry[key], limit)]
  ));
  return {
    category: reviewCategories.includes(entry.category) ? entry.category : '其他',
    ...fields,
    color: Object.hasOwn(reviewColors, entry.color) ? entry.color : 'yellow',
    marks: {
      original: reviewRanges(entry.marks?.original, fields.original.length),
      revised: reviewRanges(entry.marks?.revised, fields.revised.length),
    },
  };
}

function normalizeWritingReview(value) {
  if (!value || typeof value.source?.body !== 'string' || !value.source.body.trim()
      || !Array.isArray(value.entries)) return null;
  return {
    source: reviewSource(value.source),
    band: reviewText(value.band, 80),
    summary: reviewText(value.summary, 1800),
    entries: value.entries.filter(entry => entry && typeof entry === 'object')
      .slice(0, reviewMaxEntries).map(normalizeReviewEntry),
  };
}

function ensureWritingReview(draft) {
  if (!draft.review?.source?.body) return null;
  return draft.review;
}

function renderReviewMarkText(value, ranges, color) {
  let end = 0;
  let html = '';
  for (const range of ranges) {
    html += esc(value.slice(end, range.start));
    html += `<mark class="review-mark review-mark-${color}">${esc(value.slice(range.start, range.end))}</mark>`;
    end = range.end;
  }
  return html + esc(value.slice(end));
}

function renderReviewSentence(entry, side, index) {
  const label = side === 'original' ? '原句' : '改句';
  const value = entry[side];
  const marks = entry.marks[side];
  return `<div class="review-sentence review-sentence-${side}">
    <label for="review-${index}-${side}">${label}</label>
    <textarea id="review-${index}-${side}" data-review-field="${side}" maxlength="${reviewLimits[side]}"
      rows="3" lang="en" placeholder="${side === 'original' ? '从上方原稿复制要批改的句子' : '写下修改后的句子'}">${esc(value)}</textarea>
    <div class="review-highlight-tools">
      <button class="btn small" data-action="writing-review-mark" data-side="${side}">高亮${label}所选</button>
      <button class="btn small" data-action="writing-review-unmark" data-side="${side}" ${marks.length ? '' : 'hidden'}>清除${label}高亮</button>
    </div>
    <p class="review-preview" data-review-preview="${side}" lang="en" ${marks.length ? '' : 'hidden'}>${renderReviewMarkText(value, marks, entry.color)}</p>
  </div>`;
}

function renderReviewEntry(entry, index) {
  return `<article class="review-entry" data-review-entry="${index}">
    <div class="review-entry-heading">
      <h3>第 ${index + 1} 条修改</h3>
      <label>批改类别<select data-review-field="category">${reviewCategories.map(category =>
        `<option ${category === entry.category ? 'selected' : ''}>${category}</option>`).join('')}</select></label>
      <label>高亮颜色<select data-review-field="color">${Object.entries(reviewColors).map(([key, name]) =>
        `<option value="${key}" ${key === entry.color ? 'selected' : ''}>${name}</option>`).join('')}</select></label>
      <button class="btn small review-remove" data-action="writing-review-remove">删除这一条</button>
    </div>
    <div class="review-sentences">${renderReviewSentence(entry, 'original', index)}${renderReviewSentence(entry, 'revised', index)}</div>
    <div class="review-notes">
      <label>修改理由<textarea data-review-field="reason" rows="3" maxlength="${reviewLimits.reason}" placeholder="这句话要完成什么功能？为什么这样改？">${esc(entry.reason)}</textarea></label>
      <label>Skill 规则和 PDF 依据<input data-review-field="basis" maxlength="${reviewLimits.basis}" value="${esc(entry.basis)}" placeholder="例如：搭配和词义 · 基础款第 11 页公式 5"></label>
    </div>
  </article>`;
}

function renderWritingReview(draft) {
  const review = ensureWritingReview(draft);
  const source = review?.source ?? reviewSource(draft);
  const exam = writingExamById(source.examId);
  const heading = exam ? `${examSessionLabel(exam.period)} · 第 ${exam.set} 套` : '自定义作文';
  return `<section class="review-workspace" aria-label="作文批改">
    <header class="review-overview">
      <div><span class="overline">CET6 · 作文批改</span><h2>${esc(source.title || '未命名练习')}</h2>
        <p>${esc(heading)} · ${esc(writingStage(source.stage)?.name || '基础款')} · 原稿 ${writingDraftWords(source)} 词</p></div>
      <div class="review-actions">
        <button class="btn" data-action="writing-review-import">${icon('upload', 12)} 导入批改</button>
        ${review ? '<button class="btn" data-action="writing-review-export">下载批改记录</button>' : ''}
        <input type="file" id="writing-review-file" accept=".json,application/json" hidden>
      </div>
    </header>
    <details class="review-source"><summary>查看完整题面</summary>${source.prompt ? renderSubmissionExam({exam_id: source.examId, prompt: source.prompt}) : '<p>这份草稿还没有题面。</p>'}</details>
    <details class="review-source" ${!review?.entries.length ? 'open' : ''}>
      <summary>${review ? '查看原稿快照' : '查看当前原稿'}</summary>
      <p class="review-original" lang="en">${esc(source.body || '还没有写正文。可返回「写作草稿」开始写。')}</p>
    </details>
    ${review ? `
      <div class="review-assessment">
        <label>练习档位<input data-review-meta="band" maxlength="80" value="${esc(review.band)}" placeholder="例如：9 档上沿，冲 11 档"></label>
        <label>立意与总评<textarea data-review-meta="summary" rows="3" maxlength="1800" placeholder="记下中心观点、整体表现和下次优先练习的内容">${esc(review.summary)}</textarea></label>
      </div>
      <div class="review-entries">${review.entries.map(renderReviewEntry).join('')}</div>
      <div class="review-actions review-footer">
        <button class="btn primary" data-action="writing-review-add" ${review.entries.length >= reviewMaxEntries ? 'disabled' : ''}>${icon('plus',12)} 添加逐句修改</button>
        ${renderWritingCloudSave()}
        <span id="writing-save-status" role="status">${esc(writingStatus())}</span>
      </div>` : `
      <div class="review-empty">
        <p>开始批改时会保留当前原稿。每一条可以写原句、改句、理由和依据，并给词句加高亮。</p>
        <button class="btn primary" data-action="writing-review-start" ${source.body.trim() ? '' : 'disabled'}>开始批改</button>
      </div>`}
  </section>`;
}

function persistReviewEdit(draft) {
  draft.updatedAt = new Date().toISOString();
  writingPersist();
  updateWritingIndicators();
}

function showReviewMarks(card, entry, side) {
  const preview = card.querySelector(`[data-review-preview="${side}"]`);
  const clear = card.querySelector(`[data-action="writing-review-unmark"][data-side="${side}"]`);
  const marks = entry.marks[side];
  preview.innerHTML = renderReviewMarkText(entry[side], marks, entry.color);
  preview.hidden = clear.hidden = !marks.length;
}

function updateReviewInput(target) {
  if (!target.matches('[data-review-meta], [data-review-field]')) return;
  const draft = writingDraft();
  const review = ensureWritingReview(draft);
  if (!review) return;
  const meta = target.dataset.reviewMeta;
  if (meta) {
    review[meta] = target.value;
  } else {
    const field = target.dataset.reviewField;
    const card = target.closest('[data-review-entry]');
    const entry = review.entries[Number(card.dataset.reviewEntry)];
    if (!entry) return;
    if (field === 'original' || field === 'revised') {
      const oldText = entry[field];
      entry.marks[field] = entry.marks[field].filter(({start, end}) =>
        target.value.slice(start, end) === oldText.slice(start, end)
      );
    }
    entry[field] = target.value;
    if (field === 'original' || field === 'revised') showReviewMarks(card, entry, field);
    if (field === 'color') for (const side of ['original', 'revised']) showReviewMarks(card, entry, side);
  }
  persistReviewEdit(draft);
}

function editReviewMark(action, button, review) {
  const card = button.closest('[data-review-entry]');
  const entry = review.entries[Number(card.dataset.reviewEntry)];
  const side = button.dataset.side;
  if (action === 'writing-review-unmark') {
    entry.marks[side] = [];
  } else {
    const area = card.querySelector(`[data-review-field="${side}"]`);
    const start = area.selectionStart, end = area.selectionEnd;
    if (start === end) {
      toast('先在对应文本框里选中要高亮的词句。');
      area.focus();
      return false;
    }
    const remaining = entry.marks[side].filter(mark => mark.end <= start || mark.start >= end);
    if (remaining.length >= 12) {
      toast('这一栏最多标记 12 处，可清除后重新标记。');
      return false;
    }
    entry.marks[side] = reviewRanges([...remaining, {start, end}], area.value.length);
  }
  showReviewMarks(card, entry, side);
  return true;
}

function handleWritingReviewAction(action, button) {
  if (!action.startsWith('writing-review-')) return false;
  const draft = writingDraft();
  const review = ensureWritingReview(draft);
  switch (action) {
    case 'writing-review-start':
      if (!review && draft.body.trim()) {
        draft.review = {source: reviewSource(draft), band: '', summary: '', entries: [normalizeReviewEntry()]};
        persistReviewEdit(draft);
        render();
      }
      break;
    case 'writing-review-add':
      if (review && review.entries.length < reviewMaxEntries) {
        review.entries.push(normalizeReviewEntry());
        persistReviewEdit(draft);
        render();
        document.getElementById(`review-${review.entries.length - 1}-original`)?.focus();
      }
      break;
    case 'writing-review-remove':
      if (review) {
        const index = Number(button.closest('[data-review-entry]').dataset.reviewEntry);
        const removed = review.entries.splice(index, 1)[0];
        persistReviewEdit(draft);
        render();
        openModal(`${modalHeader('已移除这条修改')}<p>如果点错了，可以撤销。</p>
          <div class="modal-footer"><button id="review-undo" class="btn primary">撤销删除</button></div>`);
        document.getElementById('review-undo').onclick = () => {
          review.entries.splice(index, 0, removed);
          persistReviewEdit(draft);
          closeModal();
          render();
        };
      }
      break;
    case 'writing-review-mark':
    case 'writing-review-unmark':
      if (review && editReviewMark(action, button, review)) persistReviewEdit(draft);
      break;
    case 'writing-review-export':
      if (review) download(`作文批改-${shortWritingId(draft.id)}.json`,
        JSON.stringify({format: reviewFormat, review}, null, 2));
      break;
    case 'writing-review-import':
      document.getElementById('writing-review-file')?.click();
      break;
  }
  return true;
}

function importWritingReview(value) {
  const incoming = value?.format === reviewFormat && normalizeWritingReview(value.review);
  if (!incoming) throw new Error('文件不是可识别的拾词批改记录。');
  const sameSource = draft => {
    const source = draft.review?.source ?? reviewSource(draft);
    return source.examId === incoming.source.examId
      && reviewSameText(source.prompt, incoming.source.prompt)
      && reviewSameText(source.body, incoming.source.body);
  };
  let draft = writingDraft();
  if (!sameSource(draft)) {
    draft = WRITING.drafts.find(sameSource);
    if (!draft) {
      const exam = writingExamById(incoming.source.examId);
      newWritingDraft(incoming.source.stage, {
        ...incoming.source, minWords: exam?.minWords, maxWords: exam?.maxWords,
      });
      draft = writingDraft();
    }
  }
  const existing = ensureWritingReview(draft);
  if (!existing) {
    draft.review = incoming;
  } else {
    const signature = entry => JSON.stringify([entry.category, entry.original, entry.revised, entry.reason, entry.basis]);
    const known = new Set(existing.entries.map(signature));
    const additions = incoming.entries.filter(entry => {
      const key = signature(entry);
      if (known.has(key)) return false;
      known.add(key);
      return true;
    });
    if (existing.entries.length + additions.length > reviewMaxEntries) throw new Error('这篇最多可保留 30 条修改。');
    existing.entries.push(...additions);
    if (!existing.band) existing.band = incoming.band;
    if (!existing.summary) existing.summary = incoming.summary;
  }
  WRITING.activeId = draft.id;
  WRITING.stage = draft.stage;
  WRITING.tab = 'review';
  writingLocation();
  persistReviewEdit(draft);
  render();
  toast('批改已导入。');
}

document.addEventListener('input', event => updateReviewInput(event.target));
document.addEventListener('change', async event => {
  if (event.target.id !== 'writing-review-file') return;
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 400000) throw new Error('请选择小于 400 KB 的批改文件。');
    importWritingReview(JSON.parse(await file.text()));
  } catch (error) {
    toast(error instanceof SyntaxError ? '批改文件不是有效的 JSON。' : error.message);
  } finally {
    event.target.value = '';
  }
});
