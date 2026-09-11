import "server-only";

import { google } from "googleapis";
import { dayOfWeek, koreanDate, normalizeDate } from "@/lib/date";
import type { Notice, NoticeInput, Task, TaskIdentity, TaskInput } from "@/lib/types";

const TASK_SHEET = "업무목록";
const DELETED_SHEET = "삭제 목록";
const DASHBOARD_SHEET = "대시보드";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`환경변수 ${name}이(가) 설정되지 않았습니다.`);
  return value;
}

function getClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: env("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      private_key: env("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function sheetId() {
  return env("GOOGLE_SHEET_ID");
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function isDeleted(value: unknown): boolean {
  return text(value).toUpperCase() === "TRUE" || text(value) === "1";
}

function assertCurrentTask(row: unknown[], expected: TaskIdentity) {
  if (!row.length || (!text(row[0]) && !text(row[4]))) {
    throw new Error("업무를 찾지 못했습니다. 새로고침 후 다시 시도해 주세요.");
  }
  if (isDeleted(row[10])) {
    throw new Error("이미 삭제된 업무입니다. 새로고침해 주세요.");
  }

  const matches = normalizeDate(row[0]) === expected.date
    && text(row[4]) === text(expected.name)
    && text(row[7]) === text(expected.department);
  if (!matches) {
    throw new Error("선택한 행의 업무가 변경되었습니다. 새로고침 후 다시 시도해 주세요.");
  }
}

async function taskSheetIds(sheets: ReturnType<typeof getClient>): Promise<{ task: number; deleted: number }> {
  const response = await sheets.spreadsheets.get({
    spreadsheetId: sheetId(),
    fields: "sheets.properties(sheetId,title)",
  });
  const findId = (title: string) => response.data.sheets?.find((sheet) => sheet.properties?.title === title)?.properties?.sheetId;
  const task = findId(TASK_SHEET);
  const deleted = findId(DELETED_SHEET);
  if (typeof task !== "number") throw new Error(`'${TASK_SHEET}' 시트를 찾지 못했습니다.`);
  if (typeof deleted !== "number") throw new Error(`'${DELETED_SHEET}' 시트를 찾지 못했습니다.`);
  return { task, deleted };
}

export async function listTasks(): Promise<Task[]> {
  const sheets = getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: `'${TASK_SHEET}'!A3:K`,
    valueRenderOption: "FORMATTED_VALUE",
  });

  return (response.data.values ?? []).flatMap((row, index) => {
    if (isDeleted(row[10])) return [];
    const task = {
      row: index + 3,
      date: normalizeDate(row[0]),
      day: text(row[1]),
      time: text(row[2]),
      type: text(row[3]),
      name: text(row[4]),
      target: text(row[5]),
      place: text(row[6]),
      department: text(row[7]),
      note: text(row[8]),
      completedDate: normalizeDate(row[9]),
    };
    return task.name || task.date ? [task] : [];
  });
}

function taskValues(input: TaskInput) {
  return [
    koreanDate(input.date),
    dayOfWeek(input.date),
    input.time,
    input.type,
    input.name,
    input.target,
    input.place,
    input.department,
    input.note,
    input.completedDate ? koreanDate(input.completedDate) : "",
    false,
  ];
}

export async function createTask(input: TaskInput) {
  const sheets = getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId(),
    range: `'${TASK_SHEET}'!A:K`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [taskValues(input)] },
  });
}

export async function updateTask(row: number, input: TaskInput, expected: TaskIdentity) {
  if (row < 3) throw new Error("수정할 수 없는 행입니다.");
  const sheets = getClient();
  const current = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: `'${TASK_SHEET}'!A${row}:K${row}`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  assertCurrentTask(current.data.values?.[0] ?? [], expected);

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId(),
    range: `'${TASK_SHEET}'!A${row}:J${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [taskValues(input).slice(0, 10)] },
  });
}

export async function deleteTask(row: number, expected: TaskIdentity, reason = "웹앱에서 삭제") {
  if (row < 3) throw new Error("삭제할 수 없는 행입니다.");
  const sheets = getClient();
  const [current, sheetIds] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId: sheetId(),
      range: `'${TASK_SHEET}'!A${row}:K${row}`,
      valueRenderOption: "FORMATTED_VALUE",
    }),
    taskSheetIds(sheets),
  ]);
  const values = current.data.values?.[0] ?? [];
  assertCurrentTask(values, expected);
  const archivedValues = Array.from({ length: 10 }, (_, index) => values[index] ?? "");

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId(),
    requestBody: {
      requests: [
        {
          appendCells: {
            sheetId: sheetIds.deleted,
            fields: "userEnteredValue",
            rows: [{
              values: [...archivedValues, new Date().toISOString(), reason].map((value) => ({
                userEnteredValue: { stringValue: text(value) },
              })),
            }],
          },
        },
        {
          updateCells: {
            range: {
              sheetId: sheetIds.task,
              startRowIndex: row - 1,
              endRowIndex: row,
              startColumnIndex: 10,
              endColumnIndex: 11,
            },
            fields: "userEnteredValue",
            rows: [{ values: [{ userEnteredValue: { boolValue: true } }] }],
          },
        },
      ],
    },
  });
}

export async function listNotices(): Promise<Notice[]> {
  const sheets = getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: `'${DASHBOARD_SHEET}'!J4:O`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  return (response.data.values ?? [])
    .map((row, index) => ({
      row: index + 4,
      date: normalizeDate(row[0]),
      day: text(row[1]),
      content: text(row[2]),
      department: text(row[3]),
      target: text(row[4]),
      note: text(row[5]),
    }))
    .filter((notice) => notice.content || notice.date);
}

function noticeValues(input: NoticeInput) {
  return [koreanDate(input.date), dayOfWeek(input.date), input.content, input.department, input.target, input.note];
}

export async function createNotice(input: NoticeInput) {
  const sheets = getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId(),
    range: `'${DASHBOARD_SHEET}'!J:O`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [noticeValues(input)] },
  });
}

export async function updateNotice(row: number, input: NoticeInput) {
  if (row < 4) throw new Error("수정할 수 없는 행입니다.");
  const sheets = getClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId(),
    range: `'${DASHBOARD_SHEET}'!J${row}:O${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [noticeValues(input)] },
  });
}

export async function deleteNotice(row: number) {
  if (row < 4) throw new Error("삭제할 수 없는 행입니다.");
  const sheets = getClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId(),
    range: `'${DASHBOARD_SHEET}'!J${row}:O${row}`,
  });
}
