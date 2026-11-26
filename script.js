document.addEventListener('DOMContentLoaded', () => {
    // --- 요소 ---
    const $ = id => document.getElementById(id);
    const root = document.documentElement;
    const clock = $('clock');
    const timeLeftDisplay = $('timeLeft');
    const statusText = $('statusText');
    const startAt = $('startAt');
    const endAt = $('endAt');
    const barFill = $('barFill');
    const timeInput = $('timeInput');
    const minutesBox = timeInput.closest('.minutes');
    const startBtn = $('startBtn');
    const resetBtn = $('resetBtn');
    const fullscreenBtn = $('fullscreenBtn');
    const resetNoticeBtn = $('resetNoticeBtn');
    const noticeBody = $('noticeBody');
    const noticeInner = $('noticeInner');
    const subjectBtn = $('subjectBtn');
    const subjectMenu = $('subjectMenu');
    const weekBtn = $('weekBtn');
    const weekMenu = $('weekMenu');
    const totalWeek = $('totalWeek');
    const examSubjectBtn = $('examSubjectBtn');
    const examSubjectMenu = $('examSubjectMenu');
    const examWeekBtn = $('examWeekBtn');
    const examWeekMenu = $('examWeekMenu');
    const examStartBtn = $('examStartBtn');
    const examStartMenu = $('examStartMenu');
    const examEnd = $('examEnd');
    const materialsBox = $('materials');
    const specialNotesField = $('specialNotes');
    const minutesField = document.querySelector('[data-field="examMinutes"]');

    // ─────────────────────────────────────────────
    // 안내: 과목·주차·시험명·시작 시각·배부 자료의 정해진 항목은 고르고, 나머지는 글자를 눌러 고친다.
    //       바꾼 내용은 이 브라우저에 저장된다. 오른쪽 타이머와는 서로 영향을 주지 않는다.
    // ─────────────────────────────────────────────
    const STORAGE_KEY = 'timer_notice_v10';

    // count: 그 과목의 주차(회차) 수, before: 그 과목 앞까지 지난 주차 수(누적 주차용). 특강은 누적 주차가 없다.
    const SUBJECTS = [
        { name: '대수', color: '#b13e7c', unit: '주차', count: 8, before: 0 },
        { name: '미적분Ⅰ', color: '#1990c8', unit: '주차', count: 8, before: 8 },
        { name: '확률과 통계', color: '#5a4f98', unit: '주차', count: 7, before: 16 },
        { name: '확률과 통계 특강', color: '#5a4f98', unit: '회차', count: 8, before: null },
    ];
    const TOTAL_WEEKS = 8 + 8 + 7;

    // 배부 자료의 항목 종류
    const MATERIAL_TYPES = [
        ['algorithm', 'ALGORITHM'],             // ALGORITHM (과목) (상/중/하)
        ['deep', 'DEEP LEARNING'],              // DEEP LEARNING (과목) (n주차)
        ['mock', '이동선 모의고사 α'],          // 이동선 모의고사 α (n회)
        ['guide', '수업 안내서'],               // 정해진 문구 한 줄(더한 뒤에는 직접 입력 줄과 같다)
        ['text', '직접 입력'],                  // 그 밖의 자료
    ];
    const LEVELS = ['상', '중', '하'];

    // 처음 문구(초기화하면 여기로 돌아온다)
    const DEFAULT_CHOICES = {
        subject: '대수',        // 수업 과목
        week: 2,                // 수업 주차
        examSubject: '대수',    // 시험 과목
        examWeek: 1,            // 시험 주차
        startMin: 18 * 60,      // 시험 시작 시각(자정부터 분) = 오후 6:00
        specialNotes: '',
    };
    const DEFAULT_MATERIALS = [
        { type: 'text', text: '수업 안내서' },
        { type: 'mock', round: '1' },
    ];
    const defaultMinutes = minutesField.textContent;
    let choice;

    const infoOf = name => SUBJECTS.find(item => item.name === name) || SUBJECTS[0];
    const clamp = (value, low, high) => Math.min(high, Math.max(low, parseInt(value, 10) || low));

    function fieldText(el) {
        return el.innerText.replace(/\u00a0/g, ' ').replace(/\s+$/, '');
    }

    function make(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }

    // 12시간제 시각(예: 오후 1:05). 13시처럼 쓰지 않는다.
    function formatMinutes(total) {
        const minutes = ((total % 1440) + 1440) % 1440;
        const hour24 = Math.floor(minutes / 60);
        const half = hour24 >= 12 ? '오후' : '오전';
        return `${half} ${hour24 % 12 || 12}:${String(minutes % 60).padStart(2, '0')}`;
    }

    // --- 고르는 메뉴(.pick = 단추 + 메뉴). 나중에 만들어지는 줄의 메뉴도 같이 다룬다 ---
    function closeMenus(except) {
        document.querySelectorAll('.pick-menu').forEach(menu => {
            if (menu === except) return;
            menu.hidden = true;
            menu.parentElement.querySelector(':scope > button').setAttribute('aria-expanded', 'false');
        });
    }

    document.addEventListener('click', e => {
        const button = e.target.closest('.pick > button');
        if (!button) return;
        const menu = button.parentElement.querySelector(':scope > .pick-menu');
        const open = menu.hidden;
        closeMenus(menu);
        menu.hidden = !open;
        button.setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('pointerdown', e => {
        if (!e.target.closest('.pick')) closeMenus();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeMenus();
    });

    function makeOption(label, selected, onPick, keepOpen) {
        const option = document.createElement('button');
        option.type = 'button';
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', String(selected));
        option.textContent = label;
        option.addEventListener('click', () => {
            onPick();
            if (!keepOpen) closeMenus();
            renderNotice();
            renderMaterials();
            saveNotice();
        });
        return option;
    }

    // 단추 + 메뉴 한 벌을 만든다. options: [{ label, selected, color, onPick }]
    function makePick(label, buttonClass, options, menuClass) {
        const pick = make('span', 'pick');
        const button = make('button', buttonClass, label);
        button.type = 'button';
        button.setAttribute('aria-haspopup', 'listbox');
        button.setAttribute('aria-expanded', 'false');
        const menu = make('span', `pick-menu ${menuClass || ''}`.trim());
        menu.setAttribute('role', 'listbox');
        menu.hidden = true;
        menu.append(...options.map(item => {
            const option = makeOption(item.label, Boolean(item.selected), item.onPick);
            if (item.color) option.style.color = item.color;
            return option;
        }));
        pick.append(button, menu);
        return pick;
    }

    // 글자를 눌러 고치는 칸. single: 한 줄, digits: 숫자만
    function makeEditable(el, { single, digits, onInput }) {
        el.spellcheck = false;
        el.contentEditable = 'plaintext-only';
        if (el.contentEditable !== 'plaintext-only') {
            // 서식 없는 편집을 지원하지 않는 브라우저: 붙여넣기만 글자로 바꾼다
            el.contentEditable = 'true';
            el.addEventListener('paste', e => {
                e.preventDefault();
                const text = (e.clipboardData || window.clipboardData).getData('text');
                document.execCommand('insertText', false, text);
            });
        }
        el.addEventListener('keydown', e => {
            if (e.key === 'Enter' && single) {
                e.preventDefault();
                el.blur();
            }
        });
        el.addEventListener('input', () => {
            let text = fieldText(el);
            if (text === '') el.textContent = '';   // 빈칸 안내가 보이게 남은 줄바꿈을 지운다
            if (digits) {
                const only = text.replace(/\D/g, '').slice(0, 3);
                if (only !== text) {
                    el.textContent = only;
                    caretToEnd(el);
                    text = only;
                }
            }
            onInput(text);
        });
    }

    function caretToEnd(el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    function fillSubjects(menu, selected, onPick) {
        menu.replaceChildren(...SUBJECTS.map(item => {
            const option = makeOption(item.name, item.name === selected, () => onPick(item.name));
            option.style.color = item.color;
            return option;
        }));
    }

    function fillWeeks(menu, info, selected, onPick) {
        const options = [];
        for (let n = 1; n <= info.count; n++) {
            options.push(makeOption(`${n}${info.unit}`, n === selected, () => onPick(n)));
        }
        menu.replaceChildren(...options);
    }

    // 시각 고르기: 오전·오후 / 시 / 분(5분 단위 단추 + 1분 단위 직접 입력).
    // 세 가지를 차례로 고를 수 있게 눌러도 닫히지 않는다.
    function timeParts() {
        const hour24 = Math.floor(choice.startMin / 60);
        return { afternoon: hour24 >= 12, hour12: hour24 % 12 || 12, minute: choice.startMin % 60 };
    }

    function setTime(afternoon, hour12, minute) {
        choice.startMin = ((hour12 % 12) + (afternoon ? 12 : 0)) * 60 + minute;
    }

    function fillTime(menu) {
        const { afternoon, hour12, minute } = timeParts();

        // 분을 직접 적는 중에는 메뉴를 다시 만들지 않고 고른 표시만 고친다(입력 칸이 사라지지 않게)
        const typing = menu.querySelector('input');
        if (typing && typing === document.activeElement) {
            menu.querySelectorAll('button[data-minute]').forEach(option => {
                option.setAttribute('aria-selected', String(Number(option.dataset.minute) === minute));
            });
            return;
        }

        const group = (...children) => {
            const el = document.createElement('span');
            el.className = 'time-group';
            el.append(...children);
            return el;
        };
        const halves = ['오전', '오후'].map((label, i) =>
            makeOption(label, afternoon === (i === 1), () => setTime(i === 1, hour12, minute), true));
        const hours = [];
        for (let h = 1; h <= 12; h++) {
            hours.push(makeOption(`${h}시`, h === hour12, () => setTime(afternoon, h, minute), true));
        }
        const minutes = [];
        for (let m = 0; m < 60; m += 5) {
            const option = makeOption(`${String(m).padStart(2, '0')}분`, m === minute,
                () => setTime(afternoon, hour12, m), true);
            option.dataset.minute = m;
            minutes.push(option);
        }

        // 1분 단위 직접 입력
        const exact = document.createElement('label');
        exact.className = 'time-exact';
        const input = document.createElement('input');
        input.type = 'number';
        input.min = 0;
        input.max = 59;
        input.inputMode = 'numeric';
        input.value = minute;
        input.setAttribute('aria-label', '분 직접 입력');
        input.addEventListener('input', () => {
            const value = Math.min(59, Math.max(0, parseInt(input.value, 10) || 0));
            const now = timeParts();
            setTime(now.afternoon, now.hour12, value);
            renderNotice();
            saveNotice();
        });
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') closeMenus();
        });
        exact.append('직접 입력', input, '분');

        menu.replaceChildren(group(...halves), group(...hours), group(...minutes), exact);
    }

    // 고른 값 → 화면
    function renderNotice() {
        const lesson = infoOf(choice.subject);
        const exam = infoOf(choice.examSubject);
        choice.subject = lesson.name;
        choice.examSubject = exam.name;
        choice.week = clamp(choice.week, 1, lesson.count);
        choice.examWeek = clamp(choice.examWeek, 1, exam.count);
        choice.startMin = clamp(choice.startMin, 0, 1439);

        // 제목 아래 줄: 과목 · 주차 · 누적 주차
        root.dataset.subject = lesson.name;
        subjectBtn.textContent = lesson.name;
        weekBtn.textContent = `${choice.week}${lesson.unit}`;
        weekBtn.title = `${lesson.unit} 고르기`;
        // 누적 주차: 예) 미적분Ⅰ 2주차 → 10주차/23주차. 특강은 적지 않는다.
        totalWeek.textContent = lesson.before === null ? '' : `${lesson.before + choice.week}주차/${TOTAL_WEEKS}주차`;

        // 시험명: 과목 n주차 TEST (특강은 '확률과 통계 n회차 TEST')
        examSubjectBtn.textContent = exam.name.replace(/ 특강$/, '');
        examSubjectBtn.style.color = exam.color;   // 과목 이름만 과목색. 주차와 TEST는 검정 가는 글자다
        examWeekBtn.textContent = `${choice.examWeek}${exam.unit}`;
        examWeekBtn.title = `시험 ${exam.unit} 고르기`;

        // 시험 시간: 시작 시각 ~ (시작 + 분)
        const minutes = parseInt(fieldText(minutesField), 10);
        examStartBtn.textContent = formatMinutes(choice.startMin);
        examEnd.textContent = minutes > 0 ? formatMinutes(choice.startMin + minutes) : '—';

        fillSubjects(subjectMenu, lesson.name, name => {
            choice.subject = name;
            choice.examSubject = name;   // 수업 과목을 바꾸면 시험 과목도 따라간다(시험 과목은 따로 바꿀 수 있다)
        });
        fillWeeks(weekMenu, lesson, choice.week, n => { choice.week = n; });
        fillSubjects(examSubjectMenu, exam.name, name => { choice.examSubject = name; });
        fillWeeks(examWeekMenu, exam, choice.examWeek, n => { choice.examWeek = n; });
        fillTime(examStartMenu);

        fitNotice();
    }

    // --- 배부 자료 ---
    function newMaterial(type) {
        const subject = infoOf(choice.subject).name;
        if (type === 'algorithm') return { type, subject, level: LEVELS[0] };
        if (type === 'deep') return { type, subject, week: clamp(choice.week, 1, infoOf(subject).count) };
        if (type === 'mock') return { type, round: '1' };
        if (type === 'guide') return { type: 'text', text: '수업 안내서' };
        return { type: 'text', text: '' };
    }

    // 이전에 저장한 시험 전·후 자료는 표시 순서대로 합친다.
    function cleanMaterials(saved) {
        const list = Array.isArray(saved) ? saved : [
            ...(Array.isArray(saved?.examBefore) ? saved.examBefore : []),
            ...(Array.isArray(saved?.classBefore) ? saved.classBefore : DEFAULT_MATERIALS),
        ];
        return list.filter(item => item && MATERIAL_TYPES.some(([type]) => type === item.type)).map(item => {
            const subject = infoOf(item.subject).name;
            if (item.type === 'algorithm') {
                return { type: 'algorithm', subject, level: LEVELS.includes(item.level) ? item.level : LEVELS[0] };
            }
            if (item.type === 'deep') return { type: 'deep', subject, week: clamp(item.week, 1, infoOf(subject).count) };
            if (item.type === 'mock') return { type: 'mock', round: String(item.round ?? '').replace(/\D/g, '') };
            return { type: 'text', text: String(item.text ?? '') };
        });
    }

    let focusItem = null;   // 방금 더한 '직접 입력' 줄(그린 뒤 바로 적을 수 있게)

    function materialLine(list, item) {
        const line = make('div', 'item fixed');
        const remove = make('button', 'item-remove', '×');
        remove.type = 'button';
        remove.title = '이 줄 빼기';
        remove.setAttribute('aria-label', '이 줄 빼기');
        const drop = () => {
            const index = list.indexOf(item);
            if (index < 0) return;
            list.splice(index, 1);
            renderMaterials();
            saveNotice();
        };
        remove.addEventListener('click', drop);

        if (item.type === 'text') {
            const text = make('span', 'item-text', item.text);
            text.dataset.field = 'material';
            text.dataset.placeholder = '직접 입력';
            makeEditable(text, {
                single: true,
                onInput: value => {
                    item.text = value;
                    fitNotice();
                    saveNotice();
                },
            });
            text.addEventListener('blur', () => { if (!item.text.trim()) drop(); });   // 빈 줄은 남기지 않는다
            if (item === focusItem) setTimeout(() => text.focus());
            line.append(text, remove);
            return line;
        }

        if (item.type === 'mock') {
            const brand = make('span', 'brand');
            brand.append('이동선 모의고사 ', make('i', 'alpha', 'α'));
            const round = make('span', '', item.round);
            round.dataset.field = 'round';
            round.dataset.placeholder = 'n';
            makeEditable(round, {
                single: true,
                digits: true,
                onInput: value => {
                    item.round = value;
                    saveNotice();
                },
            });
            const tail = make('span', 'thin');
            tail.append(round, '회');
            line.append(brand, tail, remove);
            return line;
        }

        // ALGORITHM (과목) (상/중/하) · DEEP LEARNING (과목) (n주차, 특강은 n회차)
        const info = infoOf(item.subject);
        line.append(make('span', 'brand', item.type === 'algorithm' ? 'ALGORITHM' : 'DEEP LEARNING'));
        const subjectPick = makePick(info.name, 'subj', SUBJECTS.map(subject => ({
            label: subject.name,
            selected: subject.name === info.name,
            color: subject.color,
            onPick: () => {
                item.subject = subject.name;
                if (item.type === 'deep') item.week = clamp(item.week, 1, subject.count);
            },
        })));
        subjectPick.querySelector('button').style.color = info.color;
        line.append(subjectPick);
        if (item.type === 'algorithm') {
            line.append(makePick(item.level, 'thin', LEVELS.map(level => ({
                label: level,
                selected: level === item.level,
                onPick: () => { item.level = level; },
            }))));
        } else {
            const weeks = [];
            for (let n = 1; n <= info.count; n++) {
                weeks.push({ label: `${n}${info.unit}`, selected: n === item.week, onPick: () => { item.week = n; } });
            }
            line.append(makePick(`${item.week}${info.unit}`, 'thin', weeks, 'week-menu'));
        }
        line.append(remove);
        return line;
    }

    function renderMaterials() {
        const list = choice.materials;
        const value = make('div', 'row-value items');
        value.append(...list.map(item => materialLine(list, item)));
        const add = makePick('+', '', MATERIAL_TYPES.map(([type, label]) => ({
            label,
            onPick: () => {
                const item = newMaterial(type);
                list.push(item);
                focusItem = type === 'text' ? item : null;   // 빈 직접 입력 줄만 바로 적게 한다
            },
        })));
        add.classList.add('add');
        const addButton = add.querySelector('button');
        addButton.title = '배부 자료 더하기';
        addButton.setAttribute('aria-label', addButton.title);
        materialsBox.replaceChildren(value, add);
        focusItem = null;
        fitNotice();
    }

    // 제목 줄 아래 내용이 남은 높이보다 길면 그 내용의 글자와 간격을 함께 줄여 한 화면에 담는다
    function fitNotice() {
        const style = getComputedStyle(noticeBody);
        const available = noticeBody.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
        const fits = fit => {
            noticeInner.style.setProperty('--fit', fit.toFixed(4));
            return noticeInner.offsetHeight <= available + 0.5;
        };
        if (fits(1)) return;
        let lo = 0.4, hi = 1;          // 들어가는 가장 큰 배율을 찾는다
        for (let i = 0; i < 8; i++) {
            const mid = (lo + hi) / 2;
            if (fits(mid)) lo = mid;
            else hi = mid;
        }
        fits(lo);
    }

    function loadNotice() {
        let saved = {};
        try {
            saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        } catch (e) {
            saved = {};
        }
        minutesField.textContent = typeof saved.examMinutes === 'string' ? saved.examMinutes : defaultMinutes;
        choice = { ...DEFAULT_CHOICES };
        Object.keys(DEFAULT_CHOICES).forEach(key => {
            if (typeof saved[key] === typeof DEFAULT_CHOICES[key]) choice[key] = saved[key];
        });
        choice.materials = cleanMaterials(saved.materials);
        if (specialNotesField) specialNotesField.textContent = choice.specialNotes;
        renderNotice();
        renderMaterials();
    }

    function saveNotice() {
        const data = { ...choice, examMinutes: fieldText(minutesField) };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.log('안내 문구를 저장하지 못했습니다.', e);
        }
    }

    makeEditable(minutesField, {
        single: true,
        digits: true,
        onInput: () => {
            renderNotice();
            saveNotice();
        },
    });

    if (specialNotesField) {
        makeEditable(specialNotesField, {
            onInput: value => {
                choice.specialNotes = value;
                fitNotice();
                saveNotice();
            },
        });
    }

    resetNoticeBtn.addEventListener('click', () => {
        if (!confirm('안내 문구를 처음 문구로 되돌리시겠습니까?')) return;
        minutesField.textContent = defaultMinutes;
        choice = { ...DEFAULT_CHOICES, materials: cleanMaterials() };
        if (specialNotesField) specialNotesField.textContent = choice.specialNotes;
        renderNotice();
        renderMaterials();
        saveNotice();
    });

    loadNotice();
    window.addEventListener('resize', fitNotice);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitNotice);

    // ─────────────────────────────────────────────
    // 타이머
    // ─────────────────────────────────────────────
    let state = 'idle';       // idle | running | paused | done
    let totalMs = 0;          // 설정한 전체 시간
    let remainingMs = 0;      // 멈춰 있을 때의 남은 시간
    let deadline = 0;         // 진행 중일 때 끝나는 시각(ms)
    let startedAt = null;     // 처음 시작한 시각

    function formatClock(date) {
        return formatMinutes(date.getHours() * 60 + date.getMinutes());
    }

    function formatTime(ms) {
        const seconds = Math.max(0, Math.ceil(ms / 1000));
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function inputMs() {
        const minutes = parseInt(timeInput.value, 10);
        return minutes > 0 ? minutes * 60 * 1000 : 0;
    }

    function setState(next) {
        state = next;
        root.classList.toggle('is-running', state === 'running');
        root.classList.toggle('is-paused', state === 'paused');
        root.classList.toggle('is-done', state === 'done');
        statusText.textContent = {
            idle: '시작 전',
            running: '진행 중',
            paused: '일시정지',
            done: '시간 종료',
        }[state];
        startBtn.textContent = { idle: '시작', running: '일시정지', paused: '계속', done: '시작' }[state];
    }

    function render() {
        const now = Date.now();
        clock.textContent = formatClock(new Date(now));

        let left = remainingMs;
        if (state === 'running') left = Math.max(0, deadline - now);
        if (state === 'idle') left = inputMs();   // 시작 전에는 입력한 시간을 미리 보여 준다

        const text = formatTime(left);
        timeLeftDisplay.textContent = text;
        timeLeftDisplay.classList.toggle('long', text.length > 5);

        const elapsed = state === 'idle' || !totalMs ? 0 : 1 - left / totalMs;
        barFill.style.width = `${Math.min(1, Math.max(0, elapsed)) * 100}%`;

        if (state === 'idle') {
            startAt.textContent = '';
            endAt.textContent = '';
        } else {
            startAt.textContent = formatClock(startedAt);
            // 멈춰 있는 동안은 '지금 다시 시작하면 끝나는 시각'
            endAt.textContent = formatClock(new Date(state === 'paused' ? now + left : deadline));
        }

        if (state === 'running' && left <= 0) timerComplete();
    }

    function timerComplete() {
        remainingMs = 0;
        setState('done');
        render();
    }

    function startTimer() {
        if (state === 'idle' || state === 'done') {
            const ms = inputMs();
            if (!ms) {
                minutesBox.classList.add('invalid');
                timeInput.focus();
                return;
            }
            totalMs = ms;
            remainingMs = ms;
            startedAt = new Date();
        }
        timeInput.blur();
        deadline = Date.now() + remainingMs;
        setState('running');
        render();
    }

    function pauseTimer() {
        remainingMs = Math.max(0, deadline - Date.now());
        setState('paused');
        render();
    }

    function toggleTimer() {
        if (state === 'running') pauseTimer();
        else startTimer();
    }

    function resetTimer() {
        timeInput.value = '';
        totalMs = 0;
        remainingMs = 0;
        startedAt = null;
        minutesBox.classList.remove('invalid');
        setState('idle');
        render();
    }

    // --- 이벤트 ---
    startBtn.addEventListener('click', toggleTimer);
    resetBtn.addEventListener('click', resetTimer);

    timeInput.addEventListener('input', () => {
        minutesBox.classList.remove('invalid');
        render();
    });

    timeInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && (state === 'idle' || state === 'done')) startTimer();
    });

    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log(`전체 화면으로 바꾸지 못했습니다: ${err.message}`);
            });
        } else if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    });

    setState('idle');
    render();
    setInterval(render, 200);
});
