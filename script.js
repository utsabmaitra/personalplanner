window.isFirstLoadFlag = true;
    
    // আজকের ডেট এবং সাল ডায়নামিকভাবে বের করার কোড
    const today = new Date();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const fullMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    const currentYear = today.getFullYear();
    const currentMonthFull = fullMonthNames[today.getMonth()];
    const currentMonthShort = monthNames[today.getMonth()];
    const currentDate = String(today.getDate()).padStart(2, '0');

    // যেমন: "April 2026" বা "May 2024"
    const dynamicMonthYear = `${currentMonthFull} ${currentYear}`; 
    // যেমন: "Apr 05" বা "May 12"
    const dynamicDateStr = `${currentMonthShort} ${currentDate}`; 

    const initialPlan = [
        { 
            m: dynamicMonthYear, 
            d: [ { date: dynamicDateStr, 
                    t1: "Click '⚙️ EDIT' to unlock",
                    t2: "Enable '✏️ Show Task Edit Icons'",
                    t3: "Then double-tap here to write ✍️" } ] 
        }
    ];
    
    
// ১. সাউন্ড অবজেক্ট তৈরি
let sounds = {
    success: null,
    click: null,
    alert: null
};

// ২. অডিও ফাইলকে Blob হিসেবে লোড করার ফাংশন
async function loadSound(name, file) {
    try {
        const response = await fetch(file);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        sounds[name] = new Audio(url);
        sounds[name].preload = 'auto';
    } catch (e) {
        console.error("Sound loading failed:", name, e);
    }
}

// ফাইলগুলো লোড করা শুরু করুন
loadSound('success', 'success.mp3');
loadSound('click', 'click.mp3');
loadSound('alert', 'alert.mp3');

