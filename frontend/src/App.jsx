import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  Circle,
  ListTodo,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

const API = "/api/todos";

export default function App() {
  const [todos, setTodos] = useState([]);
  const [filter, setFilter] = useState("all");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("manual");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function request(path = "", options = {}) {
    const response = await fetch(`${API}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const detail = Array.isArray(body.detail)
        ? body.detail.map((item) => item.msg).join(". ")
        : body.detail;
      throw new Error(detail || "Something went wrong. Please try again.");
    }
    return response.status === 204 ? null : response.json();
  }

  useEffect(() => {
    request()
      .then(setTodos)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const doneCount = todos.filter((todo) => todo.completed).length;
  const categories = useMemo(
    () => [...new Set(todos.map((todo) => todo.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [todos],
  );
  const visibleTodos = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const filtered = todos.filter(
        (todo) =>
          (filter === "all" ||
            (filter === "active" && !todo.completed) ||
            (filter === "completed" && todo.completed)) &&
          (categoryFilter === "all" || todo.category === categoryFilter) &&
          (!query || [todo.title, todo.category, todo.notes, ...(todo.tags || [])]
            .filter(Boolean).some((value) => value.toLocaleLowerCase().includes(query))),
      );
    if (sortBy === "title") filtered.sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === "category") filtered.sort((a, b) => (a.category || "").localeCompare(b.category || "") || a.title.localeCompare(b.title));
    if (sortBy === "due") filtered.sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999") || a.position - b.position);
    if (sortBy === "newest") filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (sortBy === "manual") filtered.sort((a, b) => a.position - b.position);
    return filtered;
  }, [todos, filter, categoryFilter, search, sortBy]);
  const remaining = todos.length - doneCount;

  async function run(action) {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function addTodo(event) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    run(async () => {
      const added = await request("", {
        method: "POST",
        body: JSON.stringify({
          title: trimmed,
          due_date: dueDate || null,
          category: category.trim() || null,
          tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          notes: notes.trim(),
        }),
      });
      setTodos((items) => [...items, added]);
      setTitle("");
      setDueDate("");
      setCategory("");
      setTags("");
      setNotes("");
    });
  }
  function toggle(todo) {
    run(async () => {
      const updated = await request(`/${todo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: !todo.completed }),
      });
      setTodos((items) =>
        items.map((item) => (item.id === todo.id ? updated : item)),
      );
    });
  }
  function remove(todo) {
    run(async () => {
      await request(`/${todo.id}`, { method: "DELETE" });
      setTodos((items) =>
        items
          .filter((item) => item.id !== todo.id)
          .map((item, i) => ({ ...item, position: i })),
      );
    });
  }
  function move(todo, direction) {
    run(async () =>
      setTodos(
        await request(`/${todo.id}/move?direction=${direction}`, {
          method: "POST",
        }),
      ),
    );
  }
  function editTodo(todo) {
    setEditingId(todo.id);
    setEditDraft({
      title: todo.title,
      due_date: todo.due_date || "",
      category: todo.category || "",
      tags: (todo.tags || []).join(", "),
      notes: todo.notes || "",
    });
  }
  function saveTodo(event, todo) {
    event.preventDefault();
    run(async () => {
      const updated = await request(`/${todo.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editDraft.title.trim(),
          due_date: editDraft.due_date || null,
          category: editDraft.category.trim() || null,
          tags: editDraft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          notes: editDraft.notes.trim(),
        }),
      });
      setTodos((items) => items.map((item) => (item.id === todo.id ? updated : item)));
      setEditingId(null);
      setEditDraft(null);
    });
  }
  const canReorder = sortBy === "manual" && filter === "all" && !search.trim() && categoryFilter === "all";
  function formatDueDate(value) {
    if (!value) return "";
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(year, month - 1, day));
  }
  function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Taskly home">
          <span className="brand-mark">
            <ListTodo size={18} strokeWidth={2.3} />
          </span>
          <span>Taskly</span>
        </a>
        <span className="local-label">
          <span className="live-dot" /> YOUR PRIVATE SPACE
        </span>
      </header>
      <section className="hero" id="top">
        <div className="eyebrow">
          <span className="eyebrow-line" /> YOUR DAY, IN FOCUS
        </div>
        <h1>
          Make room for
          <br />
          <em>what matters.</em>
        </h1>
        <p className="intro">
          A little clarity goes a long way. Capture what’s on your mind, then
          take it one task at a time.
        </p>
        <div className="date-card">
          <div className="date-glyph">✳</div>
          <div>
            <div className="date-kicker">A FRESH START</div>
            <div className="date-title">One thing at a time.</div>
          </div>
          <span className="date-spark">✳</span>
        </div>
      </section>
      <section className="todo-panel" aria-label="Your tasks">
        <div className="panel-heading">
          <div>
            <span className="section-overline">THE LIST</span>
            <h2>
              Your tasks<span className="count-badge">{todos.length}</span>
            </h2>
          </div>
          <div className="progress-wrap">
            <div className="progress-text">
              {doneCount} OF {todos.length} DONE
            </div>
            <div className="progress-track">
              <span
                style={{
                  width: `${todos.length ? (doneCount / todos.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
        <form className="add-form" onSubmit={addTodo}>
          <label className="sr-only" htmlFor="new-task">
            Add a task
          </label>
          <Plus size={19} className="add-icon" />
          <input
            id="new-task"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs your attention?"
            maxLength={240}
          />
          <button
            type="submit"
            disabled={!title.trim() || busy}
            aria-label="Add task"
          >
            <span>Add task</span>
            <Plus size={17} />
          </button>
        </form>
        <div className="task-fields">
          <label>
            <span>Due date</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label="Task due date" />
          </label>
          <label>
            <span>Category</span>
            <input list="category-options" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={40} placeholder="Work, personal…" aria-label="Task category" />
            <datalist id="category-options">{categories.map((value) => <option key={value} value={value} />)}</datalist>
          </label>
          <label className="tags-field">
            <span>Tags <small>comma separated, up to 10</small></span>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="planning, errands" aria-label="Task tags, separated by commas" />
          </label>
          <label className="notes-field">
            <span>Notes <small>optional, up to 5,000 characters</small></span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} placeholder="Add context or details for this task…" aria-label="Task notes" />
          </label>
        </div>
        <div className="list-toolbar">
          <div className="filters" role="group" aria-label="Filter tasks">
            {[
              ["all", "All"],
              ["active", "To do"],
              ["completed", "Done"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={filter === key ? "filter active" : "filter"}
                onClick={() => setFilter(key)}
              >
                {label}
                {key === "active" && (
                  <span className="filter-count">{remaining}</span>
                )}
              </button>
            ))}
          </div>
          <span className="reorder-hint">
            {canReorder ? <>MOVE TASKS <span>↕</span></> : "SORTED VIEW"}
          </span>
        </div>
        <div className="search-toolbar">
          <label className="search-box">
            <Search size={16} />
            <span className="sr-only">Search tasks, categories, or tags</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks, categories, tags…" />
          </label>
          <label className="sort-control">
            <span>Sort</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort tasks">
              <option value="manual">My order</option>
              <option value="due">Due date</option>
              <option value="title">Title A–Z</option>
              <option value="category">Category</option>
              <option value="newest">Recently added</option>
            </select>
          </label>
        </div>
        {categories.length > 0 && (
          <div className="category-filters" role="group" aria-label="Filter by category">
            <button className={categoryFilter === "all" ? "category-filter selected" : "category-filter"} onClick={() => setCategoryFilter("all")}>All categories</button>
            {categories.map((value) => (
              <button key={value} className={categoryFilter === value ? "category-filter selected" : "category-filter"} onClick={() => setCategoryFilter(value)}>{value}</button>
            ))}
          </div>
        )}
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
        <div className="task-list" aria-live="polite">
          {loading ? (
            <div className="empty-state">
              <span className="empty-icon">◌</span>
              <span>Loading your list…</span>
            </div>
          ) : visibleTodos.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">
                {filter === "completed" ? "✳" : "＋"}
              </span>
              <strong>
                {todos.length === 0
                  ? "A clear mind starts here."
                  : search || categoryFilter !== "all"
                    ? "No matching tasks."
                  : filter === "completed"
                    ? "No completed tasks yet."
                    : "You’re all caught up."}
              </strong>
              <span>
                  {todos.length === 0
                    ? "Add your first task above and let it go from mind to done."
                    : search || categoryFilter !== "all"
                      ? "Try another search or category."
                    : filter === "completed"
                    ? "Finished tasks will find their way here."
                    : "Take a breath. You’ve made space for what matters."}
              </span>
            </div>
          ) : (
            visibleTodos.map((todo) => (
              <article
                className={`task-row${todo.completed ? " is-complete" : ""}`}
                key={todo.id}
              >
                <button
                  className="check-button"
                  onClick={() => toggle(todo)}
                  disabled={busy}
                  aria-label={
                    todo.completed
                      ? `Mark ${todo.title} as active`
                      : `Complete ${todo.title}`
                  }
                >
                  {todo.completed ? (
                    <span className="checked">
                      <Check size={13} strokeWidth={3} />
                    </span>
                  ) : (
                    <Circle size={20} strokeWidth={1.6} />
                  )}
                </button>
                <div className="task-content">
                  <span className="task-title">{todo.title}</span>
                  {todo.notes && <p className="task-notes">{todo.notes}</p>}
                  {(todo.due_date || todo.category || todo.tags?.length > 0) && (
                    <div className="task-metadata">
                      {todo.due_date && <span className={`due-chip${!todo.completed && todo.due_date < todayKey() ? " overdue" : ""}`}><CalendarDays size={12} /> {formatDueDate(todo.due_date)}</span>}
                      {todo.category && <span className="category-chip">{todo.category}</span>}
                      {(todo.tags || []).map((tag) => <span className="tag-chip" key={tag}>{tag}</span>)}
                    </div>
                  )}
                  {editingId === todo.id && editDraft && (
                    <form className="edit-task-form" onSubmit={(event) => saveTodo(event, todo)}>
                      <label><span className="sr-only">Task title</span><input required maxLength={240} value={editDraft.title} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} /></label>
                      <label><span className="sr-only">Due date</span><input type="date" value={editDraft.due_date} onChange={(e) => setEditDraft({ ...editDraft, due_date: e.target.value })} /></label>
                      <label><span className="sr-only">Category</span><input maxLength={40} placeholder="Category" value={editDraft.category} onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })} /></label>
                      <label><span className="sr-only">Tags separated by commas</span><input placeholder="Tags, comma separated" value={editDraft.tags} onChange={(e) => setEditDraft({ ...editDraft, tags: e.target.value })} /></label>
                      <label className="edit-notes"><span className="sr-only">Task notes</span><textarea maxLength={5000} placeholder="Notes" value={editDraft.notes} onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })} /></label>
                      <div className="edit-actions"><button type="submit" disabled={busy}>Save</button><button type="button" onClick={() => { setEditingId(null); setEditDraft(null); }}>Cancel</button></div>
                    </form>
                  )}
                </div>
                <div className="row-actions">
                  <button
                    className="move-button"
                    onClick={() => editTodo(todo)}
                    disabled={busy}
                    aria-label={`Edit ${todo.title}`}
                    title="Edit task details"
                  ><Pencil size={15} /></button>
                  {canReorder && (
                    <>
                      <button
                        className="move-button"
                        onClick={() => move(todo, "up")}
                        disabled={busy || todos.findIndex((t) => t.id === todo.id) === 0}
                        aria-label={`Move ${todo.title} up`}
                        title="Move up"
                      ><ArrowUp size={16} /></button>
                      <button
                        className="move-button"
                        onClick={() => move(todo, "down")}
                        disabled={busy || todos.findIndex((t) => t.id === todo.id) === todos.length - 1}
                        aria-label={`Move ${todo.title} down`}
                        title="Move down"
                      ><ArrowDown size={16} /></button>
                    </>
                  )}
                  <button
                    className="delete-button"
                    onClick={() => remove(todo)}
                    disabled={busy}
                    aria-label={`Delete ${todo.title}`}
                    title="Delete task"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
        <footer className="panel-footer">
          <span>
            {remaining === 1 ? "1 task" : `${remaining} tasks`} left to focus on
          </span>
          <span className="footer-leaf">✳</span>
        </footer>
      </section>
      <footer className="site-footer">
        <span>SMALL STEPS. STEADY MOMENTUM.</span>
        <span>
          MADE FOR YOUR EVERYDAY <span className="footer-heart">✳</span>
        </span>
      </footer>
    </main>
  );
}
