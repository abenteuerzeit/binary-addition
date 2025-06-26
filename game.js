const bitValues = [128, 64, 32, 16, 8, 4, 2, 1];
let target = 0;
let currentSum = 0;

let isDragging = false;
let dragStartPos = null;
let currentButton = null;
let lastButton = null;
let dragHistory = [];
let dragDirection = null;
let touchStartTime = 0;
let isMouseInteraction = false;

const container = document.querySelector(".game-container");
const bitsContainer = document.querySelector(".bits");
const targetEl = document.getElementById("target-number");
const sumEl = document.getElementById("current-sum");
const feedbackEl = document.getElementById("feedback");
const checkBtn = document.getElementById("check-btn");
const nextBtn = document.getElementById("next-btn");
const hardModeCheckbox = document.getElementById("hard-mode");
const modeLabel = document.getElementById("mode-label");
const canvas = document.getElementById("trail-canvas");
const ctx = canvas.getContext("2d");
const dragIndicator = document.getElementById("drag-indicator");

let fadeTimeout = null;

const difficultyTimes = {
  easy: 15,
  normal: 10,
  hard: 5,
  god: 3,
  custom: 10,
};
let currentDifficulty = "easy";
let timeLimit = difficultyTimes[currentDifficulty];
let timeLeft = timeLimit;
let timerInterval = null;

let correctCount = 0;
let incorrectCount = 0;
let streak = 0;
const correctCountEl = document.getElementById("correct-count");
const incorrectCountEl = document.getElementById("incorrect-count");
const streakCountEl = document.getElementById("streak-count");
const timerBar = document.getElementById("timer-bar");

const difficultyRadios = document.querySelectorAll('input[name="difficulty"]');
const customTimeInput = document.getElementById("custom-time-input");
const customRadio = document.getElementById("custom-radio");

const failedQuestions = [];
let questionsSinceLastFailed = 0;
const RETRY_FAILED_AFTER_N_NEW = 3;

const hamburgerMenu = document.getElementById("hamburger-menu");
const settingsMenuContent = document.getElementById("settings-menu-content");
const startScreen = document.getElementById("start-screen");
const startButton = document.getElementById("start-button");

const resizeCanvas = () => {
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
};
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

const toCanvas = (x, y) => {
  const rect = canvas.getBoundingClientRect();
  return { x: x - rect.left, y: y - rect.top };
};

let trailPoints = [];
const maxTrailPoints = 30;

const addTrailPoint = (x, y) => {
  const point = toCanvas(x, y);
  trailPoints.push({ ...point, timestamp: Date.now() });
  if (trailPoints.length > maxTrailPoints) {
    trailPoints.shift();
  }
  drawTrail();
};

const drawTrail = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (trailPoints.length < 2) return;

  const now = Date.now();

  for (let i = 1; i < trailPoints.length; i++) {
    const prev = trailPoints[i - 1];
    const curr = trailPoints[i];

    const age = now - curr.timestamp;
    const opacity = Math.max(0, 1 - age / 2000);

    if (opacity <= 0) continue;

    const progress = i / trailPoints.length;
    const width = 2 + progress * 4;

    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.lineWidth = width;

    const color =
      dragDirection === "left-to-right"
        ? `rgba(169, 220, 118, ${opacity})`
        : `rgba(255, 97, 136, ${opacity})`;

    ctx.strokeStyle = color;
    ctx.stroke();
  }
};

