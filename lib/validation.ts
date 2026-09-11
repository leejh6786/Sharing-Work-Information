import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다.");

export const taskSchema = z.object({
  date,
  time: z.string().max(50).default(""),
  type: z.string().min(1, "업무유형을 선택해 주세요.").max(50),
  name: z.string().min(1, "업무명을 입력해 주세요.").max(200),
  target: z.string().max(100).default(""),
  place: z.string().max(100).default(""),
  department: z.string().max(100).default(""),
  note: z.string().max(1000).default(""),
  completedDate: z.union([date, z.literal("")]).default(""),
});

export const taskIdentitySchema = z.object({
  date: z.union([date, z.literal("")]),
  name: z.string().min(1).max(200),
  department: z.string().max(100).default(""),
});

export const taskUpdateSchema = z.object({
  task: taskSchema,
  expected: taskIdentitySchema,
});

export const taskDeleteSchema = z.object({
  expected: taskIdentitySchema,
  reason: z.string().max(500).default("웹앱에서 삭제"),
});

export const noticeSchema = z.object({
  date,
  content: z.string().min(1, "안내 내용을 입력해 주세요.").max(500),
  department: z.string().max(100).default(""),
  target: z.string().max(100).default(""),
  note: z.string().max(1000).default(""),
});
