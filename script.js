const STORAGE_KEY = "wedding-money-ledger-v1";
const BILLS_KEY = "wedding-money-bills-v1";
const SIDE_KEY = "wedding-money-side-v1";
const denominations = [50000, 10000, 5000, 1000, 500, 100, 50, 10];

const form = document.querySelector("#entryForm");
const formTitle = document.querySelector("#formTitle");
const cancelEdit = document.querySelector("#cancelEdit");
const weddingSide = document.querySelector("#weddingSide");
const guestName = document.querySelector("#guestName");
const guestRelation = document.querySelector("#guestRelation");
const giftAmount = document.querySelector("#giftAmount");
const memo = document.querySelector("#memo");
const ledgerBody = document.querySelector("#ledgerBody");
const emptyState = document.querySelector("#emptyState");
const searchInput = document.querySelector("#searchInput");
const sortSelect = document.querySelector("#sortSelect");
const billGrid = document.querySelector("#billGrid");

let entries = loadJson(STORAGE_KEY, []);
let billCounts = loadJson(BILLS_KEY, {});
let editingId = null;

function getSideLabel(value) {
  return value === "bride" ? "신부" : "신랑";
}

function normalizeSide(value) {
  return value === "bride" ? "bride" : "groom";
}

function applySideTheme(value) {
  const side = normalizeSide(value);
  document.body.classList.toggle("side-bride", side === "bride");
  document.body.classList.toggle("side-groom", side === "groom");
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  localStorage.setItem(BILLS_KEY, JSON.stringify(billCounts));
  localStorage.setItem(SIDE_KEY, weddingSide.value);
}

function money(value) {
  return new Intl.NumberFormat("ko-KR").format(value) + "원";
}

