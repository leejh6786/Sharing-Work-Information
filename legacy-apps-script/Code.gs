const SPREADSHEET_ID = '1kfm0c6X7YVYhS51x5UPgeiViJsKb9CExfEqGyWFKCkU';
const ENTRY_SHEET_NAME = '업무 등재';
const LIST_SHEET_NAME = '업무목록';
const DELETE_SHEET_NAME = '삭제 목록';
const DASHBOARD_SHEET_NAME = '대시보드';
const DATA_START_ROW = 3;
const DATA_COLUMN_COUNT = 10;
const DELETE_COLUMN_INDEX = 11;
const SORT_CHECK_CELL = 'L2';
const BASE_YEAR = 2026;

/**
 * 웹앱 첫 화면을 표시합니다.
 */
function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('해남제일중 업무 공유')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * HTML 파일 조각을 불러옵니다.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * 웹앱 초기 화면에 필요한 전체 데이터를 반환합니다.
 */
function getAppData() {
  const tasks = getTasks_();
  const notices = getNotices_();
  const today = makeToday_();

  return {
    today: toDateKey_(today),
    tasks,
    notices,
    dashboard: buildDashboard_(tasks, today),
    options: {
      types: ['연수', '행사', '회의', '업무', '평가', '교육', '방과후', '공휴일', '기타']
    }
  };
}

/**
 * 입력된 업무를 업무목록에 저장합니다.
 */
function addTask(payload) {
  const sheet = getSheet_(LIST_SHEET_NAME);
  const values = buildTaskFromPayload_(payload);

  if (!values[0] || !values[4]) {
    throw new Error('날짜와 업무명은 반드시 입력해야 합니다.');
  }

  const confirmMessages = buildConfirmMessage_(values, sheet);
  if (confirmMessages) {
    return {
      ok: false,
      needsConfirm: true,
      message: confirmMessages
    };
  }

  saveTaskValues_(sheet, values);

  return {
    ok: true,
    message: '업무가 저장되었습니다.',
    data: getAppData()
  };
}

/**
 * 중복 확인을 무시하고 업무를 저장합니다.
 */
function addTaskConfirmed(payload) {
  const sheet = getSheet_(LIST_SHEET_NAME);
  const values = buildTaskFromPayload_(payload);

  if (!values[0] || !values[4]) {
    throw new Error('날짜와 업무명은 반드시 입력해야 합니다.');
  }

  saveTaskValues_(sheet, values);

  return {
    ok: true,
    message: '업무가 저장되었습니다.',
    data: getAppData()
  };
}

/**
 * 선택한 업무 행을 삭제 목록으로 이동합니다.
 */
function deleteTask(rowNumber) {
  const row = Number(rowNumber);
  if (!row || row < DATA_START_ROW) {
    throw new Error('삭제할 수 없는 행입니다.');
  }

  const sheet = getSheet_(LIST_SHEET_NAME);
  moveRowToDeleteList_(sheet, row);

  return {
    ok: true,
    message: '삭제 목록으로 이동되었습니다.',
    data: getAppData()
  };
}

/**
 * 업무목록을 오늘 기준 순환 정렬합니다.
 */
function sortTasksManual() {
  const sheet = getSheet_(LIST_SHEET_NAME);
  sortTaskList_(sheet);
  applyDateFormat_(sheet);
  sheet.getRange(SORT_CHECK_CELL).setValue(false);

  return {
    ok: true,
    message: '업무목록이 정렬되었습니다.',
    data: getAppData()
  };
}

/**
 * 대시보드 안내사항을 추가합니다.
 */
function addNotice(payload) {
  const sheet = getSheet_(DASHBOARD_SHEET_NAME);
  const content = String(payload && payload.content || '').trim();
  const department = String(payload && payload.department || '').trim();
  const target = String(payload && payload.target || '').trim();
  const memo = String(payload && payload.memo || '').trim();

  if (!content) {
    throw new Error('안내 내용을 입력해야 합니다.');
  }

  const now = new Date();
  const row = Math.max(sheet.getLastRow() + 1, 4);
  sheet.getRange(row, 10, 1, 6).setValues([[
    makeSafeDate_(now.getFullYear(), now.getMonth() + 1, now.getDate()),
    getKoreanWeekday_(now),
    content,
    department,
    target,
    memo
  ]]);
  sheet.getRange(row, 10).setNumberFormat('yyyy. m. d.');

  return {
    ok: true,
    message: '안내사항이 등록되었습니다.',
    data: getAppData()
  };
}

