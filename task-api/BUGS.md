# Bug Report

Found by writing tests in `tests/taskService.test.js` and `tests/tasks.routes.test.js` and testing the endpoints via curl. I have documented four bugs below.

I chose to fix the **pagination offset bug (#2)** because it affects a documented user-facing feature and has a clearly defined expected behaviour. The fix was small, easy to verify with tests, and low risk compared to the other issues I found.

---

### 1. `getByStatus` matches on substring, not exact status

**Where:** `src/services/taskService.js`, line 9

**Expected:** `GET /tasks?status=done` should strictly return tasks whose status is `"done"`.

**Actual:** The code uses `String.prototype.includes()`. A query for `status=do` returns every task with the status `"todo"` because "do" is a substring of "todo".

**How I found it:** While writing the filter test, I passed a junk value (`od`) to check the empty-result path and received tasks back instead of an empty array.

**Suggested fix:** Use exact equality matching instead of a substring check:

```javascript
const getByStatus = (status) => tasks.filter((t) => t.status === status);
```

---

### 2. Pagination offset is off by one page [FIXED]

**Where:** `src/services/taskService.js`, `getPaginated`

**Expected:** With 1-indexed pages, `page=1, limit=10` should return the first 10 tasks (items 0–9).

**Actual:** `offset = page * limit` means `page=1, limit=10` evaluates to an offset of 10, returning items 10–19. It completely skips the first page of results.

**How I found it:** I created 5 tasks and requested `page=1&limit=2` expecting the first two, but got items 3 and 4 back instead.

**Fix applied:**

```javascript
const getPaginated = (page, limit) => {
  const safePage = page > 0 ? page : 1;
  const safeLimit = limit > 0 ? limit : 10;
  const offset = (safePage - 1) * safeLimit;
  return tasks.slice(offset, offset + safeLimit);
};
```

Also added basic safeguards against negative page and limit values if the service is called directly.

---

### 3. `PUT` endpoint allows the caller to overwrite system-owned fields

**Where:** `src/services/taskService.js`, `update`

**Expected:** `PUT /tasks/:id` should only update editable fields (title, description, status, priority, dueDate).

**Actual:** The `fields` object is spread directly onto the existing task with no allowlist. If the request body includes an `id`, it silently overwrites it. Because lookups are keyed by `id`, the task becomes orphaned under its original identifier.

**How I found it:** I noticed `validateUpdateTask` doesn't check for an `id` field in the body, which prompted me to test what happens if I manually pass one in a PUT request.

**Suggested fix:** Implement an allowlist of editable fields before merging updates.

---

### 4. `completeTask` resets `priority` to `'medium'` on every completion

**Where:** `src/services/taskService.js`, `completeTask`

**Expected:** Marking a task as complete should change `status` and `completedAt`. It should not alter the task's priority.

**Actual:** The function hardcodes `priority: 'medium'` into the updated object. A `high` priority task silently drops to `medium` upon completion.

**How I found it:** I created a `high` priority task, called `PATCH /tasks/:id/complete`, and noticed the priority changed without me requesting it.

**Suggested fix:** Remove the `priority` override so the completion operation only updates status and completion metadata.