function parseAmount(value) {
  const digits = String(value).replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function buildBills() {
  const template = document.querySelector("#billTemplate");
  denominations.forEach((denomination) => {
    const node = template.content.cloneNode(true);
    const label = node.querySelector("span");
    const input = node.querySelector("input");
    label.textContent = money(denomination);
    input.value = billCounts[denomination] || 0;
    input.dataset.denomination = denomination;
    input.addEventListener("input", () => {
      billCounts[denomination] = Math.max(0, Number(input.value) || 0);
      saveState();
      renderSummary();
    });
    billGrid.appendChild(node);
  });
}

function getTotal() {
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

function getCashTotal() {
  return denominations.reduce((sum, denomination) => {
    return sum + denomination * (Number(billCounts[denomination]) || 0);
  }, 0);
}

function renderSummary() {
  const total = getTotal();
  const count = entries.length;
  const cashTotal = getCashTotal();
  const diff = cashTotal - total;

  document.querySelector("#totalAmount").textContent = money(total);
  document.querySelector("#totalCount").textContent = count + "명";
  document.querySelector("#averageAmount").textContent = count ? money(Math.round(total / count)) : "0원";
  document.querySelector("#cashTotal").textContent = money(cashTotal);
  document.querySelector("#cashDifference").textContent = (diff > 0 ? "+" : "") + money(diff);
}

function getVisibleEntries() {
  const keyword = normalizeText(searchInput.value).toLowerCase();
  const filtered = keyword
    ? entries.filter((entry) => {
        return [entry.name, getSideLabel(entry.side), entry.relation, entry.memo]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      })
    : [...entries];

  return filtered.sort((a, b) => {
    if (sortSelect.value === "name") return a.name.localeCompare(b.name, "ko");
    if (sortSelect.value === "amountDesc") return b.amount - a.amount;
    if (sortSelect.value === "amountAsc") return a.amount - b.amount;
    return b.createdAt - a.createdAt;
  });
}

function renderLedger() {
  ledgerBody.innerHTML = "";
  const visibleEntries = getVisibleEntries();
  emptyState.hidden = visibleEntries.length > 0;

  visibleEntries.forEach((entry) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td></td>
      <td></td>
      <td></td>
      <td class="number"></td>
      <td></td>
      <td>
        <div class="row-actions">
          <button type="button" data-action="edit">수정</button>
          <button type="button" data-action="delete">삭제</button>
        </div>
      </td>
    `;
    row.children[0].textContent = entry.name;
    row.children[1].textContent = getSideLabel(entry.side);
    row.children[2].textContent = entry.relation || "-";
    row.children[3].textContent = money(entry.amount);
    row.children[4].textContent = entry.memo || "-";
    row.querySelector('[data-action="edit"]').addEventListener("click", () => startEdit(entry.id));
    row.querySelector('[data-action="delete"]').addEventListener("click", () => deleteEntry(entry.id));
    ledgerBody.appendChild(row);
  });
}

function renderAll() {
  renderSummary();
  renderLedger();
}

function resetForm() {
  const currentSide = weddingSide.value;
  editingId = null;
  form.reset();
  weddingSide.value = currentSide;
  formTitle.textContent = "내역 입력";
  cancelEdit.classList.add("hidden");
  giftAmount.value = "";
  applySideTheme(weddingSide.value);
}

function startEdit(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;

  editingId = id;
  weddingSide.value = normalizeSide(entry.side);
  guestName.value = entry.name;
  guestRelation.value = entry.relation;
  if (!guestRelation.value) guestRelation.value = "그 외";
  giftAmount.value = money(entry.amount).replace("원", "");
  memo.value = entry.memo;
  formTitle.textContent = "내역 수정";
  cancelEdit.classList.remove("hidden");
  applySideTheme(weddingSide.value);
  guestName.focus();
}

function deleteEntry(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry || !confirm(`${entry.name}님의 내역을 삭제할까요?`)) return;
  entries = entries.filter((item) => item.id !== id);
  saveState();
  renderAll();
}

function exportCsv() {
  if (!entries.length) {
    alert("내보낼 내역이 없습니다.");
    return;
  }

  const headers = ["이름", "구분", "소속", "금액", "메모", "입력시각"];
  const rows = entries.map((entry) => [
    entry.name,
    getSideLabel(entry.side),
    entry.relation,
    entry.amount,
    entry.memo,
    new Date(entry.createdAt).toLocaleString("ko-KR"),
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `wedding-money-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const amount = parseAmount(giftAmount.value);
  const name = normalizeText(guestName.value);
  if (!name) {
    alert("이름을 입력해 주세요.");
    guestName.focus();
    return;
  }
  if (amount <= 0) {
    alert("금액을 정확히 입력해 주세요.");
    giftAmount.focus();
    return;
  }

  const nextEntry = {
    id: editingId || createId(),
    side: normalizeSide(weddingSide.value),
    name,
    relation: normalizeText(guestRelation.value),
    amount,
    memo: normalizeText(memo.value),
    createdAt: editingId ? entries.find((entry) => entry.id === editingId)?.createdAt || Date.now() : Date.now(),
  };

  if (editingId) {
    entries = entries.map((entry) => (entry.id === editingId ? nextEntry : entry));
  } else {
    entries.push(nextEntry);
  }

  saveState();
  resetForm();
  renderAll();
});

giftAmount.addEventListener("input", () => {
  const amount = parseAmount(giftAmount.value);
  giftAmount.value = amount ? new Intl.NumberFormat("ko-KR").format(amount) : "";
});

cancelEdit.addEventListener("click", resetForm);
weddingSide.addEventListener("change", () => {
  applySideTheme(weddingSide.value);
  saveState();
});
searchInput.addEventListener("input", renderLedger);
sortSelect.addEventListener("change", renderLedger);

document.querySelector("#exportCsv").addEventListener("click", exportCsv);
document.querySelector("#resetAll").addEventListener("click", () => {
  if (!entries.length && getCashTotal() === 0) return;
  if (!confirm("모든 명단과 권종 입력을 초기화할까요?")) return;
  entries = [];
  billCounts = {};
  document.querySelectorAll("#billGrid input").forEach((input) => {
    input.value = 0;
  });
  saveState();
  resetForm();
  renderAll();
});

document.querySelector("#clearBills").addEventListener("click", () => {
  billCounts = {};
  document.querySelectorAll("#billGrid input").forEach((input) => {
    input.value = 0;
  });
  saveState();
  renderSummary();
});

weddingSide.value = normalizeSide(localStorage.getItem(SIDE_KEY));
applySideTheme(weddingSide.value);
buildBills();
renderAll();