/**
 * 시트가 수정될 때 기존 구글시트 자동화도 함께 처리합니다.
 */
function onEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();

  if (
    sheetName === ENTRY_SHEET_NAME &&
    e.range.getA1Notation() === 'K3' &&
    e.value === 'TRUE'
  ) {
    saveEntryToTaskList_();
    return;
  }

  if (
    sheetName === DASHBOARD_SHEET_NAME &&
    e.range.getColumn() === 12 &&
    e.range.getRow() >= 4
  ) {
    stampNoticeRow_(sheet, e.range.getRow());
    return;
  }

  if (
    sheetName === LIST_SHEET_NAME &&
    e.range.getColumn() === DELETE_COLUMN_INDEX &&
    e.range.getRow() >= DATA_START_ROW &&
    e.value === 'TRUE'
  ) {
    moveRowToDeleteList_(sheet, e.range.getRow());
    return;
  }

  if (
    sheetName === LIST_SHEET_NAME &&
    e.range.getA1Notation() === SORT_CHECK_CELL &&
    e.value === 'TRUE'
  ) {
    sortTaskList_(sheet);
    applyDateFormat_(sheet);
    sheet.getRange(SORT_CHECK_CELL).setValue(false);
    SpreadsheetApp.getActive().toast('업무목록이 정렬되었습니다.', '정렬 완료', 3);
  }
}

/**
 * 업무 등재 탭의 A3:J3 값을 업무목록에 저장합니다.
 */
function saveEntryToTaskList_() {
  const entrySheet = getSheet_(ENTRY_SHEET_NAME);
  const listSheet = getSheet_(LIST_SHEET_NAME);
  const inputRange = entrySheet.getRange('A3:J3');
  const raw = inputRange.getValues()[0];
  const display = inputRange.getDisplayValues()[0];
  const values = buildTaskValues_(raw, display);

  if (!values[0] || !values[4]) {
    entrySheet.getRange('K3').setValue(false);
    SpreadsheetApp.getActive().toast('날짜와 업무명은 반드시 입력해야 합니다.', '저장 실패', 5);
    return;
  }

  values[1] = getKoreanWeekday_(values[0]);

  const confirmMessage = buildConfirmMessage_(values, listSheet);
  if (confirmMessage) {
    const ui = SpreadsheetApp.getUi();
    const result = ui.alert('중복 확인', confirmMessage + '\n\n그래도 저장하시겠습니까?', ui.ButtonSet.YES_NO);

    if (result !== ui.Button.YES) {
      entrySheet.getRange('K3').setValue(false);
      SpreadsheetApp.getActive().toast('저장이 취소되었습니다.', '취소', 3);
      return;
    }
  }

  saveTaskValues_(listSheet, values);
  resetEntryRow_(entrySheet);
  SpreadsheetApp.getActive().toast('업무목록에 저장되었습니다.', '저장 완료', 3);
}

/**
 * 업무 저장 공통 로직입니다.
 */
function saveTaskValues_(sheet, values) {
  sheet.insertRowBefore(DATA_START_ROW);
  sheet.getRange(DATA_START_ROW, 1, 1, DATA_COLUMN_COUNT).setValues([values]);
  applyDateFormat_(sheet);
  sortTaskList_(sheet);
  applyDateFormat_(sheet);
}

/**
 * 웹앱 입력값을 업무목록 저장 배열로 변환합니다.
 */
function buildTaskFromPayload_(payload) {
  const item = payload || {};
  const date = normalizeDate_(item.date, item.date);
  const values = [
    date,
    getKoreanWeekday_(date),
    normalizeTimeValue_(item.time),
    String(item.type || '').trim(),
    String(item.title || '').trim(),
    String(item.target || '').trim(),
    String(item.place || '').trim(),
    String(item.department || '').trim(),
    String(item.memo || '').trim(),
    normalizeDate_(item.doneDate, item.doneDate) || ''
  ];

  return values;
}