// ৩. প্লে করার ফাংশন (ওভারল্যাপ প্রটেকশন সহ)
function playSfx(type) {
    // আগে লুপ চালিয়ে সব সাউন্ড থামিয়ে দেওয়া হচ্ছে
    for (let key in sounds) {
        if (sounds[key]) {
            sounds[key].pause(); 
        }
    }

    // এরপর শুধু কাঙ্ক্ষিত সাউন্ডটা প্লে করা হচ্ছে
    const sound = sounds[type];
    if (sound) {
        sound.currentTime = 0; // সাউন্ড একদম শুরু থেকে বাজবে
        sound.play().catch(err => console.log("Playback error:", err));
    }
}

    const STORAGE_KEY = "personal_planner_v27_final";
        // ডিফল্ট কলামের লিস্ট
    const defaultCols = [
        { id: "t1", name: "Task 1" },
        { id: "t2", name: "Task 2" },
        { id: "t3", name: "Task 3" }
    ];

    let state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || { 
        tasks: initialPlan, done: {}, activeId: null, startTime: null, columns: defaultCols 
    };

    // যদি পুরোনো সেভ করা ডাটায় কলাম না থাকে, তবে ডিফল্ট কলাম বসিয়ে দেওয়া
    if (!state.columns) state.columns = defaultCols;

    let timerRef = null;
    let draggedSource = null;
    let scrollSpeed = 0;
    let scrollAnimationFrame = null;
    let isDeleteMode = false; // Row ডিলিট মোড ট্র্যাক করার জন্য
    let isTaskEditMode = false; // পেন্সিল আইকন মোড ট্র্যাক করার জন্য (নতুন)
    
    function getRealDate(monthYearStr, dayStr) {
        const monthMap = { "Jan": 0, "Feb": 1, "Mar": 2, "Apr": 3, "May": 4, "Jun": 5, "Jul": 6, "Aug": 7, "Sep": 8, "Oct": 9, "Nov": 10, "Dec": 11 };
        const monthPart = dayStr.split(" ")[0];
        const day = parseInt(dayStr.split(" ")[1]);
        const year = parseInt(monthYearStr.split(" ")[1]);
        return new Date(year, monthMap[monthPart], day);
    }

    function startAutoScroll() {
        if (scrollSpeed !== 0) {
            window.scrollBy(0, scrollSpeed);
            scrollAnimationFrame = requestAnimationFrame(startAutoScroll);
        }
    }

    window.addEventListener('dragover', (e) => {
        if (!draggedSource) return;
        e.preventDefault(); // স্মুথ ড্রপের জন্য এটা জরুরি

        const edge = 150; // স্ক্রিনের কত কাছে গেলে স্ক্রোল শুরু হবে
        const speedMultiplier = 20; // ম্যাক্সিমাম স্পিড

        // ডায়নামিক স্পিড ক্যালকুলেশন (কাছে গেলে স্পিড বাড়বে)
        if (e.clientY < edge) {
            scrollSpeed = -Math.max(1, speedMultiplier * (1 - e.clientY / edge));
        } else if (window.innerHeight - e.clientY < edge) {
            scrollSpeed = Math.max(1, speedMultiplier * (1 - (window.innerHeight - e.clientY) / edge));
        } else {
            scrollSpeed = 0;
        }

        if (scrollSpeed !== 0 && !scrollAnimationFrame) startAutoScroll();
        else if (scrollSpeed === 0 && scrollAnimationFrame) { cancelAnimationFrame(scrollAnimationFrame); scrollAnimationFrame = null; }
    });
    window.addEventListener('dragend', () => { 
        scrollSpeed = 0; 
        draggedSource = null;
        if (scrollAnimationFrame) {
            cancelAnimationFrame(scrollAnimationFrame);
            scrollAnimationFrame = null;
        }
        
        // ড্র্যাগ শেষ হওয়া মাত্র পুরো টেবিল ঝকঝকে পরিষ্কার
        document.querySelectorAll('.drag-over').forEach(cell => {
            cell.classList.remove('drag-over');
        });
    });

    function init(isFirstLoad = false) {
    const tbody = document.getElementById('table-body');
    const theadRow = document.getElementById('table-header-row');
    tbody.innerHTML = '';
    
    // ১. ডায়নামিক হেডার বানানো
    let headerHTML = `<th class="col-date">Date</th>`;
    state.columns.forEach(col => {
        headerHTML += `<th class="col-task">${col.name}</th>`;
    });
    headerHTML += `<th class="col-done">Done</th>`;
    theadRow.innerHTML = headerHTML;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    state.tasks.forEach(month => {
        tbody.insertAdjacentHTML('beforeend', `<tr class="month-row"><td colspan="${state.columns.length + 2}">${month.m}</td></tr>`);
        month.d.forEach(day => {
            // FIXED ISSUE 1: Assign permanent unique ID to prevent shifting state on delete
            if (!day.id) {
                day.id = Date.now() + Math.floor(Math.random() * 10000);
            }
            const id = day.id;
            
            const taskDate = getRealDate(month.m, day.date);
            const isDone = state.done[id];
            const isMissed = state.activeId && !isDone && taskDate < now;
            const rowClass = isDone ? 'done' : (isMissed ? 'missed' : '');
            const isChecked = isDone ? 'checked' : '';
            
            const tr = document.createElement('tr');
            tr.className = rowClass; tr.id = `row-${id}`;

            // ২. ডায়নামিক টাস্ক সেল (ডাবল ক্লিক হ্যান্ডলার সহ)
let taskCellsHTML = '';
state.columns.forEach(col => {
    // চেক করা হচ্ছে এই নির্দিষ্ট টাস্কটি আগে থেকে কাটা (striked) কি না
    const isStriked = (day.s && day.s[col.id]) ? 'striked' : '';
    
    taskCellsHTML += `
    <td class="t-cell" draggable="true" data-id="${id}" data-field="${col.id}" ondblclick="handleTaskDblClick(${id}, '${col.id}')">
        <span class="task-text ${isStriked}">${day[col.id] || ''}</span>
        ${isTaskEditMode ? `<span class="edit-icon" title="Edit Task" onclick="event.stopPropagation(); editTask(${id}, '${col.id}')">✏️</span>` : ''}
    </td>`;
});

            tr.innerHTML = `
                <td class="col-date">
                    ${day.date}
                    <div class="row-timer ${state.activeId ? '' : 'timer-locked'}" id="rt-${id}">
                        <span class="rt-val" id="rt-h-${id}">24</span><span class="rt-sep">:</span>
                        <span class="rt-val" id="rt-m-${id}">00</span><span class="rt-sep">:</span>
                        <span class="rt-val" id="rt-s-${id}">00</span>
                    </div>
                    ${(isDeleteMode && !isDone) ? `<button class="delete-row-btn" onclick="deleteSpecificRow(${id})">🗑️ Delete</button>` : ''}
                </td>
                ${taskCellsHTML}
                <td class="status-td col-done">
                    <input type="checkbox" onclick="handleTick(${id}, this)" ${isChecked}>
                </td>
            `;            

            tr.querySelectorAll('[draggable="true"]').forEach(cell => {
                cell.addEventListener('dragstart', (e) => handleDragStart(e, id, cell.getAttribute('data-field')));
                cell.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    if(!state.done[id] && draggedSource) {
                        document.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
                        cell.classList.add('drag-over');
                    }
                });
                cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
                cell.addEventListener('drop', (e) => handleDrop(e, id, cell));
            });

            tbody.appendChild(tr);
        });
    });

    if (state.activeId) {
        updateButtonUI(true);
        const globalBox = document.getElementById('global-timer-box');
        globalBox.classList.remove('timer-locked');
        globalBox.classList.add('timer-running');
        if (isFirstLoad) checkMissedDays();
    }
    runTimer();
}
// অ্যাপ লোড হওয়ার পর স্প্ল্যাশ স্ক্রিন সরিয়ে ফেলার লজিক
window.addEventListener('load', () => {
    const splash = document.getElementById('app-splash');
    setTimeout(() => {
        splash.style.opacity = '0';
        splash.style.visibility = 'hidden';
        // ৫ সেকেন্ড পর ডম থেকে সরিয়ে ফেলা যাতে পারফরম্যান্স ভালো থাকে
        setTimeout(() => splash.remove(), 500);
    }, 1500); // ১.৫ সেকেন্ড শো করবে, আপনি চাইলে সময় কমাতে পারেন
});
    function runTimer() {
        if (timerRef) clearInterval(timerRef);
        timerRef = setInterval(updateStats, 1000);
        updateStats();
    }

    let isGenerating = false;
