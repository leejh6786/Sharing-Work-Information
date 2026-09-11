import "server-only";

import { google } from "googleapis";
import { dayOfWeek, koreanDate, normalizeDate } from "@/lib/date";
import type { Notice, NoticeInput, Task, TaskInput } from "@/lib/types";

const TASK_SHEET = "업무목록";
const DELETED_SHEET = "삭제 목록";
const DASHBOARD_SHEET = "대시보드";
const TASK_SHEET_ID = 881124393;

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

export async function listTasks(): Promise<Task[]> {
  const sheets = getClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: `'${TASK_SHEET}'!A3:K`,
    valueRenderOption: "FORMATTED_VALUE",
  });

  return (response.data.values ?? [])
    .map((row, index) => ({
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
    }))
    .filter((task) => task.name || task.date);
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

export async function updateTask(row: number, input: TaskInput) {
  if (row < 3) throw new Error("수정할 수 없는 행입니다.");
  const sheets = getClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId(),
    range: `'${TASK_SHEET}'!A${row}:K${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [taskValues(input)] },
  });
}

export async function deleteTask(row: number, reason = "웹앱에서 삭제") {
  if (row < 3) throw new Error("삭제할 수 없는 행입니다.");
  const sheets = getClient();
  const current = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: `'${TASK_SHEET}'!A${row}:J${row}`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const values = current.data.values?.[0];
  if (!values?.length) throw new Error("삭제할 업무를 찾지 못했습니다. 새로고침 후 다시 시도해 주세요.");
  const archivedValues = Array.from({ length: 10 }, (_, index) => values[index] ?? "");

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId(),
    range: `'${DELETED_SHEET}'!A:L`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[...archivedValues, new Date().toISOString(), reason]] },
  });
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId(),
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId: TASK_SHEET_ID, dimension: "ROWS", startIndex: row - 1, endIndex: row },
        },
      }],
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
