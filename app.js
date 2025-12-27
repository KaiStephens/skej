// State
let allTasks = {}; // { 'YYYY-MM-DD': [tasks] }
let currentDate = new Date();
let currentWeekStart = getWeekStart(new Date());
let taskIdCounter = 0;
let aiContext = '';
let viewMode = 'daily'; // 'daily' or 'weekly'
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let selectedTaskId = null;
let selectedTaskDate = null;

const API_URL = 'http://localhost:3001';
const SLOT_HEIGHT = 60;
const WEEK_SLOT_HEIGHT = 40;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// DOM Elements
const timeline = document.getElementById('timeline');
const weeklyView = document.getElementById('weeklyView');
const weekHeader = document.getElementById('weekHeader');
const weekGrid = document.getElementById('weekGrid');
const dateDisplay = document.getElementById('dateDisplay');
const dateBtn = document.getElementById('dateBtn');
const datePicker = document.getElementById('datePicker');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const infoBtn = document.getElementById('infoBtn');
const infoModal = document.getElementById('infoModal');
const closeModal = document.getElementById('closeModal');
const aiContextInput = document.getElementById('aiContext');
const saveContextBtn = document.getElementById('saveContext');
const dailyViewBtn = document.getElementById('dailyViewBtn');
const weeklyViewBtn = document.getElementById('weeklyViewBtn');
const micBtn = document.getElementById('micBtn');
const voiceStatus = document.getElementById('voiceStatus');

// Task Modal Elements  
const taskModal = document.getElementById('taskModal');
const taskModalTitle = document.getElementById('taskModalTitle');
const taskTimeInfo = document.getElementById('taskTimeInfo');
const subtasksList = document.getElementById('subtasksList');
const closeTaskModal = document.getElementById('closeTaskModal');
const deleteTaskBtn = document.getElementById('deleteTaskBtn');

// Date helpers
function getDateKey(date) {
    return date.toISOString().split('T')[0];
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getWeekDates(weekStart) {
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        dates.push(d);
    }
    return dates;
}

