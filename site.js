const localPreview = window.location.protocol === 'file:';
const externalApi = document.querySelector('meta[name="intake-api"]')?.content;
const apiOrigin = externalApi || window.location.origin;
const form = document.querySelector('#intake-form');
const fields = document.querySelector('#submission-fields');
const submit = document.querySelector('#submit');
const selection = document.querySelector('#selection');
const errorMessage = document.querySelector('#submit-error');
const progress = document.querySelector('#progress');
const uploadStatus = document.querySelector('#upload-status');
const uploadMessage = document.querySelector('#upload-message');
const success = document.querySelector('#success');
const entries = {photo: [], video: []};
let attempt;
let busy = false;
let intakeReady = !localPreview && !externalApi;

async function checkIntake() {
  const notice = document.querySelector('#connection-status');
  notice.hidden = false;
  notice.textContent = '자료 제출을 준비하고 있습니다.';
  try {
    const response = await fetch(new URL('/api/submissions/status', apiOrigin), {cache: 'no-store'});
    intakeReady = response.ok && (await response.json()).ready === true;
  } catch {
    intakeReady = false;
  }
  submit.disabled = !intakeReady;
  notice.hidden = intakeReady;
  notice.textContent = intakeReady ? '' : '자료 접수가 준비되면 이 페이지에서 보내실 수 있습니다.';
}

if (localPreview) {
  document.querySelector('#local-preview').hidden = false;
} else if (externalApi) {
  checkIntake();
} else {
  submit.disabled = !intakeReady;
}

function displaySize(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function invalidateAttempt() {
  attempt = undefined;
  errorMessage.hidden = true;
  uploadStatus.hidden = true;
  submit.firstChild.textContent = '자료 보내기 ';
}

function showSelection() {
  const photoText = entries.photo.length ? `사진 ${entries.photo.length}장` : '';
  const videoText = entries.video.length ? '영상 1개' : '';
  selection.textContent = [photoText, videoText].filter(Boolean).join(', ') || '선택한 파일 없음';
}

function photoFields(entry) {
  const group = document.createElement('div');
  group.className = 'photo-fields';
  const prompts = [
    {name: 'year', label: '촬영연도', placeholder: '예. 2016', max: 20},
    {name: 'place', label: '장소 또는 행사', placeholder: '예. HCI 학회', max: 100},
    {name: 'people', label: '등장인물', placeholder: '기억나는 이름을 적어주세요', max: 160},
    {name: 'memory', label: '짧은 에피소드', placeholder: '그날 기억나는 일이 있다면 적어주세요', max: 300},
  ];
  for (const prompt of prompts) {
    const label = document.createElement('label');
    const input = document.createElement(prompt.name === 'memory' ? 'textarea' : 'input');
    input.setAttribute('aria-label', `${prompt.label} (${entry.file.name})`);
    input.placeholder = prompt.placeholder;
    input.maxLength = prompt.max;
    if (input instanceof HTMLTextAreaElement) input.rows = 2;
    input.addEventListener('input', () => { entry.notes[prompt.name] = input.value; });
    label.append(prompt.label, input);
    group.append(label);
  }
  return group;
}

function appendFile(entry, kind) {
  const card = document.createElement('li');
  card.className = 'file-card';
  const row = document.createElement('div');
  row.className = 'file-row';
  const thumb = document.createElement('div');
  thumb.className = 'file-thumb';
  thumb.setAttribute('aria-hidden', 'true');
  thumb.textContent = kind === 'photo' ? '사진' : '▷';
  if (kind === 'photo') {
    const image = document.createElement('img');
    image.alt = '';
    entry.objectUrl = URL.createObjectURL(entry.file);
    image.addEventListener('load', () => thumb.replaceChildren(image), {once: true});
    image.src = entry.objectUrl;
  }
  const info = document.createElement('div');
  info.className = 'file-info';
  const filename = document.createElement('strong');
  filename.className = 'file-name';
  filename.textContent = entry.file.name;
  filename.title = entry.file.name;
  const size = document.createElement('span');
  size.className = 'file-size';
  size.textContent = displaySize(entry.file.size);
  info.append(filename, size);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove-file';
  remove.textContent = '×';
  remove.setAttribute('aria-label', `${entry.file.name} 삭제`);
  remove.addEventListener('click', () => {
    removeEntry(kind, entry);
    invalidateAttempt();
    showSelection();
    document.querySelector(kind === 'photo' ? '#photos' : '#videos').focus();
  });
  row.append(thumb, info, remove);
  card.append(row);
  if (kind === 'photo') card.append(photoFields(entry));
  entry.card = card;
  document.querySelector(`#${kind}-list`).append(card);
}

function removeEntry(kind, entry) {
  if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl);
  entry.card.remove();
  entries[kind].splice(entries[kind].indexOf(entry), 1);
}

