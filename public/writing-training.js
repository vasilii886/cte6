'use strict';

const writingTrainingStages = {
  foundation: {
    practice: '整理首尾功能句，固定两种主体论证方法并各交一段。现阶段先练公式 3 → 5 → 8 → 9 → 13，题目适合时再用驳论。',
    assessment: '明确表态，写实一个例子或机制，解释它怎样支撑理由，结尾回到观点。每篇至少用一种练过的方法。',
    source: '基础款第 7—8、10—17、20 页 ·《使用说明》·《例证用法》第 2—3 页',
  },
  advanced: {
    practice: '列两种候选角度并说明取舍，另练一次「合理质疑 → 让步 → 回应」。用箭头写清行为、机制与结果。',
    assessment: '角度直接回应限定，用例证或同标准对比支持机制并回扣论点。两篇采用不同的主要论证方法。',
    source: '进阶款第 2—11、14—23 页 ·《深度立意》第 1—8 页 ·《例证用法》第 4—8 页',
  },
  final: {
    practice: '做一次限时原稿 → 自检和批改 → 重写，记录一个要带到新题核查的常见问题。',
    assessment: '在题目规定时间内保质成文并留时自检。交审题、写作、自检分项用时和一条自检结果。',
    source: '终极款第 3—9 页',
  },
  ability: {
    practice: '分别练举例、正反对比、假设后果、析因结果和比喻。试写开头和结尾的变体，说明为什么选这种写法。',
    assessment: '在题目规定时间内独立完成并自检。两篇用不同的主要论证法，说明选法和迁移了哪项反馈。',
    source: '能力版第 2—13 页',
  },
};

const writingTrainingKinds = {practice: '专项或整篇练习', diagnostic: '阶段诊断', rewrite: '同题重写', assessment: '独立新题验收'};
const writingTrainingMethods = {
  example: '举例', contrast: '正反对比', hypothesis: '假设后果', cause: '析因结果',
  analogy: '比喻', layers: '三层递进', phenomenon: '现象到本质',
};
const writingTrainingTiming = {planMinutes: '审题', writeMinutes: '写作', checkMinutes: '自检'};

function normalizeWritingTraining(value, parentId) {
  const text = input => typeof input === 'string' ? input.slice(0, 1200) : '';
  const minutes = input => Number.isFinite(input) && input >= 0 && input <= 1440 ? input : null;
  const kind = parentId ? 'rewrite' : Object.hasOwn(writingTrainingKinds, value?.kind) ? String(value.kind) : 'practice';
  return {
    kind,
    independent: kind === 'assessment' && value?.independent === true,
    method: Object.hasOwn(writingTrainingMethods, value?.method) ? String(value.method) : '',
    planMinutes: minutes(value?.planMinutes),
    writeMinutes: minutes(value?.writeMinutes),
    checkMinutes: minutes(value?.checkMinutes),
    selfCheck: text(value?.selfCheck),
    notes: text(value?.notes),
  };
}

function renderWritingTrainingRoute(stage) {
  return `<details class="foundation-formulas writing-training-route">
    <summary><strong>四阶段训练路线</strong> <span>专项 → 整篇 → 重写 → 独立新题验收</span></summary>
    <div class="foundation-formulas-content">
      <p>先完成专项，再用两道不同的新题连续达标。教练核对完整题面、原稿和阶段证据后给出结论。同题重写和自检打勾用于复盘。</p>
      <ul>${WRITING_GUIDE.stages.map(s => {
        const guide = writingTrainingStages[s.id];
        if (!guide) return '';
        return `<li>
          <div class="foundation-formula-label"><strong>${esc(s.name)}</strong>
          ${s.id === stage ? '<small>本稿练习阶段</small>' : ''}</div>
          <div><p><strong>专项</strong>　${esc(guide.practice)}</p>
          <p><strong>验收</strong>　${esc(guide.assessment)}</p><small>${esc(guide.source)}</small></div>
        </li>`;
      }).join('')}</ul>
      <p>保存草稿后，点击「下载草稿送批」交给 <code>$cet6-writing-coach</code>。云端草稿可先登录打开，再下载或在 Codex 中请教练读取已打开的草稿。</p>
      <p>收到批改 JSON 后，到「作文批改」导入，查看改句、SOP 依据、当前验收进度和下一次练什么。</p>
      ${stage === 'foundation' ? '<button class="btn small" data-action="writing-diagnostic">开始基础诊断</button>' : ''}
    </div>
  </details>`;
}