function formatDateDisplay(date) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function formatWeekDisplay(weekStart) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startMonth} - ${endMonth}`;
}

function isToday(date) {
    const today = new Date();
    return getDateKey(date) === getDateKey(today);
}

function isTomorrow(date) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return getDateKey(date) === getDateKey(tomorrow);
}

function isDateInWeek(date, weekStart) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return date >= weekStart && date < weekEnd;
}

// Task getters/setters
function getTasksForDate(date) {
    const key = getDateKey(date);
    return allTasks[key] || [];
}

function setTasksForDate(date, tasks) {
    const key = getDateKey(date);
    allTasks[key] = tasks;
}

function getCurrentTasks() {
    return getTasksForDate(currentDate);
}

function setCurrentTasks(tasks) {
    setTasksForDate(currentDate, tasks);
}

// Initialize
function init() {
    loadFromStorage();
    displayDate();
    if (viewMode === 'weekly') {
        showWeeklyView();
    } else {
        showDailyView();
    }
    setupEventListeners();
}

// Display date/week in header
function displayDate() {
    if (viewMode === 'weekly') {
        dateDisplay.textContent = formatWeekDisplay(currentWeekStart);
        datePicker.value = getDateKey(currentWeekStart);
    } else {
        if (isToday(currentDate)) {
            dateDisplay.textContent = 'Today';
        } else if (isTomorrow(currentDate)) {
            dateDisplay.textContent = 'Tomorrow';
        } else {
            dateDisplay.textContent = formatDateDisplay(currentDate);
        }
        datePicker.value = getDateKey(currentDate);
    }
}

// View switching
function showDailyView() {
    viewMode = 'daily';
    timeline.style.display = 'block';
    weeklyView.style.display = 'none';
    dailyViewBtn.classList.add('active');
    weeklyViewBtn.classList.remove('active');
    generateDailyTimeline();
    renderDailyTasks();
    displayDate();
    localStorage.setItem('skej-view-mode', 'daily');
}

function showWeeklyView() {
    viewMode = 'weekly';
    timeline.style.display = 'none';
    weeklyView.style.display = 'block';
    dailyViewBtn.classList.remove('active');
    weeklyViewBtn.classList.add('active');
    generateWeeklyView();
    renderWeeklyTasks();
    displayDate();
    localStorage.setItem('skej-view-mode', 'weekly');
}

// Generate daily timeline
function generateDailyTimeline() {
    timeline.innerHTML = '';
    for (let hour = 0; hour < 24; hour++) {
        const slot = document.createElement('div');
        slot.className = 'time-slot';

        const timeLabel = document.createElement('div');
        timeLabel.className = 'time-label';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const ampm = hour < 12 ? 'AM' : 'PM';
        timeLabel.textContent = `${displayHour}:00 ${ampm}`;

        const slotContent = document.createElement('div');
        slotContent.className = 'slot-content';
        slotContent.dataset.hour = hour;
        slotContent.dataset.date = getDateKey(currentDate);
        slotContent.addEventListener('dragover', handleDragOver);
        slotContent.addEventListener('dragleave', handleDragLeave);
        slotContent.addEventListener('drop', handleDrop);

        slot.appendChild(timeLabel);
        slot.appendChild(slotContent);
        timeline.appendChild(slot);
    }
}

// Generate weekly view
function generateWeeklyView() {
    const weekDates = getWeekDates(currentWeekStart);

    // Header
    weekHeader.innerHTML = '<div class="week-header-cell"></div>';
    weekDates.forEach(date => {
        const cell = document.createElement('div');
        cell.className = 'week-header-cell' + (isToday(date) ? ' today' : '');
        cell.innerHTML = `
      <span class="week-header-day">${DAYS[date.getDay()]}</span>
      ${date.getDate()}
    `;
        weekHeader.appendChild(cell);
    });

    // Grid (full 24 hours)
    weekGrid.innerHTML = '';
    for (let hour = 0; hour < 24; hour++) {
        // Time label
        const timeLabel = document.createElement('div');
        timeLabel.className = 'week-time-label';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const ampm = hour < 12 ? 'AM' : 'PM';
        timeLabel.textContent = `${displayHour}${ampm}`;
        weekGrid.appendChild(timeLabel);

        // Day cells
        weekDates.forEach(date => {
            const cell = document.createElement('div');
            cell.className = 'week-cell';
            cell.dataset.hour = hour;
            cell.dataset.date = getDateKey(date);
            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('dragleave', handleDragLeave);
            cell.addEventListener('drop', handleDrop);
            weekGrid.appendChild(cell);
        });
    }
}

// Navigation
function goToPrev() {
    if (viewMode === 'weekly') {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        generateWeeklyView();
        renderWeeklyTasks();
    } else {
        currentDate.setDate(currentDate.getDate() - 1);
        generateDailyTimeline();
        renderDailyTasks();
    }
    displayDate();
}

function goToNext() {
    if (viewMode === 'weekly') {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        generateWeeklyView();
        renderWeeklyTasks();
    } else {
        currentDate.setDate(currentDate.getDate() + 1);
        generateDailyTimeline();
        renderDailyTasks();
    }
    displayDate();
}

function goToDate(date) {
    currentDate = new Date(date);
    currentWeekStart = getWeekStart(currentDate);
    if (viewMode === 'weekly') {
        generateWeeklyView();
        renderWeeklyTasks();
    } else {
        generateDailyTimeline();
        renderDailyTasks();
    }
    displayDate();
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    prevBtn.addEventListener('click', (e) => { e.preventDefault(); goToPrev(); });
    nextBtn.addEventListener('click', (e) => { e.preventDefault(); goToNext(); });

    dateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof datePicker.showPicker === 'function') {
            datePicker.showPicker();
        } else {
            datePicker.click();
        }
    });

    datePicker.addEventListener('change', (e) => {
        if (e.target.value) {
            goToDate(new Date(e.target.value + 'T12:00:00'));
        }
    });

    // Settings Modal
    infoBtn.addEventListener('click', () => {
        infoModal.classList.add('open');
        aiContextInput.value = aiContext;
        // Update toggle buttons to reflect current state
        if (viewMode === 'weekly') {
            weeklyViewBtn.classList.add('active');
            dailyViewBtn.classList.remove('active');
        } else {
            dailyViewBtn.classList.add('active');
            weeklyViewBtn.classList.remove('active');
        }
    });

    closeModal.addEventListener('click', () => infoModal.classList.remove('open'));
    infoModal.addEventListener('click', (e) => {
        if (e.target === infoModal) infoModal.classList.remove('open');
    });

    // View toggle
    dailyViewBtn.addEventListener('click', () => {
        showDailyView();
    });

    weeklyViewBtn.addEventListener('click', () => {
        showWeeklyView();
    });

    saveContextBtn.addEventListener('click', () => {
        aiContext = aiContextInput.value;
        localStorage.setItem('skej-context', aiContext);
        infoModal.classList.remove('open');
    });

    // Task Modal
    closeTaskModal.addEventListener('click', () => {
        taskModal.classList.remove('open');
        selectedTaskId = null;
        selectedTaskDate = null;
    });

    taskModal.addEventListener('click', (e) => {
        if (e.target === taskModal) {
            taskModal.classList.remove('open');
            selectedTaskId = null;
            selectedTaskDate = null;
        }
    });

    deleteTaskBtn.addEventListener('click', () => {
        if (selectedTaskId !== null && selectedTaskDate) {
            deleteTask(selectedTaskId, selectedTaskDate);
            taskModal.classList.remove('open');
            selectedTaskId = null;
            selectedTaskDate = null;
        }
    });

    // Mic button
    micBtn.addEventListener('click', toggleRecording);
}

// Format time helper
function formatTime(h, m) {
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? 'AM' : 'PM';
    return `${displayHour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// Open task details modal
function openTaskModal(taskId, dateKey) {
    const tasks = allTasks[dateKey] || [];
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    selectedTaskId = taskId;
    selectedTaskDate = dateKey;
    taskModalTitle.textContent = task.text;

    const startHour = task.hour;
    const startMinute = task.minute || 0;
    const duration = task.duration || 60;
    const endMinutes = startHour * 60 + startMinute + duration;
    const endHour = Math.floor(endMinutes / 60) % 24;
    const endMinute = endMinutes % 60;

    const dateObj = new Date(dateKey + 'T12:00:00');
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    taskTimeInfo.textContent = `${dayName} • ${formatTime(startHour, startMinute)} - ${formatTime(endHour, endMinute)} (${duration} min)`;

    renderSubtasks(task);
    taskModal.classList.add('open');
}

// Render subtasks
function renderSubtasks(task) {
    subtasksList.innerHTML = '';
    if (!task.subtasks || task.subtasks.length === 0) {
        subtasksList.innerHTML = '<p style="color: #999; font-size: 14px;">No subtasks</p>';
        return;
    }

    if (!task.subtasksCompleted) {
        task.subtasksCompleted = new Array(task.subtasks.length).fill(false);
    }

    task.subtasks.forEach((subtask, index) => {
        const item = document.createElement('div');
        item.className = 'subtask-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'subtask-checkbox';
        checkbox.checked = task.subtasksCompleted[index] || false;
        checkbox.addEventListener('change', () => {
            task.subtasksCompleted[index] = checkbox.checked;
            text.classList.toggle('completed', checkbox.checked);
            saveToStorage();
            renderAllTasks();
        });

        const text = document.createElement('span');
        text.className = 'subtask-text' + (checkbox.checked ? ' completed' : '');
        text.textContent = subtask;

        item.appendChild(checkbox);
        item.appendChild(text);
        subtasksList.appendChild(item);
    });
}

// Audio Recording
async function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        await startRecording();
    }
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            stream.getTracks().forEach(track => track.stop());
            await sendAudioToAI(audioBlob);
        };

        mediaRecorder.start();
        isRecording = true;
        micBtn.classList.add('recording');
        voiceStatus.textContent = 'Recording... Click to stop';
    } catch (error) {
        console.error('Error accessing microphone:', error);
        voiceStatus.textContent = 'Microphone access denied';
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        isRecording = false;
        micBtn.classList.remove('recording');
        voiceStatus.textContent = 'Processing...';
    }
}

