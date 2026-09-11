export type Task = {
  row: number;
  date: string;
  day: string;
  time: string;
  type: string;
  name: string;
  target: string;
  place: string;
  department: string;
  note: string;
  completedDate: string;
};

export type Notice = {
  row: number;
  date: string;
  day: string;
  content: string;
  department: string;
  target: string;
  note: string;
};

export type TaskInput = Omit<Task, "row" | "day">;
export type NoticeInput = Omit<Notice, "row" | "day">;
