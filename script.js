"use strict";

const BOARD_SIZE = 8;
const ROUND_SECONDS = 60;
const HIGH_SCORE_KEY = "apple-number-puzzle-high-score";

const board = document.querySelector("#board");
const scoreDisplay = document.querySelector("#score");
const bestScoreDisplay = document.querySelector("#best-score");
const timerDisplay = document.querySelector("#timer");
const timerCard = document.querySelector(".timer-card");
const overlay = document.querySelector("#overlay");
const overlayMessage = document.querySelector("#overlay-message");
const startButton = document.querySelector("#start-button");
const confettiLayer = document.querySelector("#confetti-layer");
const selectionHint = document.querySelector("#selection-hint");
const selectionTotal = document.querySelector("#selection-total strong");
const statusMessage = document.querySelector("#status-message");

if (
  !(board instanceof HTMLElement) ||
  !(scoreDisplay instanceof HTMLElement) ||
  !(bestScoreDisplay instanceof HTMLElement) ||
  !(timerDisplay instanceof HTMLElement) ||
  !(timerCard instanceof HTMLElement) ||
  !(overlay instanceof HTMLElement) ||
  !(overlayMessage instanceof HTMLElement) ||
  !(startButton instanceof HTMLButtonElement) ||
  !(confettiLayer instanceof HTMLElement) ||
  !(selectionHint instanceof HTMLElement) ||
  !(selectionTotal instanceof HTMLElement) ||
  !(statusMessage instanceof HTMLElement)
) {
  throw new Error("게임 화면에 필요한 요소를 찾을 수 없습니다.");
}

let cells = [];
let selectedIndices = [];
let score = 0;
let bestScore = loadBestScore();
let isPlaying = false;
let isSelecting = false;
let endTime = 0;
let timerInterval = 0;
let confettiTimeout = 0;

bestScoreDisplay.textContent = String(bestScore);
createBoard();
updateBoardState();
renderTimer(ROUND_SECONDS);

function loadBestScore() {
  try {
    const storedScore = Number(window.localStorage.getItem(HIGH_SCORE_KEY) ?? 0);
    if (Number.isFinite(storedScore) && storedScore >= 0) {
      return Math.floor(storedScore);
    }
    statusMessage.textContent = "저장된 최고 점수 기록을 읽을 수 없습니다.";
  } catch (error) {
    statusMessage.textContent = "브라우저에서 최고 점수를 불러올 수 없습니다.";
  }
  return 0;
}

function saveBestScore() {
  try {
    window.localStorage.setItem(HIGH_SCORE_KEY, String(bestScore));
  } catch (error) {
    statusMessage.textContent = "브라우저에서 최고 점수를 저장할 수 없습니다.";
  }
}

function createBoard() {
  const fragment = document.createDocumentFragment();
  cells = [];

  for (let index = 0; index < BOARD_SIZE * BOARD_SIZE; index += 1) {
    const cell = document.createElement("button");
    const appleIcon = document.createElement("span");
    const valueDisplay = document.createElement("span");
    const value = randomNumber();
    cell.className = "cell";
    cell.type = "button";
    cell.dataset.index = String(index);
    cell.setAttribute("aria-label", `사과 숫자 ${value}`);
    appleIcon.className = "apple-icon";
    appleIcon.setAttribute("aria-hidden", "true");
    appleIcon.textContent = "🍎";
    valueDisplay.className = "cell-value";
    valueDisplay.textContent = String(value);
    cell.append(appleIcon, valueDisplay);
    cell.addEventListener("animationend", (event) => {
      if (event.animationName === "apple-fall") {
        cell.classList.remove("is-falling");
      }
    });
    cells.push(cell);
    fragment.append(cell);
  }

  board.replaceChildren(fragment);
}

function randomNumber() {
  return Math.floor(Math.random() * 9) + 1;
}

function startGame() {
  window.clearInterval(timerInterval);
  createBoard();
  score = 0;
  selectedIndices = [];
  isSelecting = false;
  isPlaying = true;
  endTime = Date.now() + ROUND_SECONDS * 1000;
  scoreDisplay.textContent = "0";
  statusMessage.textContent = "";
  selectionHint.textContent = "숫자를 이웃한 순서대로 드래그하세요.";
  overlay.classList.add("is-hidden");
  updateSelectionDisplay();
  updateBoardState();
  updateTimer();
  timerInterval = window.setInterval(updateTimer, 100);
}

function updateTimer() {
  const remainingSeconds = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
  renderTimer(remainingSeconds);

  if (remainingSeconds === 0) {
    endGame();
  }
}

function renderTimer(remainingSeconds) {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  timerCard.classList.toggle("is-urgent", remainingSeconds <= 10);
}

function endGame() {
  isPlaying = false;
  isSelecting = false;
  selectedIndices = [];
  window.clearInterval(timerInterval);
  updateSelectionDisplay();
  updateBoardState();
  overlayMessage.textContent = `게임 종료! ${score}점을 얻었어요.`;
  startButton.textContent = "다시 하기";
  overlay.classList.remove("is-hidden");
}

function updateBoardState() {
  for (const cell of cells) {
    cell.disabled = !isPlaying;
  }
}

function getCellFromPoint(x, y) {
  const element = document.elementFromPoint(x, y);
  if (!(element instanceof Element)) {
    return null;
  }
  const cell = element.closest(".cell");
  return cell instanceof HTMLButtonElement && board.contains(cell) ? cell : null;
}