// Send audio to AI
async function sendAudioToAI(audioBlob) {
    try {
        voiceStatus.textContent = 'AI is thinking...';
        micBtn.disabled = true;

        let existingTasksForAI = [];
        let historicalTasks = [];
        let dateContext = '';

        // Get historical tasks from past 2 weeks for pattern recognition
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        Object.keys(allTasks).forEach(dateKey => {
            const taskDate = new Date(dateKey + 'T12:00:00');
            const tasks = allTasks[dateKey] || [];

            // Skip if no tasks
            if (tasks.length === 0) return;

            // Check if this is in the current view range
            const isCurrentRange = viewMode === 'weekly'
                ? isDateInWeek(taskDate, currentWeekStart)
                : getDateKey(taskDate) === getDateKey(currentDate);

            if (isCurrentRange) {
                // Current tasks for editing
                tasks.forEach(t => {
                    existingTasksForAI.push({
                        id: t.id,
                        date: dateKey,
                        dayName: taskDate.toLocaleDateString('en-US', { weekday: 'long' }),
                        text: t.text,
                        hour: t.hour,
                        minute: t.minute || 0,
                        duration: t.duration || 60
                    });
                });
            } else if (taskDate >= twoWeeksAgo && taskDate < new Date()) {
                // Historical tasks for pattern learning
                tasks.forEach(t => {
                    historicalTasks.push({
                        date: dateKey,
                        dayOfWeek: taskDate.toLocaleDateString('en-US', { weekday: 'long' }),
                        text: t.text,
                        hour: t.hour,
                        duration: t.duration || 60
                    });
                });
            }
        });

        if (viewMode === 'weekly') {
            dateContext = `Week of ${formatWeekDisplay(currentWeekStart)}`;
        } else {
            dateContext = formatDateDisplay(currentDate);
        }

        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('context', aiContext);
        formData.append('existingTasks', JSON.stringify(existingTasksForAI));
        formData.append('historicalTasks', JSON.stringify(historicalTasks));
        formData.append('date', dateContext);
        formData.append('viewMode', viewMode);

        if (viewMode === 'weekly') {
            // Send current week dates
            formData.append('weekDates', JSON.stringify(getWeekDates(currentWeekStart).map(d => ({
                date: getDateKey(d),
                dayName: d.toLocaleDateString('en-US', { weekday: 'long' })
            }))));

            // Also send next week dates for "next week" scheduling
            const nextWeekStart = new Date(currentWeekStart);
            nextWeekStart.setDate(nextWeekStart.getDate() + 7);
            formData.append('nextWeekDates', JSON.stringify(getWeekDates(nextWeekStart).map(d => ({
                date: getDateKey(d),
                dayName: d.toLocaleDateString('en-US', { weekday: 'long' })
            }))));
        }

        const response = await fetch(`${API_URL}/api/schedule`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.details || error.error || 'API error');
        }

        const data = await response.json();
        console.log('AI response:', data);

        if (data.operations && Array.isArray(data.operations)) {
            let addCount = 0, updateCount = 0, deleteCount = 0;

            data.operations.forEach(op => {
                // Determine target date
                let targetDate = viewMode === 'weekly'
                    ? (op.date || op.task?.date || getDateKey(currentWeekStart))
                    : getDateKey(currentDate);

                if (op.action === 'add' && op.task) {
                    if (op.task.date) targetDate = op.task.date;
                    addTaskToDate(targetDate, op.task.text, op.task.hour, op.task.minute || 0, op.task.duration || 60, op.task.subtasks || []);
                    addCount++;
                } else if (op.action === 'update' && op.id !== undefined) {
                    if (op.date) targetDate = op.date;
                    updateTaskInDate(targetDate, op.id, op.changes || {});
                    updateCount++;
                } else if (op.action === 'delete' && op.id !== undefined) {
                    if (op.date) targetDate = op.date;
                    deleteTaskFromDate(targetDate, op.id);
                    deleteCount++;
                }
            });

            voiceStatus.textContent = data.message || `Done: ${addCount} added, ${updateCount} updated, ${deleteCount} deleted`;
        } else if (data.tasks && Array.isArray(data.tasks)) {
            data.tasks.forEach(task => {
                const targetDate = task.date || getDateKey(currentDate);
                addTaskToDate(targetDate, task.text, task.hour, task.minute || 0, task.duration || 60, task.subtasks || []);
            });
            voiceStatus.textContent = data.message || `Added ${data.tasks.length} task(s)`;
        }

        renderAllTasks();

    } catch (error) {
        console.error('Error sending to AI:', error);
        voiceStatus.textContent = `Error: ${error.message}`;
    } finally {
        micBtn.disabled = false;
        setTimeout(() => { voiceStatus.textContent = 'Click to speak'; }, 3000);
    }
}