/**
 * 업무 등재 A3:J3 입력값을 업무목록 저장 배열로 변환합니다.
 */
function buildTaskValues_(raw, display) {
  const a3Text = String(display[0] || '').trim();

  if (isCompactInput_(a3Text)) {
    return parseCompactInput_(a3Text);
  }

  const values = raw.slice(0, 10);
  values[0] = normalizeDate_(raw[0], display[0]);
  values[1] = getKoreanWeekday_(values[0]);
  values[2] = display[2] || raw[2] || '';

  return values;
}

/**
 * A3에 전체 문장이 들어왔는지 판단합니다.
 */
function isCompactInput_(text) {
  if (!text) return false;

  const hasDate =
    /^\s*\d{1,2}[/.]\s*\d{1,2}/.test(text) ||
    /^\s*\d{4}[.]\s*\d{1,2}[.]\s*\d{1,2}/.test(text) ||
    /^\s*\d{1,2}월\s*\d{1,2}일/.test(text);

  return hasDate && text.split(/\s+/).length >= 4;
}

/**
 * A3 한 문장 입력을 날짜, 시간, 유형, 업무명 등으로 분리합니다.
 */
function parseCompactInput_(text) {
  let working = text.trim();

  const dateMatch =
    working.match(/^(\d{4})[.]\s*(\d{1,2})[.]\s*(\d{1,2})[.]?(?:\([^)]+\))?\s*/) ||
    working.match(/^(\d{1,2})[/.]\s*(\d{1,2})(?:\([^)]+\))?\s*/) ||
    working.match(/^(\d{1,2})월\s*(\d{1,2})일(?:\([^)]+\))?\s*/);

  if (!dateMatch) {
    return ['', '', '', '', working, '', '', '', '', ''];
  }

  let year;
  let month;
  let day;

  if (dateMatch[3]) {
    year = Number(dateMatch[1]);
    month = Number(dateMatch[2]);
    day = Number(dateMatch[3]);
  } else {
    month = Number(dateMatch[1]);
    day = Number(dateMatch[2]);
    year = month >= 3 ? BASE_YEAR : BASE_YEAR + 1;
  }

  const date = makeSafeDate_(year, month, day);
  working = working.slice(dateMatch[0].length).trim();

  let time = '';
  const timeMatch = working.match(/^(\d{1,2}:\d{2})\s*/);
  if (timeMatch) {
    time = timeMatch[1];
    working = working.slice(timeMatch[0].length).trim();
  }

  const types = ['연수', '행사', '회의', '업무', '평가', '교육', '방과후', '공휴일', '기타'];
  let type = '';

  for (const item of types) {
    if (working === item || working.startsWith(item + ' ')) {
      type = item;
      working = working.slice(item.length).trim();
      break;
    }
  }

  const tokens = working.split(/\s+/);
  const targetWords = ['교원', '교직원', '전교직원', '전교생', '학생', '해당학생', '학부모'];
  const targetIndex = tokens.findIndex(token => targetWords.includes(token));

  let title = working;
  let target = '';
  let place = '';
  let department = '';
  let memo = '';

  if (targetIndex >= 0) {
    title = tokens.slice(0, targetIndex).join(' ');
    target = tokens[targetIndex] || '';
    place = tokens[targetIndex + 1] || '';
    department = tokens[targetIndex + 2] || '';
    memo = tokens.slice(targetIndex + 3).join(' ');
  }

  return [date, getKoreanWeekday_(date), time, type, title, target, place, department, memo, ''];
}

/**
 * 다양한 날짜 입력을 Date 객체로 변환합니다.
 */
