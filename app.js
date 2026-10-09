const STORAGE_KEY = 'school-app-v1';
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
const PERIODS = 8;
const MAX_LOAD = 6;

const initialTeachers = [
  { id: 1, name: 'أحمد محمد', subject: 'رياضيات', tt: { 'الأحد_1': '1/1', 'الأحد_2': '1/2', 'الثلاثاء_3': '2/3' } },
  { id: 2, name: 'سارة علي', subject: 'لغة عربية', tt: { 'الاثنين_4': '3/1', 'الأربعاء_2': '4/2' } },
  { id: 3, name: 'حسن سالم', subject: 'علوم', tt: { 'الأحد_3': '5/1', 'الخميس_1': '6/3' } },
  { id: 4, name: 'مروة حسن', subject: 'إنجليزي', tt: { 'الثلاثاء_1': '7/1', 'الأربعاء_5': '8/2' } },
  { id: 5, name: 'يوسف مجدي', subject: 'تاريخ', tt: { 'الاثنين_2': '9/1', 'الخميس_4': '10/2' } },
  { id: 6, name: 'ريم أحمد', subject: 'فيزياء', tt: { 'الأحد_5': '11/1', 'الثلاثاء_6': '12/2' } }
];

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    const initial = { teachers: initialTeachers, daily: {}, nextId: 7 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }

  try {
    const parsed = JSON.parse(saved);
    if (!parsed.teachers) parsed.teachers = initialTeachers;
    if (!parsed.daily) parsed.daily = {};
    if (!parsed.nextId) parsed.nextId = 7;
    return parsed;
  } catch {
    const fallback = { teachers: initialTeachers, daily: {}, nextId: 7 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
}

let appData = loadData();
let currentTab = 'daily';
let selectedDate = new Date().toISOString().slice(0, 10);
let selectedTeacherId = appData.teachers[0]?.id || 1;

const els = {
  selectedDate: document.getElementById('selectedDate'),
  absentCount: document.getElementById('absentCount'),
  needCount: document.getElementById('needCount'),
  dailyTableBody: document.getElementById('dailyTableBody'),
  absentList: document.getElementById('absentList'),
  exemptList: document.getElementById('exemptList'),
  teacherSelect: document.getElementById('teacherSelect'),
  scheduleTableBody: document.getElementById('scheduleTableBody'),
  teachersList: document.getElementById('teachersList'),
  teacherNameInput: document.getElementById('teacherNameInput'),
  teacherSubjectInput: document.getElementById('teacherSubjectInput'),
  monthInput: document.getElementById('monthInput'),
  reportBody: document.getElementById('reportBody'),
  autoDistributeBtn: document.getElementById('autoDistributeBtn'),
  addTeacherBtn: document.getElementById('addTeacherBtn'),
  scanScheduleBtn: document.getElementById('scanScheduleBtn'),
  ocrFileInput: document.getElementById('ocrFileInput'),
  ocrPreview: document.getElementById('ocrPreview'),
  ocrProgress: document.getElementById('ocrProgress'),
  ocrResult: document.getElementById('ocrResult'),
  applyOcrBtn: document.getElementById('applyOcrBtn'),
  saveOcrBtn: document.getElementById('saveOcrBtn')
};

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function getDayName(dateString) {
  const d = new Date(dateString);
  const names = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  return names[d.getDay()];
}

function getDayEntry(date) {
  if (!appData.daily[date]) {
    appData.daily[date] = { absent: [], exempt: [], assign: {} };
  }
  return appData.daily[date];
}

function renderTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    const active = tab.dataset.tab === currentTab;
    tab.classList.toggle('active', active);
  });
  document.querySelectorAll('.panel').forEach(panel => {
    const active = panel.id === `${currentTab}-panel`;
    panel.classList.toggle('active', active);
  });
}

function renderTeacherSelect() {
  els.teacherSelect.innerHTML = appData.teachers.map(t => `
    <option value="${t.id}">${t.name}</option>
  `).join('');
  if (appData.teachers.some(t => t.id === selectedTeacherId)) {
    els.teacherSelect.value = String(selectedTeacherId);
  } else {
    selectedTeacherId = appData.teachers[0]?.id || 1;
    els.teacherSelect.value = String(selectedTeacherId);
  }
}