function addFiles(files, kind) {
  if (busy) return;
  const feedback = document.querySelector(`#${kind}-error`);
  const messages = new Set();
  const fileLimit = kind === 'photo' ? limits.photoBytes : limits.videoBytes;
  let added = false;
  for (const file of files) {
    if (mediaType(file.name)?.kind !== kind) {
      messages.add(kind === 'photo' ? 'JPG, PNG, WebP, GIF, HEIC 사진을 선택해 주세요.' : 'MP4, MOV, WebM 영상을 선택해 주세요.');
      continue;
    }
    if (!file.size || file.size > fileLimit) {
      messages.add('이 파일을 추가할 수 없습니다. 다른 파일을 선택해 주세요.');
      continue;
    }
    if (kind === 'photo' && entries.photo.length >= limits.photoCount) {
      messages.add('사진은 한 번에 8장까지 선택할 수 있습니다.');
      break;
    }
    if (entries[kind].some(({file: other}) => other.name === file.name && other.size === file.size && other.lastModified === file.lastModified)) continue;
    if (kind === 'video' && entries.video.length) removeEntry('video', entries.video[0]);
    const entry = {file, notes: {}};
    entries[kind].push(entry);
    appendFile(entry, kind);
    added = true;
    if (kind === 'video') break;
  }
  feedback.hidden = messages.size === 0;
  feedback.textContent = [...messages].join(' ');
  if (added) invalidateAttempt();
  showSelection();
}

for (const [kind, selector] of [['photo', '#photos'], ['video', '#videos']]) {
  const input = document.querySelector(selector);
  input.addEventListener('change', () => {
    addFiles(input.files, kind);
    input.value = '';
  });
  const drop = document.querySelector(`[data-kind="${kind}"]`);
  drop.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (!busy) drop.classList.add('dragging');
  });
  drop.addEventListener('dragleave', (event) => {
    if (!drop.contains(event.relatedTarget)) drop.classList.remove('dragging');
  });
  drop.addEventListener('drop', (event) => {
    event.preventDefault();
    drop.classList.remove('dragging');
    addFiles(event.dataTransfer.files, kind);
  });
}

form.addEventListener('input', () => { if (!busy) invalidateAttempt(); });

function requestError(statusCode, message) {
  const error = new Error(message || '파일을 보내는 중 문제가 생겼습니다.');
  error.status = statusCode;
  return error;
}

async function retry(operation) {
  for (let index = 0; ; index += 1) {
    try {
      return await operation();
    } catch (error) {
      const transient = error.status == null || error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
      if (!transient || index >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 600 * 2 ** index));
    }
  }
}

async function post(url, payload, token) {
  const headers = {'Content-Type': 'application/json'};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(new URL(url, apiOrigin), {method: 'POST', headers, body: JSON.stringify(payload)});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw requestError(response.status, data.message);
  return data;
}