function renderWritingTrainingFields(draft) {
  const training = normalizeWritingTraining(draft.training, draft.parentSubmissionId);
  const assessment = training.kind === 'assessment';
  const timed = draft.stage === 'final' || draft.stage === 'ability';
  const note = draft.stage === 'ability' ? '写下选法理由，以及你在本稿迁移的一项反馈。' : '记录专项用法、取舍理由或这次要验证的问题。';
  return `<details class="writing-outline writing-training-fields" ${assessment || training.kind === 'diagnostic' ? 'open' : ''}>
    <summary>本次训练记录 <span>${writingTrainingKinds[training.kind]}</span></summary>
    <div class="writing-training-inputs">
      <label class="form-field">本次类型<select name="training-kind" ${draft.parentSubmissionId ? 'disabled' : ''}>
        ${Object.entries(writingTrainingKinds).map(([id, label]) => `<option value="${id}" ${id === training.kind ? 'selected' : ''}>${label}</option>`).join('')}
      </select></label>
      ${assessment ? `<label class="writing-training-independent"><input name="training-independent" type="checkbox" ${training.independent ? 'checked' : ''}>
        这是我首次做这道题。我独立完成整篇，作答前未看过本题的提纲、提示或范文。</label>` : ''}
      <label class="form-field">主要论证方法<select name="training-method">
        <option value="">选择本稿主要方法</option>
        ${Object.entries(writingTrainingMethods).map(([id, label]) => `<option value="${id}" ${id === training.method ? 'selected' : ''}>${label}</option>`).join('')}
      </select></label>
      ${timed ? `<div class="writing-training-timing">${Object.entries(writingTrainingTiming).map(([key, label]) =>
        `<label class="form-field">${label}（分钟）<input type="number" name="training-${key}" min="0" max="1440" step="any" value="${training[key] ?? ''}"></label>`
      ).join('')}</div>
      <label class="form-field">自检结果<textarea name="training-selfCheck" rows="2" maxlength="1200" placeholder="例如：核对了指定首句，修正了两个主谓一致问题。">${esc(training.selfCheck)}</textarea></label>` : ''}
      <label class="form-field">练习笔记<textarea name="training-notes" rows="2" maxlength="1200" placeholder="${note}">${esc(training.notes)}</textarea></label>
    </div>
  </details>`;
}

function updateWritingTraining(target, draft) {
  if (!target.name?.startsWith('training-')) return false;
  const key = target.name.slice('training-'.length);
  const value = key === 'independent' ? target.checked
    : Object.hasOwn(writingTrainingTiming, key) ? (target.value === '' ? null : Number(target.value))
      : target.value;
  draft.training = normalizeWritingTraining({...draft.training, [key]: value}, draft.parentSubmissionId);
  return true;
}

function writingPracticeId(draft) {
  return draft.cloudLink?.id ?? draft.id;
}

function writingDraftExport(draft) {
  const exam = writingExamById(draft.examId);
  return {
    format: 'cet6-writing-draft-v1',
    draft: {
      ...cloudDraftDocument(draft),
      id: writingPracticeId(draft),
      updatedAt: draft.updatedAt,
      wordCount: writingDraftWords(draft),
    },
    ...(exam ? {exam: {
      id: exam.id, period: exam.period, set: exam.set, kind: exam.kind, prompt: exam.prompt,
      opening: exam.opening, excludeOpeningFromCount: exam.excludeOpeningFromCount === true,
      minutes: exam.minutes, minWords: exam.minWords, maxWords: exam.maxWords,
      sourceFile: exam.sourceFile, page: exam.page,
      ...(exam.figure ? {figure: new URL(exam.figure, location.href).href} : {}),
    }} : {}),
  };
}

const writingCoachResults = {
  practice: '本次是练习', met: '本篇达到要求',
  needs_revision: '本篇需要重写', insufficient: '验收证据不足',
};

function normalizeWritingCoach(value, stage) {
  if (!value || !Object.hasOwn(writingTrainingStages, stage) || value.stage !== stage
      || typeof value.result !== 'string' || !Object.hasOwn(writingCoachResults, value.result)
      || !Number.isInteger(value.streak) || value.streak < 0 || value.streak > 2
      || (value.stagePassed === true && (value.result !== 'met' || value.streak !== 2))
      || typeof value.draftId !== 'string' || !/^[-\w]{12,80}$/.test(value.draftId)
      || typeof value.next !== 'string' || !value.next.trim()
      || typeof value.evidence !== 'string' || !value.evidence.trim()) return null;
  const checks = Array.isArray(value.checks) ? value.checks.slice(0, 12).filter(check => check
    && typeof check.label === 'string' && check.label.trim()
    && typeof check.result === 'string' && Object.hasOwn(writingCoachResults, check.result) && check.result !== 'practice'
    && typeof check.evidence === 'string' && check.evidence.trim()).map(check => ({
      label: check.label.slice(0, 120), result: check.result, evidence: check.evidence.slice(0, 600),
    })) : [];
  return {
    draftId: value.draftId, stage, result: value.result, streak: value.streak,
    stagePassed: value.stagePassed === true, next: value.next.slice(0, 1000),
    evidence: value.evidence.slice(0, 1200), checks,
  };
}

function writingCoachNextStage(coach) {
  if (!coach?.stagePassed) return null;
  const stages = WRITING_GUIDE.stages;
  return stages[stages.findIndex(stage => stage.id === coach.stage) + 1] ?? null;
}

function renderWritingCoach(coach) {
  if (!coach) return '';
  const nextStage = writingCoachNextStage(coach);
  const result = coach.stagePassed ? '阶段通过' : writingCoachResults[coach.result];
  return `<section class="writing-coach-feedback rail-card" aria-label="教练训练反馈">
    <div class="writing-coach-feedback-head"><h3>${esc(writingStage(coach.stage).name)} · ${esc(result)}</h3>
      <span class="tag">连续达标 ${coach.streak}/2</span></div>
    <p>${esc(coach.evidence)}</p>
    ${coach.checks.length ? `<ul>${coach.checks.map(check =>
      `<li><strong>${esc(check.label)}</strong> · ${esc(writingCoachResults[check.result])}<br>${esc(check.evidence)}</li>`
    ).join('')}</ul>` : ''}
    <p><strong>下一次练习</strong>　${esc(coach.next)}</p>
    ${nextStage ? `<button class="btn primary small" data-action="writing-review-next-stage">新建${esc(nextStage.name)}练习</button>` : ''}
  </section>`;
}