function normalizeDate_(raw, display) {
  if (raw instanceof Date) {
    return makeSafeDate_(raw.getFullYear(), raw.getMonth() + 1, raw.getDate());
  }

  const text = String(display || raw || '').trim();
  if (!text) return '';

  const fullDateMatch = text.match(/^(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})\.?/);
  if (fullDateMatch) {
    return makeSafeDate_(
      Number(fullDateMatch[1]),
      Number(fullDateMatch[2]),
      Number(fullDateMatch[3])
    );
  }

  const shortDateMatch =
    text.match(/^(\d{1,2})[/.]\s*(\d{1,2})\.?/) ||
    text.match(/^(\d{1,2})월\s*(\d{1,2})일?/);

  if (shortDateMatch) {
    const month = Number(shortDateMatch[1]);
    const day = Number(shortDateMatch[2]);
    const year = month >= 3 ? BASE_YEAR : BASE_YEAR + 1;
    return makeSafeDate_(year, month, day);
  }

  return '';
}

/**
 * 시간 입력값을 저장 가능한 값으로 정리합니다.
 */
function normalizeTimeValue_(value) {
  if (value instanceof Date) return value;
  return String(value || '').trim();
}

/**
 * 중복 가능성이 있는 업무에 대한 확인 메시지를 만듭니다.
 */
function buildConfirmMessage_(values, listSheet) {
  const messages = [];
  const date = values[0];
  const time = values[2];
  const title = values[4];
  const place = values[6];

  if (isDuplicateDateTimePlace_(listSheet, date, time, place)) {
    messages.push('- 같은 날짜, 시간, 장소에 이미 등록된 업무가 있습니다.');
  }

  if (isDuplicateTitle_(listSheet, title)) {
    messages.push('- 같은 업무명이 이미 등록되어 있습니다.');
  }

  return messages.join('\n');
}

/**
 * 같은 날짜, 시간, 장소의 업무가 이미 있는지 확인합니다.
 */
function isDuplicateDateTimePlace_(sheet, date, time, place) {
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return false;

  const targetDate = makeDateKey_(date);
  const targetTime = makeTextKey_(time);
  const targetPlace = makeTextKey_(place);

  if (!targetDate || !targetPlace) return false;

  const data = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, DATA_COLUMN_COUNT).getValues();

  return data.some(row => (
    makeDateKey_(row[0]) === targetDate &&
    makeTextKey_(row[2]) === targetTime &&
    makeTextKey_(row[6]) === targetPlace
  ));
}

/**
 * 같은 업무명이 이미 있는지 확인합니다.
 */
function isDuplicateTitle_(sheet, title) {
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return false;

  const targetTitle = makeTextKey_(title);
  if (!targetTitle) return false;

  const data = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, DATA_COLUMN_COUNT).getValues();
  return data.some(row => makeTextKey_(row[4]) === targetTitle);
}

/**
 * 업무목록을 시트에서 읽어 웹앱용 객체 배열로 반환합니다.
 */
function getTasks_() {
  const sheet = getSheet_(LIST_SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return [];

  const values = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, DATA_COLUMN_COUNT).getValues();
  const display = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, DATA_COLUMN_COUNT).getDisplayValues();

  return values
    .map((row, index) => rowToTask_(row, display[index], DATA_START_ROW + index))
    .filter(task => task.date || task.title);
}

/**
 * 시트 한 행을 웹앱용 업무 객체로 변환합니다.
 */
function rowToTask_(row, display, rowNumber) {
  return {
    rowNumber,
    date: makeDateKey_(row[0]),
    dateDisplay: display[0],
    day: display[1],
    time: display[2],
    type: display[3],
    title: display[4],
    target: display[5],
    place: display[6],
    department: display[7],
    memo: display[8],
    doneDate: display[9]
  };
}

/**
 * 대시보드 안내사항을 읽습니다.
 */
function getNotices_() {
  const sheet = getSheet_(DASHBOARD_SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow < 4) return [];

  const values = sheet.getRange(4, 10, lastRow - 3, 6).getValues();
  const display = sheet.getRange(4, 10, lastRow - 3, 6).getDisplayValues();

  return values
    .map((row, index) => ({
      rowNumber: index + 4,
      date: makeDateKey_(row[0]),
      dateDisplay: display[index][0],
      day: display[index][1],
      content: display[index][2],
      department: display[index][3],
      target: display[index][4],
      memo: display[index][5]
    }))
    .filter(notice => notice.content);
}