function renderDaily() {
  const entry = getDayEntry(selectedDate);
  const absentIds = entry.absent || [];
  const exemptIds = entry.exempt || [];

  const dayName = getDayName(selectedDate);
  let need = 0;

  appData.teachers.forEach(teacher => {
    if (!absentIds.includes(teacher.id)) return;
    for (let p = 1; p <= PERIODS; p++) {
      if (teacher.tt && teacher.tt[`${dayName}_${p}`]) need += 1;
    }
  });

  els.absentCount.textContent = absentIds.length;
  els.needCount.textContent = String(need);

  const teacherMap = Object.fromEntries(appData.teachers.map(t => [t.id, t]));
  const rows = [];

  appData.teachers.forEach((teacher, teacherIndex) => {
    if (!absentIds.includes(teacher.id)) return;
    for (let p = 1; p <= PERIODS; p++) {
      const classValue = teacher.tt?.[`${dayName}_${p}`] || '-';
      const assignedId = entry.assign[`${dayName}_${p}`];
      const assignedTeacher = assignedId ? teacherMap[assignedId] : null;
      const load = assignedTeacher ? getTeacherLoad(assignedTeacher, entry) : 0;
      rows.push(`
        <tr>
          <td>${teacherIndex + 1}</td>
          <td>حصة ${p}</td>
          <td>${classValue}</td>
          <td>${teacher.name}</td>
          <td>${assignedTeacher ? assignedTeacher.name : 'لم يوزع'}</td>
          <td>${load}</td>
        </tr>
      `);
    }
  });

  els.dailyTableBody.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="6">لا توجد بيانات لهذا اليوم</td></tr>';

  els.absentList.innerHTML = appData.teachers.map(t => {
    const isAbsent = absentIds.includes(t.id);
    return `
      <div class="list-item">
        <span>${t.name} <small>(${t.subject})</small></span>
        <button class="btn ${isAbsent ? 'danger' : 'outline'}" type="button" data-toggle-absent="${t.id}">
          ${isAbsent ? 'إلغاء غياب' : 'تسجيل غياب'}
        </button>
      </div>
    `;
  }).join('');

  els.exemptList.innerHTML = appData.teachers.map(t => {
    const isExempt = exemptIds.includes(t.id);
    return `
      <div class="list-item">
        <span>${t.name} <small>(${t.subject})</small></span>
        <button class="btn ${isExempt ? 'danger' : 'outline'}" type="button" data-toggle-exempt="${t.id}">
          ${isExempt ? 'إلغاء استثناء' : 'استثناء'}
        </button>
      </div>
    `;
  }).join('');
}

function getTeacherLoad(teacher, entry) {
  const assignedTimes = Object.values(entry.assign).filter(id => id === teacher.id).length;
  const ttCount = teacher.tt ? Object.keys(teacher.tt).length : 0;
  return assignedTimes + ttCount;
}

function renderSchedule() {
  const teacher = appData.teachers.find(t => t.id === Number(selectedTeacherId));
  if (!teacher) return;

  const rows = DAYS.map(day => {
    const cells = [];
    for (let p = 1; p <= PERIODS; p++) {
      const value = teacher.tt?.[`${day}_${p}`] || '';
      cells.push(`
        <td>
          <input type="text" data-day="${day}" data-period="${p}" value="${value}" aria-label="${day} حصة ${p}" />
        </td>
      `);
    }
    return `<tr><td>${day}</td>${cells.join('')}</tr>`;
  }).join('');

  els.scheduleTableBody.innerHTML = rows;
}

function renderTeachersList() {
  els.teachersList.innerHTML = appData.teachers.map(t => `
    <div class="list-item">
      <span>${t.name} <small>(${t.subject})</small></span>
      <button class="btn danger" type="button" data-remove-teacher="${t.id}">حذف</button>
    </div>
  `).join('');
}

function renderReports() {
  const monthValue = els.monthInput.value || new Date().toISOString().slice(0, 7);
  const reportRows = appData.teachers.map(t => ({
    id: t.id,
    name: t.name,
    subject: t.subject,
    absent: 0,
    assigned: 0
  }));

  Object.entries(appData.daily).forEach(([date, entry]) => {
    if (!date.startsWith(monthValue)) return;

    (entry.absent || []).forEach(id => {
      const row = reportRows.find(r => r.id === id);
      if (row) row.absent += 1;
    });

    Object.values(entry.assign || {}).forEach(id => {
      const row = reportRows.find(r => r.id === id);
      if (row) row.assigned += 1;
    });
  });

  els.reportBody.innerHTML = reportRows.sort((a, b) => b.assigned - a.assigned).map(row => `
    <tr>
      <td>${row.name}</td>
      <td>${row.subject}</td>
      <td>${row.absent}</td>
      <td>${row.assigned}</td>
    </tr>
  `).join('');
}