function autoGenerateNextDay() {
    if (isGenerating) return;
    if (!state.tasks || state.tasks.length === 0) return;
    
    let lastMonth = state.tasks[state.tasks.length - 1];
    let lastDayObj = lastMonth.d[lastMonth.d.length - 1];
    
    if (!state.done[lastDayObj.id]) return; 
    
    const taskDate = getRealDate(lastMonth.m, lastDayObj.date);
    const endOfDay = new Date(taskDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    // টাইমার 00:00:00 হলে নতুন দিন তৈরি করবে
    if (Date.now() >= endOfDay.getTime()) {
        isGenerating = true;
        let lastDate = new Date(taskDate);
        lastDate.setDate(lastDate.getDate() + 1);
        
        let monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        let fullMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        // FIXED ISSUE 5: Use Full Month Name dynamically
        let newMonthStr = fullMonthNames[lastDate.getMonth()] + " " + lastDate.getFullYear();
        let newDateStr = monthNames[lastDate.getMonth()] + " " + String(lastDate.getDate()).padStart(2, '0');
        
        let newDay = { id: Date.now() + Math.floor(Math.random() * 1000), date: newDateStr };
        state.columns.forEach(col => newDay[col.id] = ""); 
        
        let targetMonth = state.tasks.find(m => m.m === newMonthStr);
        if(targetMonth) { targetMonth.d.push(newDay); } 
        else { state.tasks.push({ m: newMonthStr, d: [newDay] }); }
        
        // সেশন রানিং থাকলে অ্যাকটিভ আইডি নতুন দিনে সেট হবে
        if (!state.activeId && document.getElementById('start-btn').disabled) { 
            state.activeId = newDay.id;
        }
        
        save(); init(false);
        showToast(`New day ${newDateStr} started! 🚀`);
        playSfx('success');
        setTimeout(() => { isGenerating = false; }, 2000);
    }
}

// এই ফ্ল্যাগগুলো ফাংশনের বাইরে একবারই ডিক্লেয়ার করবেন
if (window.hasCelebrated === undefined) window.hasCelebrated = false;
if (window.hasPausedNotified === undefined) window.hasPausedNotified = false;

function updateStats() {
    if (!state.tasks || state.tasks.length === 0 || !state.tasks[0].d || state.tasks[0].d.length === 0) {
        document.getElementById('fill').style.width = '0%';
        document.getElementById('stat').innerText = "0% Overall Progress (0/0)";
        updateCountdownUI(0);
        return;
    }

    // --- প্রগ্রেস ক্যালকুলেশন ---
    let totalTasks = 0;
    let completedTasks = 0;

    state.tasks.forEach(month => {
        month.d.forEach(day => {
            const isRowDone = state.done[day.id]; 
            state.columns.forEach(col => {
                const taskText = day[col.id] || "";
                if (taskText.trim() !== "") {
                    totalTasks++; 
                    const isTaskStriked = day.s && day.s[col.id];
                    if (isRowDone || isTaskStriked) completedTasks++; 
                }
            });
        });
    });

    const per = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    document.getElementById('fill').style.width = per + '%';
    document.getElementById('stat').innerText = `${per}% Overall Progress (${completedTasks}/${totalTasks})`;

    // --- টাইমার ক্যালকুলেশন ---
    let lastMonthInfo = state.tasks[state.tasks.length - 1];
    let lastDayInfo = lastMonthInfo.d[lastMonthInfo.d.length - 1];
    const lastDayDate = getRealDate(lastMonthInfo.m, lastDayInfo.date);
    const globalEndTime = new Date(lastDayDate);
    globalEndTime.setHours(23, 59, 59, 999);
    let remainingGlobal = Math.floor((globalEndTime.getTime() - Date.now()) / 1000);

    const btn = document.getElementById('start-btn');

    if (state.activeId) {
        // শর্ত ১: সময় শেষ হয়ে গেলে (Paused Mode) - এটা সব সময় প্রায়োরিটি পাবে
        if (remainingGlobal <= 0) {
            remainingGlobal = 0;
            btn.innerText = "⏸️ PROGRESS PAUSED";
            btn.classList.remove("btn-running");
            btn.style.cssText = "background:transparent; border:2px solid var(--accent); color:var(--accent); cursor:default;";
            btn.disabled = true;

            if (window.isFirstLoadFlag || !window.hasPausedNotified) {
                showToast("Time's up! Please add a new row to continue. ⏳", true);
                window.hasPausedNotified = true;
            }
            window.hasCelebrated = true; // Paused থাকলে অভিনন্দন জানাবে না
        } 
        // শর্ত ২: সেশন ১০০% কমপ্লিট হলে
        else if (per === 100 && totalTasks > 0) {
            btn.innerText = "🏆 SESSION COMPLETED";
            btn.classList.remove("btn-running");
            btn.style.cssText = "background:transparent; border:2px solid var(--success); color:var(--success); cursor:default;";
            btn.disabled = true;

            if (window.isFirstLoadFlag) {
                // অ্যাপে ঢোকার সময় যদি দেখে ১০০% হয়ে আছে
                showToast("Add a new row to start a new session! ➕");
                window.hasCelebrated = true; // যাতে লোড হওয়ার সময় অভিনন্দন না জানায়
            } else if (!window.hasCelebrated) {
                // ইউজার মাত্র শেষ টাস্কটি শেষ করলো
                showToast("Mission Accomplished! 🏆 All tasks done.");
                playSfx('success');
                window.hasCelebrated = true;
            }
            window.hasPausedNotified = false;
        } 
        // শর্ত ৩: সেশন রানিং
        else {
            updateButtonUI(true);
            window.hasCelebrated = false;
            window.hasPausedNotified = false;
        }
    } else {
        updateButtonUI(false);
        window.hasCelebrated = false;
        window.hasPausedNotified = false;
    }

    updateCountdownUI(remainingGlobal > 0 ? remainingGlobal : 0);
    autoGenerateNextDay();
    
    // সব লজিক শেষ হওয়ার পর ফার্স্ট লোড ফ্ল্যাগ অফ করা
    window.isFirstLoadFlag = false;

    // রো টাইমার আপডেট
    const now = new Date();
    state.tasks.forEach(month => {
        month.d.forEach(day => {
            const taskDate = getRealDate(month.m, day.date);
            const endOfDay = new Date(taskDate);
            endOfDay.setHours(23, 59, 59, 999);
            let diff = Math.floor((endOfDay.getTime() - now.getTime()) / 1000);
            if (diff < 0) diff = 0;
            if (diff > 86400) diff = 86400;
            updateRowTimerUI(day.id, diff);
        });
    });
}

    function updateRowTimerUI(id, s) {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        const hEl = document.getElementById(`rt-h-${id}`);
        if (hEl) {
            hEl.innerText = h.toString().padStart(2, '0');
            document.getElementById(`rt-m-${id}`).innerText = m.toString().padStart(2, '0');
            document.getElementById(`rt-s-${id}`).innerText = sec.toString().padStart(2, '0');
        }
    }

    function updateCountdownUI(s) {
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        document.getElementById('d-val').innerText = d.toString().padStart(2, '0');
        document.getElementById('h-val').innerText = h.toString().padStart(2, '0');
        document.getElementById('m-val').innerText = m.toString().padStart(2, '0');
        document.getElementById('s-val').innerText = sec.toString().padStart(2, '0');
    }

    function handleTick(id, box) {
    if (state.done[id]) { 
        box.checked = true;
        showToast("This day is already completed! 🎯", true); 
        return; 
    }
    
    if (!state.activeId) {
        box.checked = false;
        playSfx('alert');
        showModal("Not Started! ⚠️", "Start your session to mark tasks.", [
            { label: "Close", class: "btn-cancel", onClick: closeModal },
            { label: "Start Now", class: "btn-confirm", onClick: startTimer }
        ]); 
        return;
    }

    // --- নতুন চেক লজিক: রো খালি কি না তা দেখা ---
    let targetDay;
    state.tasks.forEach(m => m.d.forEach(d => {
        if (d.id === id) targetDay = d;
    }));

    // সব কলাম চেক করে দেখা হচ্ছে অন্তত একটিতে কোনো টেক্সট আছে কি না
    let hasAnyTask = state.columns.some(col => {
        const taskText = targetDay[col.id] || "";
        return taskText.trim() !== "";
    });

    if (!hasAnyTask) {
        box.checked = false; // চেক করা যাবে না
        playSfx('alert');
        showToast("Cannot mark as done! Row is empty. ✍️", true);
        return;
    }
    // --- চেক লজিক শেষ ---

    box.checked = false;

    // বাকি আগের কোড (তারিখ বের করা এবং কনফার্মেশন মোডাল দেখানো)
    let taskDateStr = "";
    let monthYearStr = "";
    state.tasks.forEach(month => {
        month.d.forEach(day => {
            if(day.id === id) {
                taskDateStr = day.date;
                monthYearStr = month.m;
            }
        });
    });

    const taskDate = getRealDate(monthYearStr, taskDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let message = "";
    if (taskDate.getTime() === today.getTime()) {
        message = `Did you complete all your tasks for today?`;
    } else if (taskDate < today) {
        message = `Did you complete these backlog tasks for "${taskDateStr}"?`;
    } else {
        message = `Ready to finish future tasks for "${taskDateStr}" in advance?`;
    }

    showModal("Mark as Completed? ✅", message, [
        { label: "Cancel", class: "btn-cancel", onClick: closeModal },
        { label: "Done!", class: "btn-confirm", onClick: () => confirmMark(id, box) }
    ]);
}

    function confirmMark(id, box) {
    state.done[id] = true; box.checked = true;
    
    // FIXED ISSUE 3: Do not stop session timer if all rows are done
    if (state.activeId === id) { 
        let next = findNext();
        if (next) state.activeId = next; 
        // If next is null, activeId stays intact. Timer continues!
    }
    
    const rect = box.getBoundingClientRect(); burstEffect(rect.left+10, rect.top+10);
    
    let currentDay;
    state.tasks.forEach(m => m.d.forEach(d => { if(d.id === id) currentDay = d; }));
    
    showToast(`${currentDay.date} tasks completed! 🎯`);
    playSfx('success');
    
    save(); 
    init(false); // UI পুরো রিফ্রেশ হয়ে ডিলিট বাটন হাইড হয়ে যাবে
    closeModal();
}

    function isTodayTask(id) {
    let targetDay, targetMonth;

    state.tasks.forEach(m => {
        m.d.forEach(d => {
            if (d.id === id) {
                targetDay = d;
                targetMonth = m.m;
            }
        });
    });

    if (!targetDay) return false;

    const taskDate = getRealDate(targetMonth, targetDay.date);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return taskDate.getTime() === today.getTime();
}

    function checkMissedDays() {
        let missedCount = 0;
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        state.tasks.forEach(month => {
            month.d.forEach(day => {
                const taskDate = getRealDate(month.m, day.date);
                if (!state.done[day.id] && taskDate < now) missedCount++;
            });
        });
        
        if (missedCount > 0) showToast(`You missed ${missedCount} days! 🔴`, true);
    }

    function startTimer() {
        if (state.activeId) return;
        const nextId = findNext();
        if (nextId) {
            state.activeId = nextId; state.startTime = Date.now();
            save(); updateButtonUI(true);
            
            const globalBox = document.getElementById('global-timer-box');
            globalBox.classList.remove('timer-locked');
            globalBox.classList.add('timer-running');
            
            document.querySelectorAll('.row-timer').forEach(el => el.classList.remove('timer-locked'));
            
            init(false);
            
            checkMissedDays();
            showToast("Session Started! 🚀"); 
            playSfx('success');
            closeModal();
        }
    }

    function findNext() {
        for (const m of state.tasks) { 
            for (const d of m.d) { 
                if (!state.done[d.id]) return d.id; 
            } 
        }
        return null;
    }

    function updateButtonUI(running) {
    const btn = document.getElementById('start-btn');
    
    // Clean up manually set properties for "PROGRESS PAUSED" state
    btn.style.background = "";
    btn.style.border = "";
    btn.style.color = "";

    if (running) {
        btn.innerText = "● PROGRESS RUNNING";
        btn.classList.add("btn-running");
        btn.disabled = true; // বাটনটি আনক্লিকেবল হয়ে যাবে
        btn.style.cursor = "default";
    } else {
        btn.innerText = "START STUDY SESSION";
        btn.classList.remove("btn-running");
        btn.disabled = false;
        btn.style.cursor = "pointer";
    }
}

    function showToast(msg, isRed = false) {
    const t = document.createElement('div'); t.className = isRed ? 'toast red' : 'toast'; t.innerText = msg;
    document.getElementById('toast-box').appendChild(t);
    // যাওয়ার সময় নিচে নেমে এবং ছোট হয়ে মিলিয়ে যাওয়ার স্মুথ ইফেক্ট
    setTimeout(() => { 
        t.style.opacity = '0'; 
        t.style.transform = 'translateY(20px) scale(0.9)'; 
        setTimeout(() => t.remove(), 400); 
    }, 4000);
}

function showModal(title, text, actions) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-text').innerText = text;
    const actionBox = document.getElementById('modal-actions'); actionBox.innerHTML = '';
    actions.forEach(btn => {
        const b = document.createElement('button'); b.className = `modal-btn ${btn.class}`;
        b.innerText = btn.label; b.onclick = btn.onClick; actionBox.appendChild(b);
    });
    // display: flex এর বদলে 'show' ক্লাস অ্যাড করা হলো
    document.getElementById('modal-overlay').classList.add('show');
}

function closeModal() { 
	playSfx('click');
    document.getElementById('modal-overlay').classList.remove('show'); 
}

    function handleDragStart(e, id, field) {   
    if(state.done[id]) { 
        e.preventDefault(); 
        showToast("Completed tasks are locked! 🔒", true);   
        playSfx('alert');   
        return; 
    }   

    draggedSource = { id, field };  
}

    function handleDrop(e, targetId, targetCell) {
    e.preventDefault();
    targetCell.classList.remove('drag-over');
    if (!draggedSource) return;
    
    const targetField = targetCell.getAttribute('data-field');
    
    if (draggedSource.id === targetId && draggedSource.field === targetField) {
        draggedSource = null;
        return; 
    }

    if (state.done[targetId]) { 
        showToast("Cannot move tasks to a completed day! 🚫", true); 
        playSfx('alert'); 
        return; 
    }
    
    let sDay, tDay;
    state.tasks.forEach(m => m.d.forEach(d => { 
        if (d.id === draggedSource.id) sDay = d; 
        if (d.id === targetId) tDay = d; 
    }));

    if (sDay && tDay) {
        const sourceText = (sDay[draggedSource.field] || "").trim();
        const targetText = (tDay[targetField] || "").trim();

        // যদি দুই ঘরই খালি হয়, তবে সোয়াপ হবে না
        if (sourceText === "" && targetText === "") {
            showToast("Both cells are empty! Cannot swap. 🚫", true);
            playSfx('alert');
            draggedSource = null;
            return;
        }

        // অদলবদল লজিক
        const tempText = sDay[draggedSource.field] || "";
        sDay[draggedSource.field] = tDay[targetField] || "";
        tDay[targetField] = tempText;

        if (!sDay.s) sDay.s = {};
        if (!tDay.s) tDay.s = {};
        const tempStrike = sDay.s[draggedSource.field] || false;
        sDay.s[draggedSource.field] = tDay.s[targetField] || false;
        tDay.s[targetField] = tempStrike;

        // UI আপডেট
        const sourceCell = document.querySelector(`td[data-id="${draggedSource.id}"][data-field="${draggedSource.field}"]`);
        if (sourceCell) {
            sourceCell.style.opacity = '0';
            targetCell.style.opacity = '0';
            setTimeout(() => {
                save(); 
                init(false);
                const sCellNew = document.querySelector(`td[data-id="${draggedSource.id}"][data-field="${draggedSource.field}"]`);
                const tCellNew = document.querySelector(`td[data-id="${targetId}"][data-field="${targetField}"]`);
                if(sCellNew) sCellNew.style.opacity = '1';
                if(tCellNew) tCellNew.style.opacity = '1';
            }, 150); 
        }

        playSfx('click');

        // ডাইনামিক টোস্ট মেসেজ
        if (sourceText !== "" && targetText !== "") {
            showToast("Tasks Swapped! 🔄");
        } else {
            showToast("Task Swapped! 🔄");
        }
    }
    draggedSource = null;
}

    function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

    function burstEffect(x, y) {
        for (let i = 0; i < 15; i++) {
            const p = document.createElement('div'); p.className = 'particle';
            p.style.left = x + 'px'; p.style.top = y + 'px';
            p.style.setProperty('--x', (Math.random()*80 - 40) + 'px');
            p.style.setProperty('--y', (Math.random()*80 - 40) + 'px');
            document.body.appendChild(p); setTimeout(() => p.remove(), 600);
        }
    }

    init(true);
    // Service Worker Registration for Offline App
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('Service Worker registered successfully.', reg))
                .catch(err => console.error('Service Worker registration failed:', err));
        });
    }
    
    // স্ক্রল মোড হ্যান্ডেল করার ফাংশন