const startTrailFade = () => {
  if (fadeTimeout) clearTimeout(fadeTimeout);

  const fadeTrail = () => {
    const now = Date.now();
    trailPoints = trailPoints.filter((point) => now - point.timestamp < 2000);

    if (trailPoints.length > 0) {
      drawTrail();
      fadeTimeout = setTimeout(fadeTrail, 50);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  fadeTimeout = setTimeout(fadeTrail, 50);
};

const toggle = (btn) => {
  btn.classList.toggle("active");
  btn.classList.add("pulse");
  setTimeout(() => btn.classList.remove("pulse"), 400);
  updateSum();
};

const updateSum = () => {
  currentSum = Array.from(
    bitsContainer.querySelectorAll("button.active"),
  ).reduce((sum, btn) => sum + parseInt(btn.dataset.value), 0);
  sumEl.textContent = currentSum;
  sumEl.classList.add("pulse");
  setTimeout(() => sumEl.classList.remove("pulse"), 300);
};

const getButtonAt = (x, y) => {
  let element = document.elementFromPoint(x, y);
  if (
    element &&
    element.tagName === "BUTTON" &&
    bitsContainer.contains(element)
  ) {
    return element;
  }

  const offsets = [-10, 10, -20, 20];
  for (let dx of offsets) {
    for (let dy of offsets) {
      const el = document.elementFromPoint(x + dx, y + dy);
      if (el && el.tagName === "BUTTON" && bitsContainer.contains(el)) {
        return el;
      }
    }
  }
  return null;
};

const detectDragDirection = (currentPos) => {
  if (!dragStartPos || trailPoints.length < 2) return null;

  const deltaX = currentPos.x - dragStartPos.x;
  const threshold = isMouseInteraction ? 20 : 15;

  if (Math.abs(deltaX) < threshold) return null;

  return deltaX > 0 ? "left-to-right" : "right-to-left";
};

const updateDragIndicator = (direction) => {
  if (direction === "left-to-right") {
    dragIndicator.textContent = "→ ON";
    dragIndicator.style.color = "#a9dc76";
  } else if (direction === "right-to-left") {
    dragIndicator.textContent = "← OFF";
    dragIndicator.style.color = "#ff6188";
  }
  dragIndicator.classList.add("show");
};

const clearHoverStates = () => {
  bitsContainer.querySelectorAll("button").forEach((btn) => {
    btn.classList.remove("hover-on", "hover-off");
  });
};

const newQuestion = () => {
  stopTimer();

  if (
    failedQuestions.length > 0 &&
    questionsSinceLastFailed >= RETRY_FAILED_AFTER_N_NEW
  ) {
    target = failedQuestions.shift();
    questionsSinceLastFailed = 0;
    feedbackEl.textContent = "Retry this one!";
    feedbackEl.className = "feedback";
  } else {
    target = Math.floor(Math.random() * 256);
    questionsSinceLastFailed++;
  }

  targetEl.textContent = target;
  targetEl.classList.add("pulse");
  setTimeout(() => targetEl.classList.remove("pulse"), 400);

  bitsContainer.querySelectorAll("button").forEach((btn) => {
    btn.classList.remove("active", "hover-on", "hover-off");
  });
  currentSum = 0;
  sumEl.textContent = 0;
  feedbackEl.textContent = "";
  feedbackEl.className = "feedback";
  checkBtn.disabled = false;
  nextBtn.disabled = true;

  startTimer();
};

bitValues.forEach((value, index) => {
  const btn = document.createElement("button");
  btn.textContent = value;
  btn.dataset.value = value;
  btn.dataset.index = index;
  btn.disabled = true;
  bitsContainer.appendChild(btn);

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isDragging) {
      toggle(btn);
    }
  });

  btn.addEventListener("mouseenter", () => {
    if (!isDragging && !("ontouchstart" in window)) {
      btn.classList.add("hover-on");
    }
  });

  btn.addEventListener("mouseleave", () => {
    if (!isDragging) {
      btn.classList.remove("hover-on", "hover-off");
    }
  });
});

const startDrag = (x, y, isMouse = false) => {
  if (!startScreen.classList.contains("hidden")) return;

  isDragging = true;
  isMouseInteraction = isMouse;
  dragStartPos = { x, y };
  currentButton = getButtonAt(x, y);
  lastButton = currentButton;
  dragHistory = [];
  dragDirection = null;
  touchStartTime = Date.now();

  trailPoints = [];
  addTrailPoint(x, y);
  dragIndicator.classList.remove("show");
};

const continueDrag = (x, y) => {
  if (!isDragging) return;

  addTrailPoint(x, y);

  const btn = getButtonAt(x, y);
  const currentPos = { x, y };

  const newDirection = detectDragDirection(currentPos);
  if (newDirection && newDirection !== dragDirection) {
    dragDirection = newDirection;
    updateDragIndicator(dragDirection);
  }

  clearHoverStates();

  if (btn && btn !== lastButton && dragDirection) {
    if (dragDirection === "left-to-right") {
      if (!btn.classList.contains("active")) {
        toggle(btn);
        dragHistory.push(btn);
      }
    } else if (dragDirection === "right-to-left") {
      if (btn.classList.contains("active")) {
        toggle(btn);
        const historyIndex = dragHistory.indexOf(btn);
        if (historyIndex > -1) {
          dragHistory.splice(historyIndex, 1);
        }
      }
    }
    lastButton = btn;
  }

  if (btn && dragDirection) {
    if (dragDirection === "left-to-right") {
      if (!btn.classList.contains("active")) {
        btn.classList.add("hover-on");
      }
    } else if (dragDirection === "right-to-left") {
      if (btn.classList.contains("active")) {
        btn.classList.add("hover-off");
      }
    }
  }
  currentButton = btn;
};

const endDrag = (x, y) => {
  if (!isDragging) return;

  const interactionDuration = Date.now() - touchStartTime;
  const btn = getButtonAt(x, y);

  if (
    interactionDuration < 200 &&
    btn &&
    btn === currentButton &&
    trailPoints.length < 3
  ) {
    toggle(btn);
  }

  isDragging = false;
  isMouseInteraction = false;
  dragStartPos = null;
  currentButton = null;
  lastButton = null;
  dragHistory = [];
  dragDirection = null;
  clearHoverStates();
  dragIndicator.classList.remove("show");

  startTrailFade();
};

container.addEventListener("mousedown", (e) => {
  if (e.button === 0) {
    e.preventDefault();
    startDrag(e.clientX, e.clientY, true);
  }
});

document.addEventListener("mousemove", (e) => {
  if (isDragging && isMouseInteraction) {
    e.preventDefault();
    continueDrag(e.clientX, e.clientY);
  }
});