/**
 * 대시보드 구간별 업무 목록을 만듭니다.
 */
function buildDashboard_(tasks, today) {
  const todayKey = toDateKey_(today);
  const weekStart = startOfWeek_(today);
  const weekEnd = addDays_(weekStart, 6);
  const nextWeekStart = addDays_(weekStart, 7);
  const nextWeekEnd = addDays_(weekStart, 13);
  const monthStart = makeSafeDate_(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthStart = makeSafeDate_(today.getFullYear(), today.getMonth() + 2, 1);
  const nextNextMonthStart = makeSafeDate_(today.getFullYear(), today.getMonth() + 3, 1);

  return {
    today: tasks.filter(task => task.date === todayKey),
    thisWeek: filterByRange_(tasks, weekStart, weekEnd),
    nextWeek: filterByRange_(tasks, nextWeekStart, nextWeekEnd),
    thisMonth: filterByRange_(tasks, monthStart, addDays_(nextMonthStart, -1)),
    nextMonth: filterByRange_(tasks, nextMonthStart, addDays_(nextNextMonthStart, -1))
  };
}

/**
 * 날짜 범위에 해당하는 업무를 골라냅니다.
 */
function filterByRange_(tasks, start, end) {
  const startKey = toDateKey_(start);
  const endKey = toDateKey_(end);
  return tasks.filter(task => task.date >= startKey && task.date <= endKey);
}

/**
 * 업무목록 A열 날짜 표시 형식을 고정합니다.
 */
function applyDateFormat_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return;
  sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, 1).setNumberFormat('yyyy. m. d.');
}

/**
 * 업무목록을 오늘 기준 순환 정렬합니다.
 */
function sortTaskList_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW + 1) return;

  const range = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, DATA_COLUMN_COUNT);
  const values = range.getValues();
  const today = makeToday_();

  values.sort((a, b) => {
    const orderA = makeCircularDateOrder_(makeDateObject_(a[0]), today);
    const orderB = makeCircularDateOrder_(makeDateObject_(b[0]), today);
    if (orderA !== orderB) return orderA - orderB;

    const timeA = makeTimeOrder_(a[2]);
    const timeB = makeTimeOrder_(b[2]);
    if (timeA !== timeB) return timeA - timeB;

    return String(a[4] || '').localeCompare(String(b[4] || ''), 'ko');
  });

  range.setValues(values);
}

/**
 * 오늘 이후는 위로, 지난 날짜는 아래로 보내는 정렬 값을 만듭니다.
 */
function makeCircularDateOrder_(date, today) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return 999999;

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target - today) / 86400000);
  if (diffDays >= 0) return diffDays;
  return 100000 + diffDays;
}

/**
 * 정렬용 Date 객체를 만듭니다.
 */
function makeDateObject_(value) {
  if (value instanceof Date) return value;
  return normalizeDate_(value, value) || null;
}

/**
 * 정렬용 시간 값을 분 단위로 변환합니다.
 */
