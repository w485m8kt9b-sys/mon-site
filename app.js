const STORAGE_KEYS = { library: 'qrayti-library-v1', tasks: 'qrayti-tasks-v1' };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let library = readStorage(STORAGE_KEYS.library, []);
let tasks = readStorage(STORAGE_KEYS.tasks, []);
let toastTimer;

function readStorage(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : fallback; }
  catch { return fallback; }
}
function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { showToast('ما قدرناش نحفظو فهاد المتصفح.'); } }
function escapeHTML(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function showToast(message) {
  const toast = $('#toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}
function openView(name) {
  $$('.view').forEach(view => view.classList.toggle('active', view.id === `view-${name}`));
  $$('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.view === name));
  const active = $(`.nav-link[data-view="${name}"]`);
  $('#pageLabel').textContent = active ? active.textContent.trim() : 'الرئيسية';
  $('#sidebar').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (name === 'library') renderLibrary();
}
$$('.nav-link').forEach(button => button.addEventListener('click', () => openView(button.dataset.view)));
$$('[data-open]').forEach(button => button.addEventListener('click', () => openView(button.dataset.open)));
$('#mobileMenu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
document.addEventListener('click', event => { if (window.innerWidth <= 760 && !event.target.closest('#sidebar') && !event.target.closest('#mobileMenu')) $('#sidebar').classList.remove('open'); });

const today = new Intl.DateTimeFormat('ar-MA', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
$('#todayDate').textContent = today;
function updateCounts() {
  $('#lessonCount').textContent = library.filter(item => item.type === 'lesson').length;
  $('#exerciseCount').textContent = library.filter(item => item.type === 'exercise').length;
  renderRecent();
}
function splitSentences(text) { return text.replace(/\s+/g, ' ').split(/(?<=[.!؟?؛])\s+/).map(s => s.trim()).filter(Boolean); }
function summarize(text) {
  const sentences = splitSentences(text);
  if (sentences.length < 2) return { overview: text.trim(), points: [text.trim()] };
  const words = text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [];
  const stop = new Set(['التي','الذي','على','منها','لهذا','هناك','عندما','يمكن','تكون','يكون','كانت','وذلك','هذا','هذه','ذلك','فإن','كما','بعد','قبل','حيث','إلى','عن','مع','بين','الذي','التي','the','and','for','with','that','this','from','into','which']);
  const counts = Object.create(null);
  words.forEach(word => { if (!stop.has(word)) counts[word] = (counts[word] || 0) + 1; });
  const ranked = sentences.map((sentence, index) => {
    const terms = sentence.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [];
    const score = terms.reduce((sum, word) => sum + (stop.has(word) ? 0 : (counts[word] || 0)), 0) / Math.sqrt(Math.max(terms.length, 1));
    return { sentence, index, score };
  });
  const chosen = [...ranked].sort((a, b) => b.score - a.score).slice(0, Math.min(4, Math.ceil(sentences.length / 3))).sort((a, b) => a.index - b.index).map(x => x.sentence);
  return { overview: chosen.slice(0, 2).join(' '), points: chosen };
}
function saveItem(type, title, content) {
  library.unshift({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, type, title, content, createdAt: new Date().toISOString() });
  library = library.slice(0, 50); store(STORAGE_KEYS.library, library); updateCounts();
}
$('#lessonText').addEventListener('input', event => $('#lessonChars').textContent = `${event.target.value.length} حرف`);
$('#exerciseText').addEventListener('input', event => $('#exerciseChars').textContent = `${event.target.value.length} حرف`);
$('#summarizeButton').addEventListener('click', () => {
  const text = $('#lessonText').value.trim();
  if (text.length < 25) return showToast('زيد شوية من نص الدرس باش نقدروا نرتبوه.');
  const title = $('#lessonTitle').value.trim() || 'درس بلا عنوان';
  const result = summarize(text);
  const points = result.points.map(point => `<li>${escapeHTML(point)}</li>`).join('');
  $('#lessonResult').innerHTML = `<div class="result-content"><span class="result-tag">خلاصة للمراجعة</span><h2>${escapeHTML(title)}</h2><h3>الفكرة العامة</h3><p>${escapeHTML(result.overview)}</p><div class="result-divider"></div><h3>أفكار أساسية</h3><ul>${points}</ul><p class="disclaimer">راجع هاد الخلاصة مع الدرس الأصلي، حيث التلخيص الآلي البسيط يقدر يفوّت شي تفاصيل.</p><button class="save-button" id="saveLesson">♡ حفظ فالمحفوظات</button></div>`;
  $('#saveLesson').addEventListener('click', () => { saveItem('lesson', title, result.overview); showToast('تحفظ الدرس فالمحفوظات ديالك.'); });
});
$('#solveButton').addEventListener('click', () => {
  const text = $('#exerciseText').value.trim();
  if (text.length < 8) return showToast('كتب نص التمرين الأول.');
  const subject = $('#exerciseSubject').value === 'اختار المادة' ? 'مادة غير محددة' : $('#exerciseSubject').value;
  const title = `تمرين — ${subject}`;
  const sentences = splitSentences(text);
  const questions = sentences.filter(line => /\?|؟|احسب|أوجد|استنتج|بين|برهن|حل|فسر|حدد|ما هو|كم|calcul|détermin|montr|résou|pourquoi/i.test(line));
  const data = sentences.filter(line => !questions.includes(line));
  const steps = [
    ['قرا المطلوب مزيان', questions.length ? questions.join(' ') : 'حدد شنو خاصك تلقى أو تبرهن عليه من نص السؤال.'],
    ['خرج المعطيات', data.length ? data.join(' ') : 'كتب المعطيات والأرقام والوحدات اللي عطاك التمرين.'],
    ['اختار القاعدة المناسبة', `فـ${subject}، قلب على القاعدة أو الدرس اللي كيربط المعطيات بالمطلوب. كتب القاعدة قبل ما تعوض بالأرقام.`],
    ['خدم الحل وراجعو', 'طبق القاعدة خطوة بخطوة، كتب الوحدات إلا كانت مطلوبة، ومن بعد تحقق واش الجواب كيجاوب على السؤال.']
  ];
  $('#exerciseResult').innerHTML = `<div class="result-content"><span class="result-tag" style="background:#fff2e8;color:#c8793f">خطة التفكير · ${escapeHTML(subject)}</span><h2>نخدمو التمرين مرحلة بمرحلة</h2><ol>${steps.map(([heading, detail]) => `<li><strong>${escapeHTML(heading)}:</strong> ${escapeHTML(detail)}</li>`).join('')}</ol><div class="result-divider"></div><p><strong>دورك دابا:</strong> حاول تكمل الحساب أو البرهان بوحدك، وكتب النتيجة مع التحقق منها. هاد الخطة تنظيمية وماشي جواب نهائي مضمون.</p><button class="save-button" id="saveExercise">♡ حفظ التمرين</button></div>`;
  $('#saveExercise').addEventListener('click', () => { saveItem('exercise', title, text); showToast('تحفظ التمرين فالمحفوظات ديالك.'); });
});

$('#taskForm').addEventListener('submit', event => {
  event.preventDefault(); const name = $('#taskName').value.trim(); const subject = $('#taskSubject').value.trim();
  if (!name) return showToast('كتب اسم المهمة الأول.');
  tasks.unshift({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, name, subject, done: false }); store(STORAGE_KEYS.tasks, tasks); event.target.reset(); renderTasks(); showToast('تزادت المهمة للخطة ديالك.');
});
function renderTasks() {
  const list = $('#taskList'); $('#taskCounter').textContent = `${tasks.length} مهام`;
  if (!tasks.length) { list.innerHTML = '<div class="empty-state">مازال ما زدتي حتى مهمة. بدا بمهمة صغيرة وساهلة!</div>'; return; }
  list.innerHTML = tasks.map(task => `<div class="task-item ${task.done ? 'done' : ''}"><input type="checkbox" aria-label="علّم المهمة كمكتملة" data-task-check="${escapeHTML(task.id)}" ${task.done ? 'checked' : ''}><span class="task-name">${escapeHTML(task.name)}</span><span class="task-subject">${escapeHTML(task.subject || 'مادة عامة')}</span><button class="delete-task" data-task-delete="${escapeHTML(task.id)}" aria-label="مسح المهمة">×</button></div>`).join('');
  $$('[data-task-check]').forEach(input => input.addEventListener('change', () => { const task = tasks.find(item => item.id === input.dataset.taskCheck); if (task) task.done = input.checked; store(STORAGE_KEYS.tasks, tasks); renderTasks(); }));
  $$('[data-task-delete]').forEach(button => button.addEventListener('click', () => { tasks = tasks.filter(task => task.id !== button.dataset.taskDelete); store(STORAGE_KEYS.tasks, tasks); renderTasks(); }));
}
function renderLibrary() {
  const container = $('#libraryItems');
  if (!library.length) { container.innerHTML = '<div class="empty-state">مازال ما عندك والو فالمحفوظات. ملي تلخص درس ولا تحفظ تمرين غادي تلقاه هنا.</div>'; return; }
  container.innerHTML = library.map(item => `<article class="library-item"><span class="library-item-icon">${item.type === 'lesson' ? '▤' : '✎'}</span><div><strong>${escapeHTML(item.title)}</strong><small>${item.type === 'lesson' ? 'ملخص درس' : 'تمرين'} · ${new Intl.DateTimeFormat('ar-MA', { dateStyle: 'medium' }).format(new Date(item.createdAt))}</small><p>${escapeHTML(item.content)}</p></div></article>`).join('');
}
function renderRecent() {
  const recent = $('#recentItems');
  if (!library.length) { recent.textContent = 'مازال ما حفظتي حتى حاجة. جرّب شي أداة باش تبدا!'; recent.classList.add('empty-state'); return; }
  recent.classList.remove('empty-state'); recent.innerHTML = library.slice(0, 2).map(item => `<div class="library-item"><span class="library-item-icon">${item.type === 'lesson' ? '▤' : '✎'}</span><div><strong>${escapeHTML(item.title)}</strong><small>${item.type === 'lesson' ? 'ملخص درس' : 'تمرين'}</small></div></div>`).join('');
}
$('#clearLibrary').addEventListener('click', () => { if (!library.length) return showToast('المحفوظات خاوية أصلا.'); if (window.confirm('واش متأكد بغيتي تمسح المحفوظات كاملين من هاد الجهاز؟')) { library = []; store(STORAGE_KEYS.library, library); updateCounts(); renderLibrary(); showToast('تمسحات المحفوظات.'); } });
renderTasks(); renderLibrary(); updateCounts();