function toggleScroll(isFromLoad = false) {
    const container = document.querySelector('.container');
    const btn = document.getElementById('scroll-btn');
    
    // পেজ লোড হওয়ার সময় কল হলে সাউন্ড বাজবে না, শুধু বাটনে ক্লিক করলেই বাজবে
    if (!isFromLoad) {
        playSfx('click');
    }
    
    const isScrollActive = container.classList.toggle('scroll-active');
    
    // বাটন টেক্সট এবং স্টাইল আপডেট
    if (isScrollActive) {
        btn.innerText = "🔒 DISABLE SCROLL";
        btn.classList.add('active');
    } else {
        btn.innerText = "🔓 ENABLE SCROLL";
        btn.classList.remove('active');
    }
    
    // লোকাল স্টোরেজে সেভ করে রাখা
    localStorage.setItem('personal_planner_scroll_mode', isScrollActive);
}

// পেজ লোড হওয়ার সময় আগের সেটিংস চেক করা
window.addEventListener('DOMContentLoaded', () => {
    const savedScroll = localStorage.getItem('personal_planner_scroll_mode') === 'true';
    if (savedScroll) {
        // 'true' প্যারামিটার পাস করছি যেন সাউন্ড না বাজে
        toggleScroll(true); 
    }
});

// কলাম এবং রো এডিটর মোডাল ওপেন করা
function openColumnEditor() {
    playSfx('click');
    let html = '<div id="col-edit-list" style="text-align:left; max-height: 350px; overflow-y: auto; padding: 5px;">';
    
    // --- কলাম ম্যানেজ সেকশন ---
    html += '<h5 style="color:var(--accent); margin:0 0 10px 0;">⚙️ Manage Columns</h5>';
    state.columns.forEach((c, index) => {
        html += `
        <div style="margin-bottom:10px; display:flex; gap:5px; align-items:center;">
            <input type="text" id="col-input-${index}" value="${c.name}" style="flex:1; padding:8px; border-radius:5px; border:1px solid var(--accent); background:rgba(15, 23, 42, 0.8); color:var(--text); font-weight:bold;">
            <button onclick="deleteColumn(${index})" style="padding:8px 12px; background:rgba(239, 68, 68, 0.15); color:var(--error); border:1px solid var(--error); border-radius:5px; cursor:pointer;" title="Delete Column">🗑️</button>
        </div>`;
    });

    html += '<hr style="border-color:var(--border); margin:15px 0;">';

    // FIXED ISSUE 2: Calculate EXACT next valid date to show in UI
    let lastMonthObj = state.tasks[state.tasks.length - 1];
    let lastDayObj = lastMonthObj.d[lastMonthObj.d.length - 1];
    let lastDate = getRealDate(lastMonthObj.m, lastDayObj.date);
    let expectedNext = new Date(lastDate);
    expectedNext.setDate(expectedNext.getDate() + 1);
    
    let expectedMonth = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][expectedNext.getMonth()];
    let expectedDay = String(expectedNext.getDate()).padStart(2, '0');
    let expectedDateStr = `${expectedMonth} ${expectedDay}`;

    // --- রো (Row) অ্যাড সেকশন ---
    html += '<h5 style="color:var(--success); margin:0 0 10px 0;">📅 Add New Row</h5>';
    html += `
    <div style="display:flex; gap:5px; margin-bottom:10px;">
        <input type="text" id="new-row-date" value="${expectedDateStr}" placeholder="e.g. Apr 10" style="flex:1; padding:8px; border-radius:5px; border:1px solid var(--success); background:rgba(15, 23, 42, 0.8); color:var(--text); font-weight:bold;">
        <button onclick="addCustomRow()" style="padding:8px; background:var(--success); color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">Add Row</button>
    </div>`;

    // --- রো (Row) ডিলিট মোড বাটন ---
    html += `
    <button onclick="toggleDeleteMode()" style="width:100%; padding:8px; background:rgba(239, 68, 68, 0.2); color:var(--error); border:1px solid var(--error); border-radius:5px; font-weight:bold; cursor:pointer; margin-top:10px;">
        ${isDeleteMode ? '❌ Hide Row Delete Buttons' : '🗑️ Show Row Delete Buttons'}
    </button>`;
    
    // --- টাস্ক এডিট (Pencil) আইকন বাটন --- (নতুন)
    html += `
    <button onclick="toggleTaskEditMode()" style="width:100%; padding:8px; background:rgba(56, 189, 248, 0.2); color:var(--accent); border:1px solid var(--accent); border-radius:5px; font-weight:bold; cursor:pointer; margin-top:10px;">
        ${isTaskEditMode ? '❌ Hide Task Edit Icons' : '✏️ Show Task Edit Icons'}
    </button>`;

    html += '</div>';

    showModal("Customize Planner", "", [
        { label: "Close", class: "btn-cancel", onClick: closeModal },
        { label: "+ Add Col", class: "btn-confirm", onClick: addNewColumnUI },
        { label: "Save Columns", class: "btn-confirm", onClick: saveColumns }
    ]);

    document.getElementById('modal-text').innerHTML = html;
}