function refreshAll() {
  renderTabs();
  renderTeacherSelect();
  renderDaily();
  renderSchedule();
  renderTeachersList();
  renderReports();
}

function toggleAbsent(id) {
  const entry = getDayEntry(selectedDate);
  if (entry.absent.includes(id)) {
    entry.absent = entry.absent.filter(item => item !== id);
  } else {
    entry.absent.push(id);
  }
  saveData();
  refreshAll();
}

function toggleExempt(id) {
  const entry = getDayEntry(selectedDate);
  if (entry.exempt.includes(id)) {
    entry.exempt = entry.exempt.filter(item => item !== id);
  } else {
    entry.exempt.push(id);
  }
  saveData();
  refreshAll();
}

function addTeacher() {
  const name = els.teacherNameInput.value.trim();
  const subject = els.teacherSubjectInput.value.trim() || 'غير محدد';
  if (!name) return;

  const newTeacher = {
    id: appData.nextId,
    name,
    subject,
    tt: {}
  };
  appData.teachers.push(newTeacher);
  appData.nextId += 1;
  selectedTeacherId = newTeacher.id;
  els.teacherNameInput.value = '';
  els.teacherSubjectInput.value = '';
  saveData();
  refreshAll();
}

function removeTeacher(id) {
  const confirmDelete = confirm('هل أنت متأكد من حذف المدرس؟');
  if (!confirmDelete) return;

  appData.teachers = appData.teachers.filter(t => t.id !== id);
  Object.keys(appData.daily).forEach(date => {
    const entry = appData.daily[date];
    entry.absent = (entry.absent || []).filter(item => item !== id);
    entry.exempt = (entry.exempt || []).filter(item => item !== id);
    const nextAssign = {};
    Object.entries(entry.assign || {}).forEach(([k, value]) => {
      if (value !== id) nextAssign[k] = value;
    });
    entry.assign = nextAssign;
  });

  if (selectedTeacherId === id) {
    selectedTeacherId = appData.teachers[0]?.id || 1;
  }

  saveData();
  refreshAll();
}

function autoDistribute() {
  const entry = getDayEntry(selectedDate);
  const dayName = getDayName(selectedDate);
  const absentIds = new Set(entry.absent || []);
  const exemptIds = new Set(entry.exempt || []);
  const assignments = { ...entry.assign };

  const loadMap = {};
  appData.teachers.forEach(teacher => {
    const assignedCount = Object.values(assignments).filter(id => id === teacher.id).length;
    const ttCount = teacher.tt ? Object.keys(teacher.tt).length : 0;
    loadMap[teacher.id] = assignedCount + ttCount;
  });

  appData.teachers.forEach(teacher => {
    if (!absentIds.has(teacher.id)) return;
    for (let p = 1; p <= PERIODS; p++) {
      const key = `${dayName}_${p}`;
      if (!teacher.tt || !teacher.tt[key]) continue;

      const eligible = appData.teachers.filter(t => {
        if (t.id === teacher.id) return false;
        if (absentIds.has(t.id)) return false;
        if (exemptIds.has(t.id)) return false;
        if (loadMap[t.id] >= MAX_LOAD) return false;
        return true;
      });

      if (!eligible.length) continue;

      const best = eligible.sort((a, b) => loadMap[a.id] - loadMap[b.id])[0];
      assignments[key] = best.id;
      loadMap[best.id] += 1;
    }
  });

  entry.assign = assignments;
  saveData();
  refreshAll();
}