function makeTimeOrder_(value) {
  if (value instanceof Date) return value.getHours() * 60 + value.getMinutes();

  const text = String(value || '').trim();
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return 9999;

  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * 업무 등재 입력칸을 초기화합니다.
 */
function resetEntryRow_(sheet) {
  sheet.getRange('A3:A3').clearContent();
  sheet.getRange('C3:J3').clearContent();
  sheet.getRange('B3').setFormula(
    '=IF(A3="","",CHOOSE(WEEKDAY(IF(ISNUMBER(A3),A3,IFERROR(DATE(VALUE(REGEXEXTRACT(TO_TEXT(A3),"^\\s*(\\d{4})")),VALUE(REGEXEXTRACT(TO_TEXT(A3),"^\\s*\\d{4}[./-]\\s*(\\d{1,2})")),VALUE(REGEXEXTRACT(TO_TEXT(A3),"^\\s*\\d{4}[./-]\\s*\\d{1,2}[./-]\\s*(\\d{1,2})"))),DATE(IF(VALUE(REGEXEXTRACT(TO_TEXT(A3),"^\\s*(\\d{1,2})"))>=3,2026,2027),VALUE(REGEXEXTRACT(TO_TEXT(A3),"^\\s*(\\d{1,2})")),VALUE(REGEXEXTRACT(TO_TEXT(A3),"^\\s*\\d{1,2}[./월 ]+\\s*(\\d{1,2})"))))))),"일","월","화","수","목","금","토"))'
  );
  sheet.getRange('K3').setValue(false);
}

/**
 * 삭제 체크된 행을 삭제 목록으로 이동합니다.
 */
function moveRowToDeleteList_(listSheet, row) {
  const deleteSheet = getSheet_(DELETE_SHEET_NAME);
  const rowValues = listSheet.getRange(row, 1, 1, DATA_COLUMN_COUNT).getValues()[0];
  const deleteRow = rowValues.concat([new Date(), '']);
  const targetRow = Math.max(deleteSheet.getLastRow() + 1, 3);

  deleteSheet.getRange(targetRow, 1, 1, 12).setValues([deleteRow]);
  deleteSheet.getRange(targetRow, 1).setNumberFormat('yyyy. m. d.');
  deleteSheet.getRange(targetRow, 11).setNumberFormat('yyyy. m. d. hh:mm');
  listSheet.deleteRow(row);
  SpreadsheetApp.getActive().toast('삭제 목록으로 이동되었습니다.', '삭제 완료', 3);
}

/**
 * 대시보드 안내사항 날짜와 요일을 기록합니다.
 */
function stampNoticeRow_(sheet, row) {
  const content = sheet.getRange(row, 12).getValue();
  const dateCell = sheet.getRange(row, 10);
  const dayCell = sheet.getRange(row, 11);

  if (!content) {
    dateCell.clearContent();
    dayCell.clearContent();
    return;
  }

  if (!dateCell.getValue()) {
    const now = new Date();
    dateCell.setValue(makeSafeDate_(now.getFullYear(), now.getMonth() + 1, now.getDate()));
    dayCell.setValue(getKoreanWeekday_(now));
  }
}

/**
 * 수동 저장 버튼용 함수입니다.
 */
function saveInputNow() {
  saveEntryToTaskList_();
}

/**
 * 샘플 입력 테스트 함수입니다.
 */
function testSampleInput() {
  const entrySheet = getSheet_(ENTRY_SHEET_NAME);
  entrySheet.getRange('A3').setValue('7/13(월) 15:10 연수 2026. 다면평가 연수 교원 글샘터 교무부 유인물 교육 대체');
  saveEntryToTaskList_();
}

/**
 * Date 객체를 한국어 요일로 변환합니다.
 */
function getKoreanWeekday_(date) {
  if (!(date instanceof Date)) return '';
  return ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
}

/**
 * 날짜 비교용 yyyy-mm-dd 키를 만듭니다.
 */
function makeDateKey_(value) {
  if (!(value instanceof Date)) return String(value || '').trim();
  return toDateKey_(value);
}

/**
 * 텍스트 비교용 키를 만듭니다.
 */
function makeTextKey_(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * 시간대 밀림을 막기 위해 정오 기준 Date 객체를 만듭니다.
 */
function makeSafeDate_(year, month, day) {
  return new Date(year, month - 1, day, 12, 0, 0);
}

/**
 * 오늘 날짜를 자정 기준으로 만듭니다.
 */
function makeToday_() {
  const now = new Date();
  const today = makeSafeDate_(now.getFullYear(), now.getMonth() + 1, now.getDate());
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Date 객체를 yyyy-mm-dd 문자열로 변환합니다.
 */
function toDateKey_(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 지정 날짜에서 일수를 더한 날짜를 반환합니다.
 */
function addDays_(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * 해당 주의 월요일을 반환합니다.
 */
function startOfWeek_(date) {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * 스프레드시트 객체를 반환합니다.
 */
function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * 이름으로 시트를 반환합니다.
 */
function getSheet_(name) {
  const sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error(name + ' 탭을 찾을 수 없습니다.');
  return sheet;
}