// Task operations with date
function addTaskToDate(dateKey, text, hour = 8, minute = 0, duration = 60, subtasks = []) {
    const task = {
        id: taskIdCounter++,
        text, hour, minute, duration, subtasks,
        subtasksCompleted: new Array(subtasks.length).fill(false)
    };
    if (!allTasks[dateKey]) allTasks[dateKey] = [];
    allTasks[dateKey].push(task);
    saveToStorage();
}

function updateTaskInDate(dateKey, taskId, changes) {
    const tasks = allTasks[dateKey] || [];
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (changes.text !== undefined) task.text = changes.text;
    if (changes.hour !== undefined) task.hour = changes.hour;
    if (changes.minute !== undefined) task.minute = changes.minute;
    if (changes.duration !== undefined) task.duration = changes.duration;
    if (changes.subtasks !== undefined) {
        task.subtasks = changes.subtasks;
        task.subtasksCompleted = new Array(changes.subtasks.length).fill(false);
    }
    saveToStorage();
}

function deleteTaskFromDate(dateKey, taskId) {
    if (!allTasks[dateKey]) return;
    allTasks[dateKey] = allTasks[dateKey].filter(t => t.id !== taskId);
    saveToStorage();
}

function deleteTask(taskId, dateKey) {
    deleteTaskFromDate(dateKey, taskId);
    renderAllTasks();
}

