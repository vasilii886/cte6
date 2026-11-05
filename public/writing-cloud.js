'use strict';

const writingCloudEnabled = /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(WRITING_CLOUD_CONFIG.url)
  && /^sb_publishable_[A-Za-z0-9_-]+$/.test(WRITING_CLOUD_CONFIG.publishableKey);
const cloudDraftTable = 'cet6_writing_drafts';
let cloudClientPromise, cloudUser = null, cloudSaving = false;

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
  return {stage, title, prompt, body, outline, minWords, maxWords, minutes, checks, examId, createdAt, ...(d.review ? {review: d.review} : {})};
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
  if (cloudSaving) return;
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
  cloudSaving = true;
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
    cloudSaving = false;
  }
}

async function listWritingCloudDrafts(client) {
  const owner = cloudUser?.id;
  if (!owner) return;
  const {data, error} = await client.from(cloudDraftTable)
    .select('id, title:document->>title, updated_at')
    .eq('owner_id', owner).order('updated_at', {ascending: false}).limit(100);
  if (cloudUser?.id !== owner || state.view !== 'writing') return;
  if (error) throw error;
  const rows = data.map(row => `<p>
    <button class="btn" data-action="writing-cloud-open" data-id="${esc(row.id)}">打开</button>
    ${esc(row.title || '未命名练习')} · ${esc(writingDate(row.updated_at))}
  </p>`).join('');
  openModal(`${modalHeader('我的云端草稿')}<div>${rows || '<p>还没有保存到云端的作文。</p>'}</div>`);
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
        await openWritingCloudDraft(client, button.dataset.id);
        break;
    }
  })().catch(() => toast('云端操作未完成，请检查网络或数据库状态后重试。'));
  return true;
}
