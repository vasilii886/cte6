'use strict';

const writingCloudEnabled = /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(WRITING_CLOUD_CONFIG.url)
  && /^sb_publishable_[A-Za-z0-9_-]+$/.test(WRITING_CLOUD_CONFIG.publishableKey);
const cloudDraftTable = 'cet6_writing_drafts';
let cloudClientPromise, cloudUser = null, cloudDraftBusy = false;

function loadWritingCloudSdk() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './vendor/supabase.js?v=2.119.0';
    script.onload = () => resolve(window.supabase);
    script.onerror = () => {
      script.remove();
      reject(new Error('登录组件暂时加载失败。'));
    };
    document.head.appendChild(script);
  });
}

function setWritingCloudUser(user) {
  if (user?.id === cloudUser?.id) return;
  if (cloudUser && state.view === 'writing') closeModal();
  cloudUser = user ?? null;
  const activeWasCloud = WRITING.drafts.some(d => d.cloudOnly && d.id === WRITING.activeId);
  WRITING.drafts = WRITING.drafts.filter(d => !d.cloudOnly);
  if (activeWasCloud) WRITING.activeId = WRITING.drafts[0]?.id ?? null;
  if (state.view === 'writing') render();
}

function connectWritingCloud() {
  if (!cloudClientPromise) {
    cloudClientPromise = (async () => {
      const sdk = await loadWritingCloudSdk();
      const client = sdk.createClient(WRITING_CLOUD_CONFIG.url, WRITING_CLOUD_CONFIG.publishableKey, {
        auth: {flowType: 'pkce', storageKey: 'shici.writing.auth.v1'},
      });
      const {data, error} = await client.auth.getSession();
      if (error) throw error;
      setWritingCloudUser(data.session?.user);
      client.auth.onAuthStateChange((_event, session) => {
        queueMicrotask(() => setWritingCloudUser(session?.user));
      });
      return client;
    })().catch(error => {
      cloudClientPromise = null;
      throw error;
    });
  }
  return cloudClientPromise;
}

function renderWritingCloudControls() {
  if (!writingCloudEnabled) return '';
  if (!cloudClientPromise) {
    queueMicrotask(() => {
      void connectWritingCloud().catch(() => {});
    });
  }
  return cloudUser
    ? `<div class="view-actions"><button class="btn" data-action="writing-cloud-list">我的云端草稿</button>
      <button class="btn" data-action="writing-cloud-sign-out">退出 GitHub 登录</button></div>`
    : '<button class="btn" data-action="writing-cloud-sign-in">用 GitHub 登录云端作文</button>';
}

function renderWritingCloudSave() {
  return writingCloudEnabled
    ? '<button type="button" class="btn primary" data-action="writing-cloud-save">保存到云端</button>'
    : '';
}

function cloudDraftDocument(d) {
  const {stage, title, prompt, body, outline, minWords, maxWords, minutes, checks, examId, createdAt} = d;
  const parentSubmissionId = d.parentSubmissionId ?? null;
  const training = normalizeWritingTraining(d.training, parentSubmissionId);
  return {stage, title, prompt, body, outline, minWords, maxWords, minutes, checks, examId, createdAt,
    parentSubmissionId, training, ...(d.review ? {review: d.review} : {})};
}

async function signInWritingCloud(client) {
  const redirect = new URL('./', location.href);
  redirect.searchParams.set('view', 'writing');
  const {error} = await client.auth.signInWithOAuth({
    provider: 'github',
    options: {redirectTo: redirect.toString()},
  });
  if (error) throw error;
}

