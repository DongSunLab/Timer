document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const circle = document.querySelector('.progress-ring__circle');
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    const timeLeftDisplay = document.getElementById('timeLeft');
    const statusText = document.getElementById('statusText');
    const timeInput = document.getElementById('timeInput');
    const startBtn = document.getElementById('startBtn');
    const resetBtn = document.getElementById('resetBtn');
    const noticeBoard = document.getElementById('noticeBoard');

    // --- State ---
    let timerInterval = null;
    let totalTime = 0;
    let remainingTime = 0;
    let isRunning = false;

    // --- Initialization ---
    // Set up SVG circle
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = 0; // Full circle initially (wait for start) or empty?
    // Let's make it full initially or empty.
    // Usually timers start full and deplete.
    circle.style.strokeDashoffset = 0;

    // Load notices from localStorage
    const savedNotices = localStorage.getItem('timer_notices_v8');
    if (savedNotices) {
        noticeBoard.innerHTML = savedNotices;
    }

    // --- Functions ---

    function setProgress(percent) {
        const offset = circumference - (percent / 100) * circumference;
        circle.style.strokeDashoffset = offset;
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function updateCurrentTime() {
        const now = new Date();
        // hour12: true for AM/PM, remove 'second' to show only up to minutes
        const timeString = now.toLocaleTimeString('ko-KR', { hour12: true, hour: 'numeric', minute: '2-digit' });
        statusText.textContent = `현재 시각 ${timeString}`;
    }

    function updateDisplay() {
        timeLeftDisplay.textContent = formatTime(remainingTime);
        const percent = (remainingTime / totalTime) * 100;
        setProgress(percent);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        isRunning = false;
        startBtn.textContent = '시작';
        startBtn.classList.remove('running');
    }

    function timerComplete() {
        stopTimer();
        remainingTime = 0;
        updateDisplay();
        statusText.textContent = "시간 종료";
        statusText.style.color = "var(--danger-color)";
        circle.style.stroke = "var(--danger-color)"; // Change color on finish

        // Optional: Play sound or animation
        const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3');
        audio.play().catch(e => console.log('Audio play failed', e));
    }

    function startTimer() {
        if (remainingTime <= 0) {
            // Check input
            const minutes = parseInt(timeInput.value);
            if (!minutes || minutes <= 0) {
                alert('시간(분)을 입력해주세요.');
                return;
            }
            totalTime = minutes * 60;
            remainingTime = totalTime;

            // Allow decimals strictly appearing as seconds? 
            // The prompt said "minute settings available", but usually users expect minutes.
            // If they want seconds, we might need a more complex input, but let's stick to minutes for now as per prompt "분 단위로 가능하고".
        }

        isRunning = true;
        startBtn.textContent = '일시정지';
        updateCurrentTime();
        statusText.style.color = "var(--accent-color)";
        circle.style.stroke = "var(--accent-color)";

        updateDisplay(); // Show initial start immediately

        timerInterval = setInterval(() => {
            remainingTime--;
            updateDisplay();
            updateCurrentTime();

            if (remainingTime <= 0) {
                timerComplete();
            }
        }, 1000);
    }

    function toggleTimer() {
        if (isRunning) {
            // Pause
            stopTimer();
            statusText.textContent = "일시정지";
        } else {
            // Start or Resume
            startTimer();
        }
    }

    function resetTimer() {
        stopTimer();
        timeInput.value = '';
        remainingTime = 0;
        totalTime = 0; // Reset total time
        timeLeftDisplay.textContent = "00:00";
        setProgress(100); // Back to full circle
        circle.style.strokeDashoffset = 0; // Full
        statusText.textContent = "Ready";
        statusText.style.color = "var(--text-secondary)";
        circle.style.stroke = "var(--accent-color)";
    }

    // --- Event Listeners ---

    startBtn.addEventListener('click', toggleTimer);
    resetBtn.addEventListener('click', resetTimer);

    // Save notices on input
    noticeBoard.addEventListener('input', () => {
        localStorage.setItem('timer_notices_v8', noticeBoard.innerHTML);
    });

    // Reset Notice Button
    const resetNoticeBtn = document.getElementById('resetNoticeBtn');
    if (resetNoticeBtn) {
        resetNoticeBtn.addEventListener('click', () => {
            if (confirm('공지사항을 초기 멘트로 되돌리시겠습니까?')) {
                const defaultContent = `
                    <p class="main-title">2027 이동선T 미적분 정규반</p>
                    <p class="sub-title">시즌1 2주차</p>
                    
                    <div class="cards-row">
                        <div class="exam-card">
                            <div class="info-row">
                                <div class="info-icon">📝</div>
                                <div class="text-group">
                                    <span class="info-label">시험명</span>
                                    <span class="info-value">미적분 TEST 1주차</span>
                                </div>
                            </div>
                            <div class="card-divider"></div>
                            <div class="info-row">
                                <div class="info-icon">⏰</div>
                                <div class="text-group">
                                    <span class="info-label">시험시간</span>
                                    <span class="info-value">30분 (오후 6:00 ~ 오후 6:30)</span>
                                </div>
                            </div>
                        </div>
    
                        <div class="materials-card">
                            <!-- Class Materials -->
                            <div class="info-row">
                                <div class="info-icon">📂</div>
                                <div class="text-group">
                                    <span class="info-label">수업 전 배부</span>
                                    <ul class="auto-bullet-list">
                                        <li>수업 안내서</li>
                                        <li>이동선 모의고사 __회</li>
                                    </ul>
                                </div>
                            </div>
    
                            <div class="card-divider"></div>
    
                            <!-- Post Exam Materials -->
                            <div class="info-row">
                                <div class="info-icon">🎁</div>
                                <div class="text-group">
                                    <span class="info-label">시험 후 배부</span>
                                    <ul class="auto-bullet-list">
                                        <li>딥러닝</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                noticeBoard.innerHTML = defaultContent;
                localStorage.setItem('timer_notices_v8', defaultContent);
            }
        });
    }

    // Fullscreen Toggle
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.log(`Error attempting to enable fullscreen: ${err.message}`);
                });
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        });
    }

    // Initial Set
    setProgress(100); // Show full circle initially
});