// Render tasks
function renderAllTasks() {
    if (viewMode === 'weekly') {
        renderWeeklyTasks();
    } else {
        renderDailyTasks();
    }
}

function renderDailyTasks() {
    document.querySelectorAll('.slot-content').forEach(slot => slot.innerHTML = '');
    const tasks = getCurrentTasks();
    tasks.forEach(task => {
        if (task.hour !== null && task.hour !== undefined) {
            const slot = document.querySelector(`.slot-content[data-hour="${task.hour}"][data-date="${getDateKey(currentDate)}"]`);
            if (slot) renderTaskElement(task, slot, getDateKey(currentDate), SLOT_HEIGHT);
        }
    });
}

function renderWeeklyTasks() {
    document.querySelectorAll('.week-cell').forEach(cell => cell.innerHTML = '');
    const weekDates = getWeekDates(currentWeekStart);
    weekDates.forEach(date => {
        const dateKey = getDateKey(date);
        const tasks = allTasks[dateKey] || [];
        tasks.forEach(task => {
            if (task.hour !== null && task.hour !== undefined) {
                const cell = document.querySelector(`.week-cell[data-hour="${task.hour}"][data-date="${dateKey}"]`);
                if (cell) renderTaskElement(task, cell, dateKey, WEEK_SLOT_HEIGHT);
            }
        });
    });
}