// OCR Functions
function normalizeOcrText(rawText) {
  return rawText
    .replace(/\r/g, '\n')
    .replace(/\|/g, ' ')
    .replace(/[—–]/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelyTeacherName(line) {
  const cleaned = line.replace(/[^\u0600-\u06FF\s]/g, '').trim();
  if (!cleaned) return false;
  if (cleaned.length < 3 || cleaned.length > 40) return false;
  if (/\d/.test(cleaned)) return false;
  if (!/[أ-ي]/.test(cleaned)) return false;
  return true;
}

function extractTeacherBlocks(rawText) {
  const normalized = normalizeOcrText(rawText);
  const lines = normalized.split('\n').map(line => line.trim()).filter(Boolean);

  const blocks = [];
  let current = null;

  for (const line of lines) {
    if (isLikelyTeacherName(line)) {
      if (current) blocks.push(current);
      current = { name: line, schedule: [] };
      continue;
    }

    if (current) {
      const cleaned = line.replace(/[|]/g, ' ').trim();
      if (!cleaned) continue;

      const hasData =
        /(\d+\/\d+|Sec\d+|[0-9]+)/i.test(cleaned) ||
        /(\d+\s*\/\s*\d+)/.test(cleaned);

      if (hasData) {
        current.schedule.push(cleaned);
      }
    }
  }

  if (current) blocks.push(current);

  return blocks.filter(block => block.name && block.schedule.length);
}

function buildTeacherFromText(rawText) {
  const blocks = extractTeacherBlocks(rawText);

  if (!blocks.length) {
    return null;
  }

  const teacherData = blocks.map(block => {
    const name = block.name.replace(/[^\u0600-\u06FF\s]/g, '').trim();
    const scheduleText = block.schedule.join(' ');
    return {
      name,
      scheduleText
    };
  });

  return teacherData;
}

function formatOcrResultForReview() {
  const text = els.ocrResult.value.trim();
  if (!text) {
    alert('لا توجد بيانات لعرضها');
    return;
  }

  const parsed = buildTeacherFromText(text);

  if (!parsed || !parsed.length) {
    alert('تم قراءة النص. يمكنك تعديله يدويًا قبل الحفظ.');
    return;
  }

  let output = '=== بيانات المعلمين المستخرجة من الصورة ===\n\n';

  parsed.forEach((item, index) => {
    output += `المعلم ${index + 1}: ${item.name}\n`;
    output += `الحصص: ${item.scheduleText}\n`;
    output += '---\n\n';
  });

  output += '=== تعليمات ===\n';
  output += 'تحقق من البيانات أعلاه.\n';
  output += 'يمكنك تعديل أي اسم أو بيانات حصص.\n';
  output += 'ثم اضغط "حفظ البيانات المعدلة" لإضافتهم للتطبيق.\n';

  els.ocrResult.value = output;

  alert('✅ تمت معالجة النص. يمكنك الآن تعديل أي بيانات قبل الحفظ.');
}

function saveFinalTeacherData() {
  const raw = els.ocrResult.value.trim();
  if (!raw) {
    alert('لا توجد بيانات للحفظ');
    return;
  }

  // استخراج الأسماء من السطور التي تبدأ بـ "المعلم"
  const lines = raw.split('\n');
  const teachersToAdd = [];
  let currentTeacher = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('المعلم')) {
      if (currentTeacher) teachersToAdd.push(currentTeacher);
      const match = trimmed.match(/المعلم\s*\d+:\s*(.+)/);
      if (match && match[1]) {
        currentTeacher = {
          name: match[1].trim(),
          scheduleData: []
        };
      }
      continue;
    }

    if (trimmed === '---' || trimmed.startsWith('===')) {
      continue;
    }

    if (currentTeacher && trimmed.startsWith('الحصص:')) {
      const scheduleText = trimmed.replace('الحصص:', '').trim();
      currentTeacher.scheduleData = scheduleText.split(/\s+/).filter(Boolean);
      continue;
    }

    if (currentTeacher && /[^\s]/.test(trimmed) && !trimmed.startsWith('المعلم') && !trimmed.startsWith('الحصص')) {
      // أي سطر آخر قد يحتوي على بيانات إضافية
      if (!/^[=\-]/.test(trimmed)) {
        currentTeacher.scheduleData.push(...trimmed.split(/\s+/).filter(Boolean));
      }
    }
  }

  if (currentTeacher) teachersToAdd.push(currentTeacher);

  if (teachersToAdd.length === 0) {
    alert('لم يتم استخراج أي معلمين. تأكد من الصيغة الصحيحة.');
    return;
  }

  let addedCount = 0;

  teachersToAdd.forEach(item => {
    if (!item.name) return;

    const existing = appData.teachers.find(
      t => t.name.toLowerCase().includes(item.name.toLowerCase()) ||
           item.name.toLowerCase().includes(t.name.toLowerCase())
    );

    const parsedSchedule = {};
    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

    item.scheduleData.forEach((data, index) => {
      const day = dayNames[index % dayNames.length];
      const period = (Math.floor(index / dayNames.length)) + 1;

      if (period <= PERIODS && data) {
        parsedSchedule[`${day}_${period}`] = data;
      }
    });

    if (existing) {
      existing.tt = { ...existing.tt, ...parsedSchedule };
      addedCount++;
    } else {
      appData.teachers.push({
        id: appData.nextId,
        name: item.name,
        subject: 'غير محدد',
        tt: parsedSchedule
      });
      appData.nextId += 1;
      addedCount++;
    }
  });

  saveData();
  refreshAll();

  els.ocrResult.value = '';
  els.ocrPreview.src = '';
  els.ocrPreview.style.display = 'none';
  els.ocrProgress.textContent = 'في انتظار الصورة...';

  alert(`✅ تم حفظ ${addedCount} معلم/معلمين بنجاح!`);
}