async function saveWritingCloudDraft(client) {
  if (cloudDraftBusy) {
    toast('请等待正在进行的云端操作。');
    return;
  }
  if (!cloudUser) {
    toast('请先用 GitHub 登录，再保存到云端。');
    return;
  }
  const draft = writingDraft();
  if (!draft.body.trim()) {
    toast('请先写下作文正文。');
    return;
  }
  const owner = cloudUser.id;
  const serialized = JSON.stringify(cloudDraftDocument(draft));
  if (new TextEncoder().encode(serialized).length > 290000) {
    toast('这份草稿和批改记录过大，请先下载备份。');
    return;
  }
  const document = JSON.parse(serialized);
  const known = draft.cloudLink?.owner === owner ? draft.cloudLink : null;
  cloudDraftBusy = true;
  try {
    const table = client.from(cloudDraftTable);
    const operation = known
      ? table.update({document, revision: known.revision + 1})
        .eq('owner_id', owner).eq('id', known.id).eq('revision', known.revision)
      : table.insert({owner_id: owner, id: draft.id, document});
    const {data, error} = await operation.select('revision, updated_at').maybeSingle();
    if (cloudUser?.id !== owner) return;
    if (error?.code === '23505' || (!error && !data)) {
      toast('云端已有更新。请从「我的云端草稿」打开最新版，或另存一份后再上传。');
      return;
    }
    if (error) throw error;
    draft.cloudLink = {owner, id: known?.id ?? draft.id, revision: data.revision};
    if (draft.cloudOnly) {
      draft.cloudSnapshot = JSON.stringify(document);
    } else {
      writingPersist();
    }
    if (WRITING.activeId === draft.id) updateWritingIndicators();
    toast('这一稿已保存到云端。');
  } finally {
    cloudDraftBusy = false;
  }
}

function renderWritingCloudDelete(row, fromList = false) {
  const attributes = `data-revision="${esc(row.revision)}" data-title="${esc(row.title)}" data-from-cloud-list="${fromList}"`;
  return renderWritingDraftDelete('writing-cloud-delete', row.id, row.title, '云端', attributes);
}

function confirmCloudWritingDraftDeletion(button) {
  const owner = cloudUser?.id;
  const {id, title} = button.dataset;
  const revision = Number(button.dataset.revision);
  if (!owner || !id || !Number.isSafeInteger(revision) || revision < 0 || button.dataset.revision === '') return;
  const fromList = button.dataset.fromCloudList === 'true';
  const linked = draft => draft.cloudLink?.owner === owner && draft.cloudLink.id === id;
  const hasUnsavedEdits = WRITING.drafts.some(draft => linked(draft) && draft.cloudOnly
    && draft.cloudSnapshot !== JSON.stringify(cloudDraftDocument(draft)));
  const detail = hasUnsavedEdits
    ? '这份云端草稿和当前打开的未保存修改会一起删除。已有本机副本会保留。'
    : '此账号下各设备的云端记录和附带批改会被删除。已有本机副本会保留。';
  confirmWritingDraftDeletion('云端', title, detail, async confirm => {
    if (cloudUser?.id !== owner) return;
    if (cloudDraftBusy) {
      toast('请等待正在进行的云端操作。');
      return;
    }
    cloudDraftBusy = true;
    try {
      const client = await connectWritingCloud();
      if (cloudUser?.id !== owner) return;
      const {data, error} = await client.from(cloudDraftTable).delete()
        .eq('owner_id', owner).eq('id', id).eq('revision', revision).select('id').maybeSingle();
      if (cloudUser?.id !== owner) return;
      if (error?.code === '42501' || (!error && !data)) {
        toast('云端未删除。草稿可能已更新，或账号缺少删除权限。');
        return;
      }
      if (error) throw error;
      WRITING.drafts = WRITING.drafts.filter(draft => !draft.cloudOnly || !linked(draft));
      for (const draft of WRITING.drafts) {
        if (linked(draft)) delete draft.cloudLink;
      }
      selectRemainingWritingDraft();
      const saved = writingPersist();
      const refreshList = (confirm.isConnected && fromList) || document.querySelector('[data-writing-cloud-list]');
      if (confirm.isConnected) closeModal();
      if (state.view === 'writing') {
        render();
        if (refreshList) {
          try {
            await listWritingCloudDrafts(client);
          } catch {
            toast('云端草稿已删除，列表刷新失败，请重新打开。');
            return;
          }
        }
      }
      toast(saved ? '云端草稿已删除。' : '云端草稿已删除，本机同步状态保存失败。');
    } catch {
      toast('云端删除未确认，请重新打开列表核对。');
    } finally {
      cloudDraftBusy = false;
    }
  }, fromList);
}

