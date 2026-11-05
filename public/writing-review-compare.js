'use strict';

const reviewLayouts = {split: '左右对照', stack: '上下对照', original: '仅看原文', revised: '仅看改后'};
const reviewView = {layout: window.matchMedia?.('(max-width: 650px)').matches ? 'stack' : 'split',
  draftId: null, active: null, editing: false};

function reviewLocate(body, entry) {
  const quote = entry.original.trim();
  if (!quote) return null;
  const {start, end} = entry.anchor ?? {};
  if (Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= body.length
      && body.slice(start, end) === quote) return {start, end};
  const first = body.indexOf(quote);
  if (first >= 0) {
    return body.indexOf(quote, first + 1) < 0 ? {start: first, end: first + quote.length} : null;
  }
  const parts = quote.split(/\s+/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const matches = body.matchAll(new RegExp(parts.join('\\s+'), 'g'));
  const match = matches.next().value;
  return match && matches.next().done ? {start: match.index, end: match.index + match[0].length} : null;
}

function reviewDocument(review) {
  const body = review.source.body;
  const candidates = [];
  const status = review.entries.map((entry, index) => {
    if (!entry.original.trim()) return '待填原句';
    const range = reviewLocate(body, entry);
    if (!range) return '原文位置未确认';
    if (!entry.remove && !entry.revised.trim()) return '待填改句';
    candidates.push({...range, index, entry});
    return '已对照';
  });
  candidates.sort((a, b) => a.start - b.start || a.index - b.index);
  const changes = [];
  let end = 0;
  for (const item of candidates) {
    if (item.start < end) {
      status[item.index] = '与其他批改重叠';
      continue;
    }
    changes.push(item);
    end = item.end;
  }
  return {body, changes, status};
}

function reviewCharacterDifference(before, after) {
  let start = 0, tail = 0;
  while (start < Math.min(before.length, after.length) && before[start] === after[start]) start++;
  while (tail < Math.min(before.length, after.length) - start
      && before[before.length - tail - 1] === after[after.length - tail - 1]) tail++;
  return [before, after].map(text => start < text.length - tail ? [{start, end: text.length - tail}] : []);
}

function reviewWordDifference(before, after) {
  const tokens = text => [...text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*|[^\s]/gu)];
  const a = tokens(before), b = tokens(after);
  const width = b.length + 1;
  if (a.length * b.length > 160000) return reviewCharacterDifference(before, after);
  const lcs = new Uint16Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i * width + j] = a[i][0] === b[j][0]
        ? lcs[(i + 1) * width + j + 1] + 1
        : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
    }
  }
  const marks = [[], []];
  const add = (side, token) => marks[side].push({start: token.index, end: token.index + token[0].length});
  for (let i = 0, j = 0; i < a.length || j < b.length;) {
    if (i < a.length && j < b.length && a[i][0] === b[j][0]) { i++; j++; }
    else if (i < a.length && (j === b.length || lcs[(i + 1) * width + j] >= lcs[i * width + j + 1])) add(0, a[i++]);
    else add(1, b[j++]);
  }
  return marks[0].length || marks[1].length ? marks : reviewCharacterDifference(before, after);
}

function reviewMergeMarks(text, ranges) {
  const output = [];
  for (const range of ranges.sort((a, b) => a.start - b.start)) {
    const last = output.at(-1);
    if (last && (last.end >= range.start || !text.slice(last.end, range.start).trim())) {
      last.end = Math.max(last.end, range.end);
    } else {
      output.push({...range});
    }
  }
  return output;
}

function renderReviewCompareText(doc) {
  const html = ['', ''];
  let end = 0;
  for (const {start, end: next, index, entry} of doc.changes) {
    const unchanged = doc.body.slice(end, start);
    const before = doc.body.slice(start, next);
    const after = entry.remove ? '' : entry.revised.trim();
    const automatic = reviewWordDifference(before, after);
    for (const [side, value] of [before, after].entries()) {
      html[side] += esc(unchanged);
      if (!value) continue;
      const original = side === 0 ? entry.original : entry.revised;
      const manual = value === original ? entry.marks[side === 0 ? 'original' : 'revised'] : [];
      const marks = reviewMergeMarks(value, [...automatic[side], ...manual]);
      html[side] += `<span class="review-diff ${marks.length ? '' : 'review-diff-note'}" role="button" tabindex="0"
        aria-label="查看第 ${index + 1} 条修改理由" aria-pressed="${reviewView.active === index}"
        data-action="writing-review-select" data-review-index="${index}">${renderReviewMarkText(value, marks, entry.color)}</span>`;
    }
    end = next;
  }
  const remainder = doc.body.slice(end);
  return {original: html[0] + esc(remainder), revised: html[1] + esc(remainder)};
}