function sendPart(url, token, part, report) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', new URL(url, apiOrigin));
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.timeout = 120000;
    xhr.responseType = 'json';
    xhr.upload.addEventListener('progress', (event) => report(event.loaded));
    xhr.addEventListener('load', () => {
      if (xhr.status === 200 && xhr.response?.etag) resolve(xhr.response);
      else reject(requestError(xhr.status, xhr.response?.message));
    });
    xhr.addEventListener('error', () => reject(requestError(0, '인터넷 연결을 확인해 주세요.')));
    xhr.addEventListener('timeout', () => reject(requestError(408, '전송 시간이 길어졌습니다. 연결을 확인해 주세요.')));
    xhr.send(part);
  });
}

async function sendSubmission(files, sender) {
  const total = files.reduce((sum, {file}) => sum + file.size, 0);
  if (!attempt) {
    const payload = {sender, files: files.map(({file, notes}) => ({name: file.name, size: file.size, notes}))};
    uploadMessage.textContent = '파일을 보낼 준비를 하고 있습니다.';
    const session = await post('/api/submissions', payload);
    if (!session.id || !session.token) throw requestError(502, '접수 서버에 연결할 수 없습니다.');
    attempt = {...session, parts: files.map(() => [])};
  }
  const base = `/api/submissions/${attempt.id}`;
  let sent = 0;
  for (const [index, {file}] of files.entries()) {
    const parts = attempt.parts[index];
    const partCount = Math.ceil(file.size / limits.partBytes);
    uploadMessage.textContent = `파일 보내는 중 (${index + 1} / ${files.length})`;
    for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
      const start = partIndex * limits.partBytes;
      const part = file.slice(start, start + limits.partBytes);
      const report = (bytes) => { progress.value = Math.min(99, (sent + bytes) / total * 100); };
      if (!parts[partIndex]) parts[partIndex] = await retry(() => sendPart(`${base}/files/${index}/parts/${partIndex + 1}`, attempt.token, part, report));
      sent += part.size;
      progress.value = Math.min(99, sent / total * 100);
    }
  }
  uploadMessage.textContent = '파일 저장을 확인하고 있습니다.';
  return retry(() => post(`${base}/complete`, {parts: attempt.parts}, attempt.token));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!intakeReady || busy) return;
  errorMessage.hidden = true;
  const files = [...entries.photo, ...entries.video];
  const sender = Object.fromEntries(new FormData(form));
  if (!sender.name?.trim() || !files.length) {
    errorMessage.textContent = !sender.name?.trim() ? '성함을 적어주세요.' : '사진이나 영상 중 하나를 선택해 주세요.';
    errorMessage.hidden = false;
    errorMessage.focus();
    return;
  }
  busy = true;
  fields.disabled = true;
  submit.disabled = true;
  submit.firstChild.textContent = '보내는 중 ';
  uploadStatus.hidden = false;
  progress.value = 0;
  try {
    const receipt = await sendSubmission(files, sender);
    progress.value = 100;
    form.hidden = true;
    document.querySelector('#success-message').textContent = `보내주셔서 감사합니다. 접수번호 ${receipt.code}`;
    success.hidden = false;
    success.focus();
  } catch (error) {
    if (error.status === 404 || error.status === 409) attempt = undefined;
    uploadStatus.hidden = true;
    errorMessage.textContent = `${error.message || '인터넷 연결을 확인해 주세요.'} 자료는 이 화면에 남아 있습니다.`;
    errorMessage.hidden = false;
    errorMessage.focus();
    submit.firstChild.textContent = attempt ? '전송 이어서 하기 ' : '다시 보내기 ';
  } finally {
    busy = false;
    fields.disabled = false;
    submit.disabled = false;
  }
});

document.querySelector('#send-more').addEventListener('click', () => {
  for (const kind of ['photo', 'video']) {
    for (const entry of [...entries[kind]]) removeEntry(kind, entry);
    document.querySelector(`#${kind}-error`).hidden = true;
  }
  form.reset();
  invalidateAttempt();
  showSelection();
  success.hidden = true;
  form.hidden = false;
  document.querySelector('#sender-name').focus();
});

const invitationDialog = document.querySelector('#invitation-dialog');
document.querySelector('#invitation-open')?.addEventListener('click', () => {
  invitationDialog.showModal();
  invitationDialog.scrollTop = 0;
});