// নতুন কলাম ফিল্ড যোগ করা (ইউআই তে)
function addNewColumnUI() {
    playSfx('click');
    const list = document.getElementById('col-edit-list');
    const newIndex = list.children.length;
    const div = document.createElement('div');
    div.style.cssText = "margin-bottom:10px; display:flex; gap:5px;";
    div.innerHTML = `<input type="text" id="col-input-${newIndex}" value="New Task" placeholder="Column Name" style="flex:1; padding:8px; border-radius:5px; border:1px solid var(--success); background:rgba(15, 23, 42, 0.8); color:var(--text); font-family:'Inter'; font-weight:bold;">`;
    list.appendChild(div);
}

// কলামগুলো সেভ করা এবং টেবিল রিলোড করা
function saveColumns() {
    const inputs = document.querySelectorAll('input[id^="col-input-"]');
    let newCols = [];
    
    inputs.forEach((inp, idx) => {
        const value = inp.value.trim();
        if(value !== "") {
            let id;
            // যদি এই পজিশনে আগে থেকেই কোনো কলাম থেকে থাকে, তবে তার ID অপরিবর্তিত থাকবে
            if (state.columns[idx] && state.columns[idx].id) {
                id = state.columns[idx].id;
            } else {
                // নতুন কলামের জন্য ইউনিক টাইমস্ট্যাম্প ভিত্তিক ID তৈরি হবে
                // এতে পুরনো 't1', 't2' আইডি-র সাথে আর সংঘর্ষ হবে না
                id = `col_${Date.now()}_${idx}`;
            }
            newCols.push({ id: id, name: value });
        }
    });

    state.columns = newCols;
    save(); 
    init(false); 
    closeModal();
    playSfx('success');
    showToast("Columns Updated Successfully! 🛠️");
}