function renderReviewInspector(review, doc) {
  const index = reviewView.active;
  const entry = index === null ? null : review.entries[index];
  if (entry && reviewView.editing) {
    return `<div class="review-inspector-head"><h3>编辑第 ${index + 1} 条</h3>
      <button class="btn primary small" data-action="writing-review-finish">完成编辑</button></div>
      ${renderReviewEntry(entry, index)}`;
  }
  return `<div class="review-inspector-head"><h3>修改说明</h3>
    ${entry ? '<button class="btn small" data-action="writing-review-edit">编辑本条</button>' : ''}</div>
    ${entry ? `
      <p class="review-entry-label"><span class="tag">第 ${index + 1} 条 · ${esc(entry.category)}</span> ${esc(doc.status[index])}</p>
      <div class="review-reason">${esc(entry.reason || '这条还没有填写理由。')}</div>
      ${entry.basis ? `<p class="review-basis"><strong>Skill / PDF 依据</strong><br>${esc(entry.basis)}</p>` : ''}
    ` : '<p class="review-muted">点击正文中有颜色的改动，这里会显示原因和依据。</p>'}
    ${review.entries.length ? `<div class="review-index" aria-label="所有批改条目">${review.entries.map((item, i) =>
      `<button class="btn small" aria-pressed="${index === i}" data-action="writing-review-select" data-review-index="${i}"
        aria-label="第 ${i + 1} 条 · ${esc(item.category)} · ${esc(doc.status[i])}">${i + 1} · ${esc(item.category)}</button>`
    ).join('')}</div>` : ''}`;
}

function renderReviewComparison(review) {
  const doc = reviewDocument(review);
  const content = renderReviewCompareText(doc);
  const pending = doc.status.filter(status => status !== '已对照').length;
  return `<div class="review-compare-toolbar">
    <div class="review-layout-options" role="group" aria-label="全文对照排版">${Object.entries(reviewLayouts).map(([key, title]) =>
      `<button class="btn small ${reviewView.layout === key ? 'primary' : ''}" data-action="writing-review-layout" data-layout="${key}"
        aria-pressed="${reviewView.layout === key}">${title}</button>`).join('')}</div>
    <span class="review-muted">${doc.changes.length} 处已对照${pending ? ` · ${pending} 条待补全或定位` : ''}</span>
    <button class="btn small" data-action="writing-review-add-selection" ${review.entries.length >= reviewMaxEntries ? 'disabled' : ''}
      title="可以先在原稿中选一句，再点这里">添加修改</button>
  </div>
  <div class="review-compare">
    <div class="review-paper-group review-layout-${reviewView.layout}">
      <section class="review-paper review-paper-original" aria-label="原稿全文"><h3>原稿全文</h3>
        <div id="review-paper-original" class="review-paper-text" lang="en">${content.original}</div></section>
      <section class="review-paper review-paper-revised" aria-label="改后全文"><h3>改后全文</h3>
        <div class="review-paper-text" lang="en">${content.revised || '<span class="review-muted">正文已全部删去。</span>'}</div></section>
    </div>
    <aside id="review-inspector" class="review-inspector" aria-label="所选改动的修改说明" tabindex="-1">${renderReviewInspector(review, doc)}</aside>
  </div>`;
}

function selectReviewEntry(review, index, editing = false) {
  if (!Number.isInteger(index) || !review.entries[index]) return;
  const refreshPapers = reviewView.editing && !editing;
  reviewView.active = index;
  reviewView.editing = editing;
  if (refreshPapers) render();
  const inspector = document.getElementById('review-inspector');
  inspector.innerHTML = renderReviewInspector(review, reviewDocument(review));
  document.querySelectorAll('.review-diff').forEach(node =>
    node.setAttribute('aria-pressed', String(Number(node.dataset.reviewIndex) === index)));
  if (editing || window.matchMedia?.('(max-width: 1100px)').matches) {
    inspector.focus({preventScroll: true});
    inspector.scrollIntoView?.({block: 'nearest'});
  }
}

function selectedReviewQuote(body) {
  const paper = document.getElementById('review-paper-original');
  const selection = window.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!paper?.contains(range.commonAncestorContainer)) return null;
  const prefix = document.createRange();
  prefix.selectNodeContents(paper);
  prefix.setEnd(range.startContainer, range.startOffset);
  const leading = range.toString().match(/^\s*/u)[0].length;
  const text = range.toString().trim();
  const start = prefix.toString().length + leading;
  const end = start + text.length;
  return text && body.slice(start, end) === text ? {text, start, end} : null;
}

document.addEventListener('pointerdown', event => {
  if (event.target.closest('[data-action="writing-review-add-selection"]')) event.preventDefault();
});

document.addEventListener('keydown', event => {
  const diff = event.target.closest('.review-diff');
  if (diff && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    diff.click();
  }
});