function renderTaskElement(task, container, dateKey, slotHeight) {
    const taskEl = document.createElement('div');
    taskEl.className = 'task';
    taskEl.draggable = true;
    taskEl.dataset.taskId = task.id;
    taskEl.dataset.date = dateKey;

    const minute = task.minute || 0;
    const duration = task.duration || 60;
    const topOffset = (minute / 60) * slotHeight;
    const height = Math.max(16, (duration / 60) * slotHeight - 2);

    taskEl.style.top = `${topOffset}px`;
    taskEl.style.height = `${height}px`;

    const nameEl = document.createElement('div');
    nameEl.className = 'task-name';
    nameEl.textContent = task.text;
    taskEl.appendChild(nameEl);

    if (height >= 28 && slotHeight === SLOT_HEIGHT) {
        const timeEl = document.createElement('div');
        timeEl.className = 'task-time';
        timeEl.textContent = formatTime(task.hour, minute);
        taskEl.appendChild(timeEl);
    }

    taskEl.addEventListener('click', () => {
        if (!taskEl.classList.contains('dragging')) {
            openTaskModal(task.id, dateKey);
        }
    });

    taskEl.addEventListener('dragstart', handleDragStart);
    taskEl.addEventListener('dragend', handleDragEnd);

    container.appendChild(taskEl);
}

// Drag handlers
function handleDragStart(e) {
    e.target.classList.add('dragging');
    e.dataTransfer.setData('taskId', e.target.dataset.taskId);
    e.dataTransfer.setData('sourceDate', e.target.dataset.date);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const taskId = parseInt(e.dataTransfer.getData('taskId'));
    const sourceDate = e.dataTransfer.getData('sourceDate');
    const targetDate = e.currentTarget.dataset.date;
    const targetHour = parseInt(e.currentTarget.dataset.hour);

    const slotHeight = viewMode === 'weekly' ? WEEK_SLOT_HEIGHT : SLOT_HEIGHT;
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const minute = Math.floor((relativeY / slotHeight) * 60);
    const snappedMinute = Math.round(minute / 15) * 15;

    // Find and move task
    const sourceTasks = allTasks[sourceDate] || [];
    const taskIndex = sourceTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const task = sourceTasks[taskIndex];
    task.hour = targetHour;
    task.minute = Math.min(45, Math.max(0, snappedMinute));

    // Move to different day if needed
    if (sourceDate !== targetDate) {
        sourceTasks.splice(taskIndex, 1);
        if (!allTasks[targetDate]) allTasks[targetDate] = [];
        allTasks[targetDate].push(task);
    }

    saveToStorage();
    renderAllTasks();
}

// Storage
function saveToStorage() {
    localStorage.setItem('skej-all-tasks', JSON.stringify(allTasks));
    localStorage.setItem('skej-counter', taskIdCounter.toString());
}

function loadFromStorage() {
    const savedAllTasks = localStorage.getItem('skej-all-tasks');
    const savedCounter = localStorage.getItem('skej-counter');
    const savedContext = localStorage.getItem('skej-context');
    const savedViewMode = localStorage.getItem('skej-view-mode');

    // Migrate old format
    const oldTasks = localStorage.getItem('skej-tasks');
    if (oldTasks && !savedAllTasks) {
        const todayKey = getDateKey(new Date());
        allTasks[todayKey] = JSON.parse(oldTasks);
        localStorage.removeItem('skej-tasks');
        saveToStorage();
    } else if (savedAllTasks) {
        allTasks = JSON.parse(savedAllTasks);
    }

    if (savedCounter) taskIdCounter = parseInt(savedCounter);
    if (savedContext) aiContext = savedContext;
    if (savedViewMode) viewMode = savedViewMode;
}

// API
window.skej = {
    addTask: (text, hour, minute, duration, subtasks) => {
        addTaskToDate(getDateKey(currentDate), text, hour, minute, duration, subtasks);
        renderAllTasks();
    },
    getTasks: getCurrentTasks,
    getContext: () => aiContext,
    goToDate,
    setView: (mode) => mode === 'weekly' ? showWeeklyView() : showDailyView(),
    clearTasks: () => {
        if (viewMode === 'weekly') {
            getWeekDates(currentWeekStart).forEach(d => allTasks[getDateKey(d)] = []);
        } else {
            setCurrentTasks([]);
        }
        renderAllTasks();
        saveToStorage();
    }
};

init();