document.addEventListener("mouseup", (e) => {
  if (isDragging && isMouseInteraction) {
    endDrag(e.clientX, e.clientY);
  }
});

container.addEventListener(
  "touchstart",
  (e) => {
    if (e.target === startButton) {
      return;
    }

    e.preventDefault();

    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY, false);
  },
  { passive: false },
);

container.addEventListener(
  "touchmove",
  (e) => {
    if (isDragging && !isMouseInteraction) {
      e.preventDefault();
      const touch = e.touches[0];
      continueDrag(touch.clientX, touch.clientY);
    }
  },
  { passive: false },
);

container.addEventListener(
  "touchend",
  (e) => {
    if (e.target === startButton) {
      return;
    }

    if (isDragging) {
      e.preventDefault();
    }

    if (isDragging && !isMouseInteraction) {
      const touch = e.changedTouches[0];
      endDrag(touch.clientX, touch.clientY);
    }
  },
  { passive: false },
);

const checkAnswer = () => {
  if (checkBtn.disabled) return;

  stopTimer();

  const isCorrect = currentSum === target;
  if (isCorrect) {
    feedbackEl.textContent = "Correct!";
    feedbackEl.className = "feedback correct";
    correctCount++;
    streak++;
    questionsSinceLastFailed = 0;
    bitsContainer.querySelectorAll("button.active").forEach((btn, index) => {
      setTimeout(() => btn.classList.add("pulse"), index * 100);
    });
  } else {
    feedbackEl.textContent = `Wrong! You got ${currentSum}, target was ${target}`;
    feedbackEl.className = "feedback incorrect";
    incorrectCount++;
    streak = 0;
    if (!failedQuestions.includes(target)) {
      failedQuestions.push(target);
    }
  }
  updateStats();
  checkBtn.disabled = true;
  nextBtn.disabled = false;
};

const updateStats = () => {
  correctCountEl.textContent = correctCount;
  incorrectCountEl.textContent = incorrectCount;
  streakCountEl.textContent = streak;
};

const startTimer = () => {
  timeLeft = timeLimit;
  timerBar.style.width = "100%";
  timerBar.style.background = "linear-gradient(90deg, #a9dc76, #78dce8)";
  clearTimeout(timerInterval);

  timerInterval = setInterval(() => {
    timeLeft -= 0.1;
    if (timeLeft <= 0) {
      stopTimer();
      timeLeft = 0;
      checkAnswer();
    }
    const percentage = (timeLeft / timeLimit) * 100;
    timerBar.style.width = `${percentage}%`;
    if (percentage < 30) {
      timerBar.style.background = "linear-gradient(90deg, #ff6188, #ab9df2)";
    } else if (percentage < 60) {
      timerBar.style.background = "linear-gradient(90deg, #fd935d, #a9dc76)";
    }
  }, 100);
};

const stopTimer = () => {
  clearInterval(timerInterval);
  timerInterval = null;
};

startButton.addEventListener("click", () => {
  startScreen.classList.add("hidden");
  bitsContainer.querySelectorAll("button").forEach((btn) => {
    btn.disabled = false;
  });
  newQuestion();
});

checkBtn.addEventListener("click", checkAnswer);

nextBtn.addEventListener("click", newQuestion);

document.addEventListener("keydown", (e) => {
  if (!startScreen.classList.contains("hidden")) return;

  if (e.key >= "1" && e.key <= "8") {
    const index = parseInt(e.key) - 1;
    const button = bitsContainer.querySelector(`[data-index="${index}"]`);
    if (button) {
      toggle(button);
    }
  } else if (e.key === "Enter") {
    if (!checkBtn.disabled) {
      checkAnswer();
    }
  } else if (e.key === " ") {
    e.preventDefault();
    if (!nextBtn.disabled) {
      newQuestion();
    }
  }
});

hardModeCheckbox.addEventListener("change", (e) => {
  if (e.target.checked) {
    container.classList.add("hard");
    modeLabel.textContent = "Cortical memory ENABLED (volatile)";
  } else {
    container.classList.remove("hard");
    modeLabel.textContent = "Enable cortical memory (volatile)";
  }
});

difficultyRadios.forEach((radio) => {
  radio.addEventListener("change", (e) => {
    currentDifficulty = e.target.value;
    if (currentDifficulty === "custom") {
      customTimeInput.disabled = false;
      timeLimit = parseInt(customTimeInput.value);
    } else {
      customTimeInput.disabled = true;
      timeLimit = difficultyTimes[currentDifficulty];
    }
  });
});

customTimeInput.addEventListener("input", (e) => {
  let value = parseInt(e.target.value);
  if (isNaN(value) || value < 1) {
    value = 1;
  } else if (value > 60) {
    value = 60;
  }
  e.target.value = value;
  timeLimit = value;
});

hamburgerMenu.addEventListener("click", () => {
  hamburgerMenu.classList.toggle("is-active");
  settingsMenuContent.classList.toggle("is-active");
});

updateStats();
