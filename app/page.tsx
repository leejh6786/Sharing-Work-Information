"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Notice, NoticeInput, Task, TaskInput } from "@/lib/types";

type Tab = "dashboard" | "entry" | "list" | "notice";
const TASK_TYPES = ["행사", "업무", "회의", "교육", "평가", "방과후", "공휴일", "기타"];

function todayKst() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function dateValue(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function displayDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}. ${m}. ${d}.`;
}

function mondayOf(date: Date) {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) }, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "요청을 처리하지 못했습니다.");
  return data;
}

const emptyTask = (): TaskInput => ({ date: todayKst(), time: "", type: "행사", name: "", target: "", place: "", department: "", note: "", completedDate: "" });
const emptyNotice = (): NoticeInput => ({ date: todayKst(), content: "", department: "", target: "", note: "" });

function TaskTable({ tasks, onEdit, onDelete }: { tasks: Task[]; onEdit: (task: Task) => void; onDelete: (task: Task) => void }) {
  if (!tasks.length) return <p className="empty">표시할 일정이 없습니다.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>날짜</th><th>요일</th><th>시간</th><th>유형</th><th className="wide">업무명</th><th>대상</th><th>장소</th><th>부서</th><th>상태</th><th>관리</th></tr></thead>
        <tbody>{tasks.map((task) => (
          <tr key={task.row} className={task.completedDate ? "completed" : ""}>
            <td>{displayDate(task.date)}</td><td>{task.day}</td><td>{task.time}</td><td><span className="tag">{task.type}</span></td>
            <td className="wide"><strong>{task.name}</strong>{task.note && <small>{task.note}</small>}</td><td>{task.target}</td><td>{task.place}</td><td>{task.department}</td>
            <td>{task.completedDate ? <span className="done">완료</span> : <span className="pending">예정</span>}</td>
            <td><div className="row-actions"><button className="small" onClick={() => onEdit(task)}>수정</button><button className="small danger" onClick={() => onDelete(task)}>삭제</button></div></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [taskForm, setTaskForm] = useState<TaskInput>(emptyTask);
  const [noticeForm, setNoticeForm] = useState<NoticeInput>(emptyNotice);
  const [editingTask, setEditingTask] = useState<number | null>(null);
  const [editingNotice, setEditingNotice] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [taskData, noticeData] = await Promise.all([api<{ tasks: Task[] }>("/api/tasks"), api<{ notices: Notice[] }>("/api/notices")]);
      setTasks(taskData.tasks.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)));
      setNotices(noticeData.notices.sort((a, b) => b.date.localeCompare(a.date)));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "자료를 불러오지 못했습니다.");
    } finally { setLoading(false); }
  }, []);

  // 초기 원격 자료 동기화는 마운트 시 한 번 수행합니다.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const buckets = useMemo(() => {
    const nowIso = todayKst();
    const now = dateValue(nowIso);
    const monday = mondayOf(now);
    const nextMonday = addDays(monday, 7);
    const afterNextMonday = addDays(monday, 14);
    const thisMonth = nowIso.slice(0, 7);
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;
    const between = (task: Task, start: Date, end: Date) => { const value = dateValue(task.date); return value >= start && value < end; };
    return {
      today: tasks.filter((task) => task.date === nowIso),
      week: tasks.filter((task) => between(task, monday, nextMonday)),
      nextWeek: tasks.filter((task) => between(task, nextMonday, afterNextMonday)),
      month: tasks.filter((task) => task.date.startsWith(thisMonth)),
      nextMonth: tasks.filter((task) => task.date.startsWith(nextMonth)),
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return tasks.filter((task) => (!typeFilter || task.type === typeFilter) && (!keyword || Object.values(task).some((value) => String(value).toLowerCase().includes(keyword))));
  }, [tasks, search, typeFilter]);

  async function saveTask(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      await api(editingTask ? `/api/tasks/${editingTask}` : "/api/tasks", { method: editingTask ? "PATCH" : "POST", body: JSON.stringify(taskForm) });
      setMessage(editingTask ? "업무를 수정했습니다." : "업무를 등록했습니다.");
      setTaskForm(emptyTask()); setEditingTask(null); await load(); setTab("list");
    } catch (error) { setMessage(error instanceof Error ? error.message : "저장하지 못했습니다."); }
    finally { setBusy(false); }
  }

  function editTask(task: Task) {
    setTaskForm({ date: task.date, time: task.time, type: task.type, name: task.name, target: task.target, place: task.place, department: task.department, note: task.note, completedDate: task.completedDate });
    setEditingTask(task.row); setTab("entry"); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeTask(task: Task) {
    if (!window.confirm(`‘${task.name}’ 업무를 삭제 목록으로 이동할까요?`)) return;
    setBusy(true);
    try { await api(`/api/tasks/${task.row}`, { method: "DELETE", body: JSON.stringify({ reason: "웹앱에서 삭제" }) }); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "삭제하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function saveNotice(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      await api(editingNotice ? `/api/notices/${editingNotice}` : "/api/notices", { method: editingNotice ? "PATCH" : "POST", body: JSON.stringify(noticeForm) });
      setNoticeForm(emptyNotice()); setEditingNotice(null); await load(); setMessage("안내사항을 저장했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "저장하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function removeNotice(notice: Notice) {
    if (!window.confirm("이 안내사항을 삭제할까요?")) return;
    setBusy(true);
    try { await api(`/api/notices/${notice.row}`, { method: "DELETE" }); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "삭제하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function share() {
    const data = { title: "해남제일중 업무 공유", url: window.location.href };
    if (navigator.share) await navigator.share(data).catch(() => undefined);
    else { await navigator.clipboard.writeText(data.url); setMessage("주소를 복사했습니다."); }
  }

  const sections: Array<[string, Task[]]> = [["오늘 일정", buckets.today], ["이번주 일정", buckets.week], ["다음주 일정", buckets.nextWeek], ["이번달 일정", buckets.month], ["다음달 일정", buckets.nextMonth]];

  return (
    <>
      <header className="topbar"><div><p className="eyebrow">HAENAM JEIL MIDDLE SCHOOL</p><h1>해남제일중 업무 공유</h1></div><div className="header-actions"><span>기준일 {displayDate(todayKst())}</span><button className="ghost" onClick={share}>공유</button></div></header>
      <nav className="tabs" aria-label="주요 메뉴">{([["dashboard", "대시보드"], ["entry", editingTask ? "업무 수정" : "업무 등재"], ["list", "업무목록"], ["notice", "안내사항"]] as Array<[Tab, string]>).map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}</nav>
      <main>
        {message && <div className="message" role="status">{message}</div>}
        {loading && <div className="loading">Google Sheets에서 업무를 불러오는 중입니다.</div>}

        {!loading && tab === "dashboard" && <div className="stack">
          <section className="summary-grid">{[["오늘", buckets.today.length], ["이번주", buckets.week.length], ["다음주", buckets.nextWeek.length], ["이번달", buckets.month.length], ["다음달", buckets.nextMonth.length]].map(([label, count]) => <article className="summary-card" key={String(label)}><span>{label}</span><strong>{count}</strong><em>건</em></article>)}</section>
          {sections.map(([title, items]) => <section className="panel" key={title}><div className="section-title"><h2>{title}</h2><span>{items.length}건</span></div><TaskTable tasks={items} onEdit={editTask} onDelete={removeTask} /></section>)}
        </div>}

        {!loading && tab === "entry" && <section className="panel form-panel"><div className="section-title"><div><p className="eyebrow">TASK FORM</p><h2>{editingTask ? "업무 수정" : "새 업무 등록"}</h2></div>{editingTask && <button onClick={() => { setEditingTask(null); setTaskForm(emptyTask()); }}>수정 취소</button>}</div>
          <form onSubmit={saveTask} className="form-grid">
            <label>날짜<input required type="date" value={taskForm.date} onChange={(e) => setTaskForm({ ...taskForm, date: e.target.value })} /></label>
            <label>시간<input value={taskForm.time} placeholder="예: 15:30~16:30" onChange={(e) => setTaskForm({ ...taskForm, time: e.target.value })} /></label>
            <label>업무유형<select value={taskForm.type} onChange={(e) => setTaskForm({ ...taskForm, type: e.target.value })}>{TASK_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label>담당부서<input value={taskForm.department} onChange={(e) => setTaskForm({ ...taskForm, department: e.target.value })} /></label>
            <label className="span-2">업무명<input required value={taskForm.name} onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })} /></label>
            <label>대상<input value={taskForm.target} onChange={(e) => setTaskForm({ ...taskForm, target: e.target.value })} /></label>
            <label>장소<input value={taskForm.place} onChange={(e) => setTaskForm({ ...taskForm, place: e.target.value })} /></label>
            <label className="span-3">비고<textarea value={taskForm.note} onChange={(e) => setTaskForm({ ...taskForm, note: e.target.value })} /></label>
            <label>완료일<input type="date" value={taskForm.completedDate} onChange={(e) => setTaskForm({ ...taskForm, completedDate: e.target.value })} /></label>
            <div className="form-actions span-4"><button className="primary" disabled={busy}>{busy ? "저장 중…" : editingTask ? "수정 저장" : "업무 등록"}</button></div>
          </form>
        </section>}

        {!loading && tab === "list" && <section className="panel"><div className="section-title"><div><p className="eyebrow">ALL TASKS</p><h2>전체 업무목록</h2></div><span>{filteredTasks.length}건</span></div><div className="filters"><input aria-label="업무 검색" placeholder="업무명, 부서, 대상 검색" value={search} onChange={(e) => setSearch(e.target.value)} /><select aria-label="업무유형 필터" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="">전체 유형</option>{TASK_TYPES.map((type) => <option key={type}>{type}</option>)}</select><button onClick={load}>새로고침</button></div><TaskTable tasks={filteredTasks} onEdit={editTask} onDelete={removeTask} /></section>}

        {!loading && tab === "notice" && <div className="notice-layout"><section className="panel form-panel"><div className="section-title"><div><p className="eyebrow">NOTICE FORM</p><h2>{editingNotice ? "안내사항 수정" : "안내사항 등록"}</h2></div></div><form onSubmit={saveNotice} className="notice-form"><label>날짜<input required type="date" value={noticeForm.date} onChange={(e) => setNoticeForm({ ...noticeForm, date: e.target.value })} /></label><label>안내 내용<textarea required value={noticeForm.content} onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })} /></label><label>안내 부서<input value={noticeForm.department} onChange={(e) => setNoticeForm({ ...noticeForm, department: e.target.value })} /></label><label>대상<input value={noticeForm.target} onChange={(e) => setNoticeForm({ ...noticeForm, target: e.target.value })} /></label><label>비고<textarea value={noticeForm.note} onChange={(e) => setNoticeForm({ ...noticeForm, note: e.target.value })} /></label><div className="form-actions"><button className="primary" disabled={busy}>저장</button>{editingNotice && <button type="button" onClick={() => { setEditingNotice(null); setNoticeForm(emptyNotice()); }}>취소</button>}</div></form></section>
          <section className="panel"><div className="section-title"><h2>안내사항</h2><span>{notices.length}건</span></div><div className="notice-list">{notices.length ? notices.map((notice) => <article className="notice-card" key={notice.row}><div><time>{displayDate(notice.date)} ({notice.day})</time><h3>{notice.content}</h3><p>{[notice.department, notice.target].filter(Boolean).join(" · ")}</p>{notice.note && <small>{notice.note}</small>}</div><div className="row-actions"><button className="small" onClick={() => { setEditingNotice(notice.row); setNoticeForm({ date: notice.date, content: notice.content, department: notice.department, target: notice.target, note: notice.note }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>수정</button><button className="small danger" onClick={() => removeNotice(notice)}>삭제</button></div></article>) : <p className="empty">등록된 안내사항이 없습니다.</p>}</div></section>
        </div>}
      </main>
      <footer>해남제일중학교 · Google Sheets 연동 업무 공유 시스템</footer>
    </>
  );
}