// নতুন Row (Day) যোগ করা
function addNewRow() {
    if(state.tasks.length === 0) return;
    
    // প্ল্যানারের একদম শেষের মাস এবং দিন বের করা
    let lastMonth = state.tasks[state.tasks.length - 1];
    let lastDayObj = lastMonth.d[lastMonth.d.length - 1];
    
    // শেষ তারিখ থেকে ১ দিন বাড়ানো
    let lastDate = getRealDate(lastMonth.m, lastDayObj.date);
    lastDate.setDate(lastDate.getDate() + 1);
    
    // নতুন দিনের ফরম্যাট (যেমন: May 09)
    let monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let newMonthStr = monthNames[lastDate.getMonth()] + " " + lastDate.getFullYear();
    let newDateStr = monthNames[lastDate.getMonth()] + " " + String(lastDate.getDate()).padStart(2, '0');
    
    // নতুন দিনের ডেটা তৈরি করা (কলামগুলো ফাঁকা থাকবে)
    let newDay = { date: newDateStr };
    state.columns.forEach(col => newDay[col.id] = ""); 
    
    // মাস কি একই আছে নাকি নতুন মাস শুরু হলো তা চেক করা
    let targetMonth = state.tasks.find(m => m.m === newMonthStr);
    if(targetMonth) {
        targetMonth.d.push(newDay);
    } else {
        state.tasks.push({ m: newMonthStr, d: [newDay] });
    }
    
    save();
    init(false);
    playSfx('success');
    showToast(`Added ${newDateStr} at the bottom! 📅`);
    closeModal();
}

