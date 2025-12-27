// State
let allTasks = {}; // { 'YYYY-MM-DD': [tasks] }
let currentDate = new Date();
let taskIdCounter = 0;
let aiContext = '';
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let selectedTaskId = null;

const API_URL = 'http://localhost:3001';
const SLOT_HEIGHT = 60; // pixels per hour slot

// DOM Elements
const timeline = document.getElementById('timeline');
const dateDisplay = document.getElementById('dateDisplay');
const dateBtn = document.getElementById('dateBtn');
const datePicker = document.getElementById('datePicker');
const prevDayBtn = document.getElementById('prevDay');
const nextDayBtn = document.getElementById('nextDay');
const infoBtn = document.getElementById('infoBtn');
const infoModal = document.getElementById('infoModal');
const closeModal = document.getElementById('closeModal');
const aiContextInput = document.getElementById('aiContext');
const saveContextBtn = document.getElementById('saveContext');
const micBtn = document.getElementById('micBtn');
const voiceStatus = document.getElementById('voiceStatus');

// Task Modal Elements  
const taskModal = document.getElementById('taskModal');
const taskModalTitle = document.getElementById('taskModalTitle');
const taskTimeInfo = document.getElementById('taskTimeInfo');
const subtasksList = document.getElementById('subtasksList');
const closeTaskModal = document.getElementById('closeTaskModal');
const deleteTaskBtn = document.getElementById('deleteTaskBtn');

// Get current tasks for selected date
function getCurrentTasks() {
    const key = getDateKey(currentDate);
    return allTasks[key] || [];
}

function setCurrentTasks(tasks) {
    const key = getDateKey(currentDate);
    allTasks[key] = tasks;
}

// Date helpers
function getDateKey(date) {
    return date.toISOString().split('T')[0]; // 'YYYY-MM-DD'
}

function formatDateDisplay(date) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
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

// Initialize
function init() {
    loadFromStorage();
    displayDate();
    generateTimeline();
    renderAllTasks();
    setupEventListeners();
}

// Display current date
function displayDate() {
    if (isToday(currentDate)) {
        dateDisplay.textContent = 'Today';
    } else if (isTomorrow(currentDate)) {
        dateDisplay.textContent = 'Tomorrow';
    } else {
        dateDisplay.textContent = formatDateDisplay(currentDate);
    }
    datePicker.value = getDateKey(currentDate);
}

// Generate 24-hour timeline (hourly slots)
function generateTimeline() {
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

        // Drag and drop events for slot
        slotContent.addEventListener('dragover', handleDragOver);
        slotContent.addEventListener('dragleave', handleDragLeave);
        slotContent.addEventListener('drop', handleDrop);

        slot.appendChild(timeLabel);
        slot.appendChild(slotContent);
        timeline.appendChild(slot);
    }
}

// Navigate to different date
function goToDate(date) {
    currentDate = new Date(date);
    displayDate();
    renderAllTasks();
}

function goToPrevDay() {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    goToDate(newDate);
}

function goToNextDay() {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    goToDate(newDate);
}

// Setup event listeners
function setupEventListeners() {
    // Date navigation
    if (prevDayBtn) {
        prevDayBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Prev day clicked');
            goToPrevDay();
        });
    }

    if (nextDayBtn) {
        nextDayBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Next day clicked');
            goToNextDay();
        });
    }

    if (dateBtn && datePicker) {
        dateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Date button clicked');
            // Try showPicker, fall back to click
            if (typeof datePicker.showPicker === 'function') {
                datePicker.showPicker();
            } else {
                datePicker.click();
            }
        });

        datePicker.addEventListener('change', (e) => {
            console.log('Date changed:', e.target.value);
            if (e.target.value) {
                goToDate(new Date(e.target.value + 'T12:00:00'));
            }
        });
    }

    // Info Modal controls
    infoBtn.addEventListener('click', () => {
        infoModal.classList.add('open');
        aiContextInput.value = aiContext;
    });

    closeModal.addEventListener('click', () => {
        infoModal.classList.remove('open');
    });

    infoModal.addEventListener('click', (e) => {
        if (e.target === infoModal) {
            infoModal.classList.remove('open');
        }
    });

    saveContextBtn.addEventListener('click', () => {
        aiContext = aiContextInput.value;
        localStorage.setItem('skej-context', aiContext);
        infoModal.classList.remove('open');
    });

    // Task Modal controls
    closeTaskModal.addEventListener('click', () => {
        taskModal.classList.remove('open');
        selectedTaskId = null;
    });

    taskModal.addEventListener('click', (e) => {
        if (e.target === taskModal) {
            taskModal.classList.remove('open');
            selectedTaskId = null;
        }
    });

    deleteTaskBtn.addEventListener('click', () => {
        if (selectedTaskId !== null) {
            deleteTask(selectedTaskId);
            taskModal.classList.remove('open');
            selectedTaskId = null;
        }
    });

    // Mic button - record audio
    micBtn.addEventListener('click', toggleRecording);
}

