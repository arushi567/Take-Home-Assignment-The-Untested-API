# Submission Notes

## Feature Implementation: `PATCH /tasks/:id/assign`

I implemented the new assignment endpoint with the following design decisions:

* **Validation Layering:** Checking for empty or non-string inputs returns `400 Bad Request`. I placed this logic in `validators.js` so the route handler stays thin and consistent with the rest of the codebase.
* **Handling Empty Strings:** An empty assignee string is rejected. Assigning "nobody" is effectively an unassign operation, which would be better handled through a dedicated endpoint or explicit `null` support.
* **Reassignment Is Allowed:** If a task is already assigned, calling the endpoint again overwrites the previous assignee. Task ownership can legitimately change during a workflow, so preventing reassignment felt unnecessarily restrictive.
* **Data Model Consistency:** I updated task creation to initialize `assignee: null` so all task objects share a consistent schema from creation onward.

## Test Coverage (Jest + Supertest)

**Summary (56/56 passing tests):**

* Statements: 96.85%
* Branches: 89.24%
* Functions: 96.66%
* Lines: 96.55%

*The only uncovered lines are the `app.listen` block in `app.js`, which is intentionally bypassed during testing to avoid binding to a network port.*

## What I'd Test Next With More Time

* **Concurrent Updates:** Send multiple update requests against the same task to evaluate how the in-memory store behaves under simultaneous modifications.
* **Combined Query Parameters:** Test requests such as `GET /tasks?status=todo&page=1&limit=5`. The current route implementation treats filtering and pagination as separate execution paths.

## Architectural Observations

1. **Documentation Drift:** The root `README.md` lists valid statuses as `pending | in-progress | completed`, while the application code enforces `todo | in_progress | done`.
2. **Missing Read Route:** The API supports listing, updating, deleting, and completing tasks, but does not currently expose a standard `GET /tasks/:id` endpoint for retrieving a single task.