async function listWritingCloudDrafts(client) {
  const owner = cloudUser?.id;
  if (!owner) return;
  const {data, error} = await client.from(cloudDraftTable)
    .select('id, title:document->>title, updated_at, revision')
    .eq('owner_id', owner).order('updated_at', {ascending: false}).limit(100);
  if (cloudUser?.id !== owner || state.view !== 'writing') return;
  if (error) throw error;
  const rows = data.map(row => {
    const title = row.title || '未命名练习';
    return `<div class="writing-cloud-draft-row" data-writing-draft-row>
      <div class="writing-cloud-draft-title"><strong>${esc(title)}</strong><small>${esc(writingDate(row.updated_at))}</small></div>
      <button class="btn small" data-action="writing-cloud-open" data-id="${esc(row.id)}">打开</button>
      ${renderWritingCloudDelete({...row, title}, true)}
    </div>`;
  }).join('');
  openModal(`${modalHeader('我的云端草稿')}<div data-writing-cloud-list>${rows || '<p>还没有保存到云端的作文。</p>'}</div>`);
}

async function openWritingCloudDraft(client, id) {
  const owner = cloudUser?.id;
  if (!owner) return;
  const {data, error} = await client.from(cloudDraftTable).select('id, document, revision, updated_at')
    .eq('owner_id', owner).eq('id', id).single();
  if (cloudUser?.id !== owner || state.view !== 'writing') return;
  if (error) throw error;
  const {stage, title, prompt, body, outline, minWords, maxWords, minutes, checks, examId, createdAt} = data.document;
  const draft = {
    stage, title, prompt, body,
    outline: typeof outline === 'string' ? outline : '',
    minWords: Number.isInteger(minWords) ? minWords : 150,
    maxWords: Number.isInteger(maxWords) ? maxWords : 200,
    minutes: Number.isFinite(minutes) ? minutes : null,
    checks: Array.isArray(checks) ? checks.filter(value => typeof value === 'string') : [],
    examId: typeof examId === 'string' ? examId : null,
    createdAt: typeof createdAt === 'string' ? createdAt : data.updated_at,
    id: crypto.randomUUID(), synced: false, cloudOnly: true, updatedAt: data.updated_at,
    cloudLink: {owner, id: data.id, revision: data.revision},
    parentSubmissionId: typeof data.document.parentSubmissionId === 'string' ? data.document.parentSubmissionId : null,
    training: normalizeWritingTraining(data.document.training, data.document.parentSubmissionId),
    review: normalizeWritingReview(data.document.review),
  };
  draft.cloudSnapshot = JSON.stringify(cloudDraftDocument(draft));
  const keepDraft = d => !d.cloudOnly || d.cloudLink.id !== id
    || d.cloudSnapshot !== JSON.stringify(cloudDraftDocument(d));
  WRITING.drafts = [draft, ...WRITING.drafts.filter(keepDraft)];
  WRITING.activeId = draft.id;
  WRITING.stage = draft.stage;
  const exam = writingExamById(draft.examId);
  if (exam) showWritingExam(exam);
  writingPersist();
  closeModal();
  writingLocation();
  render();
  window.scrollTo({top: 0});
}

function handleWritingCloudAction(action, button) {
  if (!action.startsWith('writing-cloud-')) return false;
  if (!writingCloudEnabled) return true;
  if (action === 'writing-cloud-delete') {
    confirmCloudWritingDraftDeletion(button);
    return true;
  }
  const requestedDraft = action === 'writing-cloud-save' ? WRITING.activeId : null;
  void (async () => {
    const client = await connectWritingCloud();
    switch (action) {
      case 'writing-cloud-sign-in':
        await signInWritingCloud(client);
        break;
      case 'writing-cloud-sign-out': {
        const {error} = await client.auth.signOut({scope: 'local'});
        if (error) throw error;
        setWritingCloudUser(null);
        toast('已退出云端作文。');
        break;
      }
      case 'writing-cloud-save':
        if (WRITING.activeId === requestedDraft) await saveWritingCloudDraft(client);
        break;
      case 'writing-cloud-list':
        await listWritingCloudDrafts(client);
        break;
      case 'writing-cloud-open':
        if (cloudDraftBusy) toast('请等待正在进行的云端操作。');
        else await openWritingCloudDraft(client, button.dataset.id);
        break;
    }
  })().catch(() => toast('云端操作未完成，请检查网络或数据库状态后重试。'));
  return true;
}