// ডিলিট মোড অন/অফ করা
function toggleDeleteMode() {
    playSfx('click');
    isDeleteMode = !isDeleteMode;
    init(false); // টেবিল রিলোড হবে, ডিলিট বাটন দেখাবে/লুকাবে
    openColumnEditor(); // পপ-আপ রিলোড হবে যেন বাটন টেক্সট আপডেট হয়
}

function editTask(id, field) {
    if (!isTaskEditMode) return;

    let targetDay;
    state.tasks.forEach(m => m.d.forEach(d => {
        if (d.id === id) targetDay = d;
    }));

    if (!targetDay) return;

    if (state.done[id]) {
        playSfx('alert');
        showToast("Completed tasks cannot be edited! 🔒", true);
        return;
    }

    // striked task edit locked
    if (targetDay.s && targetDay.s[field]) {
        playSfx('alert');
        showToast("Completed tasks cannot be edited! 🔒", true);
        return;
    }

    let currentVal = targetDay[field] || "";

    let inputHtml = `  
        <div style="background: rgba(15, 23, 42, 0.5); padding: 15px; border-radius: 8px; border: 1px solid var(--border); margin-top: 10px;">  
            <p style="color:var(--sub); font-size:13px; margin:0 0 8px 0; font-weight: 500;">  
                📝 Editing task for <span style="color:var(--accent)">${targetDay.date}</span>  
            </p>  
            <textarea id="edit-task-input" placeholder="Type your task here..." rows="4"  
                style="width:100%; padding:12px; border-radius:6px; border:1px solid var(--accent);   
                       background:rgba(10, 15, 30, 0.9); color:var(--text); font-family:'Inter', sans-serif;   
                       font-size: 14px; resize: none; box-sizing: border-box; outline: none;"></textarea>  
        </div>  
    `;

    showModal("✏️ Edit Task", "", [
        { label: "Cancel", class: "btn-cancel", onClick: closeModal },
        { label: "Save Task", class: "btn-confirm", onClick: () => {
            let newVal = document.getElementById('edit-task-input').value;
            targetDay[field] = newVal;
            save();
            init(false);
            playSfx('success');
            showToast("Task Updated! ✏️");
            closeModal();
        }}
    ]);

    document.getElementById('modal-text').innerHTML = inputHtml;
    document.getElementById('edit-task-input').value = currentVal;
    document.getElementById('edit-task-input').focus();
}

// ২. নির্দিষ্ট কলাম ডিলিট করা (পপ-আপ সহ)
function deleteColumn(index) {
	playSfx('click');
    if(state.columns.length <= 1) {
        showModal("⚠️ Warning", "You must have at least one column!", [
            { label: "Got it", class: "btn-cancel", onClick: openColumnEditor }
        ]);
        return;
    }
    
    showModal("🗑️ Delete Column", "Are you sure you want to delete this column? All tasks inside it will be hidden.", [
        { label: "Cancel", class: "btn-cancel", onClick: openColumnEditor }, 
        { label: "Delete", class: "btn-confirm", style: "background:var(--error);", onClick: () => {
            state.columns.splice(index, 1);
            save(); 
            openColumnEditor(); 
            init(false); 
            playSfx('alert');
            showToast("Column Deleted! 🗑️", true);
        }}
    ]);
}