async function handleOcrUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const previewUrl = URL.createObjectURL(file);
  els.ocrPreview.src = previewUrl;
  els.ocrPreview.style.display = 'block';
  els.ocrProgress.textContent = 'جارٍ قراءة الجدول...';
  els.ocrResult.value = '';

  try {
    if (!window.Tesseract) {
      throw new Error('مكتبة OCR غير متاحة');
    }

    const result = await Tesseract.recognize(file, 'ara+eng', {
      logger: info => {
        if (info.status && info.progress) {
          els.ocrProgress.textContent = `جارٍ القراءة: ${Math.round(info.progress * 100)}%`;
        }
      }
    });

    const text = result.data.text || '';
    els.ocrResult.value = text;
    els.ocrProgress.textContent = '✅ تمت القراءة بنجاح - اضغط "تنسيق البيانات" للمراجعة';
  } catch (error) {
    els.ocrProgress.textContent = 'فشل في القراءة. جرّب صورة أوضح.';
    console.error(error);
  }
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentTab = tab.dataset.tab;
      refreshAll();
    });
  });

  els.selectedDate.value = selectedDate;
  els.selectedDate.addEventListener('change', e => {
    selectedDate = e.target.value;
    refreshAll();
  });

  els.teacherSelect.addEventListener('change', e => {
    selectedTeacherId = Number(e.target.value);
    renderSchedule();
  });

  els.autoDistributeBtn.addEventListener('click', autoDistribute);
  els.addTeacherBtn.addEventListener('click', addTeacher);
  els.monthInput.value = new Date().toISOString().slice(0, 7);
  els.monthInput.addEventListener('change', renderReports);

  els.scanScheduleBtn.addEventListener('click', () => els.ocrFileInput.click());
  els.ocrFileInput.addEventListener('change', handleOcrUpload);
  els.applyOcrBtn.addEventListener('click', formatOcrResultForReview);
  if (els.saveOcrBtn) {
    els.saveOcrBtn.addEventListener('click', saveFinalTeacherData);
  }

  document.addEventListener('click', e => {
    const absentBtn = e.target.closest('[data-toggle-absent]');
    if (absentBtn) {
      toggleAbsent(Number(absentBtn.dataset.toggleAbsent));
      return;
    }

    const exemptBtn = e.target.closest('[data-toggle-exempt]');
    if (exemptBtn) {
      toggleExempt(Number(exemptBtn.dataset.toggleExempt));
      return;
    }

    const removeBtn = e.target.closest('[data-remove-teacher]');
    if (removeBtn) {
      removeTeacher(Number(removeBtn.dataset.removeTeacher));
      return;
    }
  });

  document.addEventListener('input', e => {
    if (!(e.target instanceof HTMLInputElement)) return;
    const day = e.target.dataset.day;
    const period = e.target.dataset.period;
    if (!day || !period) return;

    const teacher = appData.teachers.find(t => t.id === selectedTeacherId);
    if (!teacher) return;

    if (!teacher.tt) teacher.tt = {};
    const key = `${day}_${period}`;
    const value = e.target.value.trim();
    if (value) {
      teacher.tt[key] = value;
    } else {
      delete teacher.tt[key];
    }
    saveData();
    renderDaily();
    renderReports();
  });
}

bindEvents();
refreshAll();