function startSelection(cell) {
  if (!isPlaying || cell.disabled) {
    return;
  }

  isSelecting = true;
  selectedIndices = [Number(cell.dataset.index)];
  selectionHint.textContent = "숫자를 이웃한 순서대로 드래그하세요.";
  updateSelectionDisplay();
}

function extendSelection(cell) {
  if (!isPlaying || !isSelecting || cell.disabled) {
    return;
  }

  const index = Number(cell.dataset.index);
  if (selectedIndices.includes(index)) {
    return;
  }

  const previousIndex = selectedIndices[selectedIndices.length - 1];
  if (!areAdjacent(previousIndex, index)) {
    return;
  }

  selectedIndices.push(index);
  updateSelectionDisplay();
}

function areAdjacent(firstIndex, secondIndex) {
  const firstRow = Math.floor(firstIndex / BOARD_SIZE);
  const firstColumn = firstIndex % BOARD_SIZE;
  const secondRow = Math.floor(secondIndex / BOARD_SIZE);
  const secondColumn = secondIndex % BOARD_SIZE;
  return Math.abs(firstRow - secondRow) + Math.abs(firstColumn - secondColumn) === 1;
}

function finishSelection() {
  if (!isSelecting) {
    return;
  }

  isSelecting = false;
  const total = getSelectionTotal();
  if (selectedIndices.length > 1 && total % 10 === 0) {
    clearSelectedCells(total);
  } else if (selectedIndices.length > 1) {
    selectionHint.textContent = "합계가 10의 배수가 아니에요. 다시 이어보세요.";
    window.setTimeout(() => {
      if (isPlaying && !isSelecting) {
        selectionHint.textContent = "숫자를 이웃한 순서대로 드래그하세요.";
      }
    }, 1300);
  }

  selectedIndices = [];
  updateSelectionDisplay();
}

function getSelectionTotal() {
  return selectedIndices.reduce(
    (total, index) => total + Number(cells[index].querySelector(".cell-value").textContent),
    0,
  );
}

function clearSelectedCells(total) {
  score += total;
  scoreDisplay.textContent = String(score);
  selectionHint.textContent = `합계 ${total}! ${total}점을 얻었어요.`;
  if (score > bestScore) {
    bestScore = score;
    bestScoreDisplay.textContent = String(bestScore);
    saveBestScore();
    showConfetti();
  }

  const clearedIndices = new Set(selectedIndices);
  for (const index of selectedIndices) {
    cells[index].setAttribute("aria-label", "빈칸");
    cells[index].classList.add("is-empty");
    cells[index].disabled = true;
  }
  dropApples(clearedIndices);
}

function dropApples(clearedIndices) {
  for (let column = 0; column < BOARD_SIZE; column += 1) {
    const remainingApples = [];
    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
      const index = row * BOARD_SIZE + column;
      if (!clearedIndices.has(index)) {
        remainingApples.push({
          sourceRow: row,
          value: cells[index].querySelector(".cell-value").textContent,
        });
      }
    }

    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
      const index = row * BOARD_SIZE + column;
      const cell = cells[index];
      const apple = remainingApples.shift();
      const value = apple?.value ?? String(randomNumber());
      cell.querySelector(".cell-value").textContent = value;
      cell.setAttribute("aria-label", `사과 숫자 ${value}`);
      cell.classList.remove("is-empty");
      cell.classList.remove("is-falling");
      if (!apple || apple.sourceRow !== row) {
        void cell.offsetWidth;
        cell.classList.add("is-falling");
      }
      cell.disabled = !isPlaying;
    }
  }
}

function updateSelectionDisplay() {
  const total = getSelectionTotal();
  selectionTotal.textContent = String(total);
  board.classList.toggle("has-valid-sum", selectedIndices.length > 1 && total % 10 === 0);

  for (const [index, cell] of cells.entries()) {
    cell.classList.toggle("is-selected", selectedIndices.includes(index));
  }
}

function showConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const colors = ["#ef6b57", "#f5c04f", "#79a95b", "#7caed0", "#bd83bd", "#f28b50"];
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < 90; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[index % colors.length];
    piece.style.setProperty("--drift", `${Math.random() * 180 - 90}px`);
    piece.style.setProperty("--spin", `${Math.random() * 900 + 360}deg`);
    piece.style.setProperty("--duration", `${Math.random() * 1.5 + 2}s`);
    piece.style.animationDelay = `${Math.random() * 0.35}s`;
    fragment.append(piece);
  }

  window.clearTimeout(confettiTimeout);
  confettiLayer.replaceChildren(fragment);
  confettiTimeout = window.setTimeout(() => confettiLayer.replaceChildren(), 4200);
}

board.addEventListener("pointerdown", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }
  const cell = event.target.closest(".cell");
  if (cell instanceof HTMLButtonElement) {
    event.preventDefault();
    startSelection(cell);
  }
});

window.addEventListener("pointermove", (event) => {
  if (!isSelecting) {
    return;
  }
  const cell = getCellFromPoint(event.clientX, event.clientY);
  if (cell) {
    extendSelection(cell);
  }
});

window.addEventListener("pointerup", finishSelection);
window.addEventListener("pointercancel", finishSelection);
startButton.addEventListener("click", startGame);