// Format time helper
function formatTime(h, m) {
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? 'AM' : 'PM';
    return `${displayHour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// Open task details modal
function openTaskModal(taskId) {
    const tasks = getCurrentTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    selectedTaskId = taskId;
    taskModalTitle.textContent = task.text;

    // Format time info
    const startHour = task.hour;
    const startMinute = task.minute || 0;
    const duration = task.duration || 60;
    const endMinutes = startHour * 60 + startMinute + duration;
    const endHour = Math.floor(endMinutes / 60) % 24;
    const endMinute = endMinutes % 60;

    taskTimeInfo.textContent = `${formatTime(startHour, startMinute)} - ${formatTime(endHour, endMinute)} (${duration} min)`;

    // Render subtasks
    renderSubtasks(task);

    taskModal.classList.add('open');
}

// Render subtasks with checkboxes
function renderSubtasks(task) {
    subtasksList.innerHTML = '';

    if (!task.subtasks || task.subtasks.length === 0) {
        subtasksList.innerHTML = '<p style="color: #999; font-size: 14px;">No subtasks</p>';
        return;
    }

    // Initialize completed array if not exists
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
            if (e.data.size > 0) {
                audioChunks.push(e.data);
            }
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

// Send audio to AI backend
async function sendAudioToAI(audioBlob) {
    try {
        voiceStatus.textContent = 'AI is thinking...';
        micBtn.disabled = true;

        const tasks = getCurrentTasks();

        // Prepare existing tasks for AI
        const existingTasksForAI = tasks.map(t => ({
            id: t.id,
            text: t.text,
            hour: t.hour,
            minute: t.minute || 0,
            duration: t.duration || 60
        }));

        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('context', aiContext);
        formData.append('existingTasks', JSON.stringify(existingTasksForAI));
        formData.append('date', formatDateDisplay(currentDate));

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

        // Handle operations (new format) or legacy tasks format
        if (data.operations && Array.isArray(data.operations)) {
            let addCount = 0, updateCount = 0, deleteCount = 0;

            data.operations.forEach(op => {
                if (op.action === 'add' && op.task) {
                    addTask(
                        op.task.text,
                        op.task.hour,
                        op.task.minute || 0,
                        op.task.duration || 60,
                        op.task.subtasks || []
                    );
                    addCount++;
                } else if (op.action === 'update' && op.id !== undefined) {
                    updateTask(op.id, op.changes || {});
                    updateCount++;
                } else if (op.action === 'delete' && op.id !== undefined) {
                    deleteTask(op.id);
                    deleteCount++;
                }
            });

            voiceStatus.textContent = data.message ||
                `Done: ${addCount} added, ${updateCount} updated, ${deleteCount} deleted`;
        } else if (data.tasks && Array.isArray(data.tasks)) {
            // Legacy format fallback
            data.tasks.forEach(task => {
                addTask(task.text, task.hour, task.minute || 0, task.duration || 60, task.subtasks || []);
            });
            voiceStatus.textContent = data.message || `Added ${data.tasks.length} task(s)`;
        } else {
            voiceStatus.textContent = 'No changes made';
        }

    } catch (error) {
        console.error('Error sending to AI:', error);
        voiceStatus.textContent = `Error: ${error.message}`;
    } finally {
        micBtn.disabled = false;
        setTimeout(() => {
            voiceStatus.textContent = 'Click to speak';
        }, 3000);
    }
}

// Update an existing task
function updateTask(taskId, changes) {
    const tasks = getCurrentTasks();
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

    setCurrentTasks(tasks);
    renderAllTasks();
    saveToStorage();
}

// Add task with duration and subtasks
function addTask(text, hour = 8, minute = 0, duration = 60, subtasks = []) {
    const task = {
        id: taskIdCounter++,
        text: text,
        hour: hour,
        minute: minute,
        duration: duration,
        subtasks: subtasks,
        subtasksCompleted: new Array(subtasks.length).fill(false)
    };

    const tasks = getCurrentTasks();
    tasks.push(task);
    setCurrentTasks(tasks);
    renderAllTasks();
    saveToStorage();
}

// Render a task element with proper position based on start minute
function renderTask(task, container) {
    const taskEl = document.createElement('div');
    taskEl.className = 'task';
    taskEl.draggable = true;
    taskEl.dataset.taskId = task.id;

    const minute = task.minute || 0;
    const duration = task.duration || 60;

    // Position based on start minute
    const topOffset = (minute / 60) * SLOT_HEIGHT;
    const height = Math.max(18, (duration / 60) * SLOT_HEIGHT - 2);

    taskEl.style.top = `${topOffset}px`;
    taskEl.style.height = `${height}px`;

    // Task content
    const nameEl = document.createElement('div');
    nameEl.className = 'task-name';
    nameEl.textContent = task.text;
    taskEl.appendChild(nameEl);

    // Show time range if there's room
    if (height >= 30) {
        const startHour = task.hour;
        const endMinutes = startHour * 60 + minute + duration;
        const endHour = Math.floor(endMinutes / 60) % 24;
        const endMinute = endMinutes % 60;

        const timeEl = document.createElement('div');
        timeEl.className = 'task-time';
        timeEl.textContent = `${formatTime(startHour, minute)} - ${formatTime(endHour, endMinute)}`;
        taskEl.appendChild(timeEl);
    }

    // Show progress if has subtasks
    if (task.subtasks && task.subtasks.length > 0 && height >= 44) {
        const completed = (task.subtasksCompleted || []).filter(c => c).length;
        const progressEl = document.createElement('div');
        progressEl.className = 'task-progress';
        progressEl.textContent = `${completed}/${task.subtasks.length} done`;
        taskEl.appendChild(progressEl);
    }

    // Click to open details
    taskEl.addEventListener('click', () => {
        if (!taskEl.classList.contains('dragging')) {
            openTaskModal(task.id);
        }
    });

    // Drag events
    taskEl.addEventListener('dragstart', handleDragStart);
    taskEl.addEventListener('dragend', handleDragEnd);

    container.appendChild(taskEl);
}

// Delete a task
function deleteTask(taskId) {
    let tasks = getCurrentTasks();
    tasks = tasks.filter(t => t.id !== taskId);
    setCurrentTasks(tasks);
    renderAllTasks();
    saveToStorage();
}

// Drag handlers
function handleDragStart(e) {
    e.target.classList.add('dragging');
    e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
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

    const taskId = parseInt(e.dataTransfer.getData('text/plain'));
    const hour = parseInt(e.currentTarget.dataset.hour);

    // Calculate minute based on drop position
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const minute = Math.floor((relativeY / SLOT_HEIGHT) * 60);
    const snappedMinute = Math.round(minute / 15) * 15;

    const tasks = getCurrentTasks();
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.hour = hour;
        task.minute = Math.min(45, Math.max(0, snappedMinute));
        setCurrentTasks(tasks);
        renderAllTasks();
        saveToStorage();
    }
}

// Render all tasks for current date
function renderAllTasks() {
    // Clear all slot contents
    document.querySelectorAll('.slot-content').forEach(slot => {
        slot.innerHTML = '';
    });

    const tasks = getCurrentTasks();

    // Render each scheduled task
    tasks.forEach(task => {
        if (task.hour !== null && task.hour !== undefined) {
            const slot = document.querySelector(`.slot-content[data-hour="${task.hour}"]`);
            if (slot) {
                renderTask(task, slot);
            }
        }
    });
}

// Local storage - now saves all dates
function saveToStorage() {
    localStorage.setItem('skej-all-tasks', JSON.stringify(allTasks));
    localStorage.setItem('skej-counter', taskIdCounter.toString());
}

function loadFromStorage() {
    const savedAllTasks = localStorage.getItem('skej-all-tasks');
    const savedCounter = localStorage.getItem('skej-counter');
    const savedContext = localStorage.getItem('skej-context');

    // Migrate old single-day format if exists
    const oldTasks = localStorage.getItem('skej-tasks');
    if (oldTasks && !savedAllTasks) {
        const todayKey = getDateKey(new Date());
        allTasks[todayKey] = JSON.parse(oldTasks);
        localStorage.removeItem('skej-tasks');
        saveToStorage();
    } else if (savedAllTasks) {
        allTasks = JSON.parse(savedAllTasks);
    }

    if (savedCounter) {
        taskIdCounter = parseInt(savedCounter);
    }

    if (savedContext) {
        aiContext = savedContext;
    }
}

// Expose API globally
window.skej = {
    addTask,
    getTasks: getCurrentTasks,
    getContext: () => aiContext,
    goToDate,
    clearTasks: () => {
        setCurrentTasks([]);
        renderAllTasks();
        saveToStorage();
    }
};

// Start
init();