// ৩. নতুন Row অ্যাড করা (সঠিক Date Format ওয়ার্নিং পপ-আপ সহ)
function addCustomRow() {
    let dateVal = document.getElementById('new-row-date').value.trim();
    
    // FIXED ISSUE 2: Strict Date validation enforce
    let lastMonthObj = state.tasks[state.tasks.length - 1];
    let lastDayObj = lastMonthObj.d[lastMonthObj.d.length - 1];
    let lastDate = getRealDate(lastMonthObj.m, lastDayObj.date);
    let expectedNext = new Date(lastDate);
    expectedNext.setDate(expectedNext.getDate() + 1);
    
    let expectedMonth = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][expectedNext.getMonth()];
    let expectedDay = String(expectedNext.getDate()).padStart(2, '0');
    let expectedDateStr = `${expectedMonth} ${expectedDay}`;

    if (dateVal !== expectedDateStr) {
        showModal("⚠️ Invalid Sequence", `Please maintain serial. Next valid date must be ${expectedDateStr}`, [{ label: "Try Again", class: "btn-cancel", onClick: openColumnEditor }]);
        return; 
    }

    // FIXED ISSUE 5: Use Full Month Name dynamically for new month inserts
    let fullMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    let currentYear = expectedNext.getFullYear();
    let fullMonthStr = fullMonthNames[expectedNext.getMonth()] + " " + currentYear;
    
    // Add Row
    let newDay = { id: Date.now() + Math.floor(Math.random() * 1000), date: dateVal };
    state.columns.forEach(c => newDay[c.id] = ""); 
    
    let targetMonth = state.tasks.find(m => m.m === fullMonthStr);
    if(targetMonth) { targetMonth.d.push(newDay); } 
    else { state.tasks.push({ m: fullMonthStr, d: [newDay] }); }
    
    save(); init(false); playSfx('success');
    showToast(`Row for ${dateVal} Added! 📅`);
}

// ৫. নির্দিষ্ট Row ডিলিট করা (পপ-আপ সহ)
function deleteSpecificRow(id) {
	playSfx('click');
    let totalRows = 0;
    state.tasks.forEach(m => totalRows += m.d.length);
    
    // ১টি রো থাকলে ডিলিট করতে দিবে না
    if (totalRows <= 1) {
        showModal("⚠️ Cannot Delete", "You must keep at least one day in the planner!", [
            { label: "Got it", class: "btn-cancel", onClick: closeModal }
        ]);
        return;
    }

    showModal("🗑️ Delete Day", "Are you sure you want to delete this specific day?", [
        { label: "Cancel", class: "btn-cancel", onClick: closeModal },
        { label: "Delete", class: "btn-confirm", style: "background:var(--error);", onClick: () => {
            state.tasks.forEach(month => {
                month.d = month.d.filter(day => day.id !== id);
            });
            
            state.tasks = state.tasks.filter(month => month.d.length > 0);
            
            save(); init(false); playSfx('alert');
            showToast("Row Deleted Successfully! 🗑️", true);
            closeModal();
        }}
    ]);
}

// টাস্ক এডিট (Pencil) মোড অন/অফ করা
function toggleTaskEditMode() {
    isTaskEditMode = !isTaskEditMode;
    init(false); // টেবিল রিলোড হবে, পেন্সিল আইকন দেখাবে/লুকাবে
    openColumnEditor(); // পপ-আপ রিলোড হবে যেন বাটন টেক্সট আপডেট হয়
}

function handleTaskDblClick(id, field) {
    if (isTaskEditMode) {
        // ১. যদি এডিট মোড অন থাকে, তবে সরাসরি editTask-এ পাঠিয়ে দাও
        // সেখানে থাকা "Completed tasks cannot be edited!" ওয়ার্নিংটা তখন কাজ করবে
        editTask(id, field);
    } else {
        // ২. যদি এডিট মোড অফ থাকে, তখন এই লক চেকটা কাজ করবে
        if (state.done[id]) {
            playSfx('alert');
            showToast("Completed tasks are locked! 🔒", true);
            return;
        }
        confirmTaskStrike(id, field);
    }
}

function confirmTaskStrike(id, field) {
    let targetDay;
    state.tasks.forEach(m => m.d.forEach(d => {
        if (d.id === id) targetDay = d;
    }));

    if (!targetDay || !targetDay[field] || targetDay[field].trim() === "") return;
    if (state.done[id]) return;

    // already striked হলে আর কিছুই হবে না (restore বন্ধ)
    if (targetDay.s && targetDay.s[field]) {
        playSfx('alert');
        showToast("Completed tasks are locked! 🔒", true);
        return;
    }

    // session start না থাকলে checkbox এর মতো same warning
    if (!state.activeId) {
        playSfx('alert');
        showModal("Not Started! ⚠️", "Start your session to strike tasks.", [
            { label: "Close", class: "btn-cancel", onClick: closeModal },
            { label: "Start Now", class: "btn-confirm", onClick: startTimer }
        ]);
        return;
    }

    showModal("Strike Task? ✂️", "Do you want to strike this task?", [
        { label: "Cancel", class: "btn-cancel", onClick: closeModal },
        {
            label: "Strike",
            class: "btn-confirm",
            onClick: () => {
                toggleTaskStrike(id, field);
                closeModal();
            }
        }
    ]);
}

function toggleTaskStrike(id, field) {
    if (state.done[id]) return;

    let targetDay;
    state.tasks.forEach(m => m.d.forEach(d => {
        if (d.id === id) targetDay = d;
    }));

    if (!targetDay || !targetDay[field] || targetDay[field].trim() === "") return;

    if (!targetDay.s) targetDay.s = {};

    targetDay.s[field] = true;

    save();
    init(false);
    showToast("Task completed! ✅"); // টাস্ক কাটলে এই টোস্ট দেখাবে

    let allTasksStriked = state.columns.every(col => {
        const val = targetDay[col.id] || "";
        if (val.trim() === "") return true;
        return targetDay.s && targetDay.s[col.id];
    });

    if (allTasksStriked) {
        const checkbox = document.querySelector(`#row-${id} input[type="checkbox"]`);
        if (checkbox) {
            setTimeout(() => handleTick(id, checkbox), 150);
        }
    }
}