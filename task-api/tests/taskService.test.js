const taskService = require('../src/services/taskService');

// The store is a module-level array, so clear it before every test.
beforeEach(() => {
  taskService._reset();
});

describe('create', () => {
  test('creates a task with defaults filled in', () => {
    const task = taskService.create({ title: 'Write tests' });

    expect(task.id).toBeDefined();
    expect(task.title).toBe('Write tests');
    expect(task.description).toBe('');
    expect(task.status).toBe('todo');
    expect(task.priority).toBe('medium');
    expect(task.dueDate).toBeNull();
    expect(task.completedAt).toBeNull();
    expect(task.assignee).toBeNull();
    expect(task.createdAt).toBeDefined();
  });

  test('respects fields passed in instead of the defaults', () => {
    const task = taskService.create({
      title: 'Ship feature',
      description: 'Add the assign endpoint',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2026-09-01T00:00:00.000Z',
    });

    expect(task.description).toBe('Add the assign endpoint');
    expect(task.status).toBe('in_progress');
    expect(task.priority).toBe('high');
    expect(task.dueDate).toBe('2026-09-01T00:00:00.000Z');
  });

  test('two tasks get different ids', () => {
    const a = taskService.create({ title: 'a' });
    const b = taskService.create({ title: 'b' });
    expect(a.id).not.toBe(b.id);
  });
});

describe('findById', () => {
  test('returns the task when it exists', () => {
    const created = taskService.create({ title: 'Findable' });
    expect(taskService.findById(created.id)).toEqual(created);
  });

  test('returns undefined when it does not exist', () => {
    expect(taskService.findById('does-not-exist')).toBeUndefined();
  });
});

describe('getAll', () => {
  test('returns every task', () => {
    taskService.create({ title: 'a' });
    taskService.create({ title: 'b' });
    expect(taskService.getAll()).toHaveLength(2);
  });

  test('returns a copy, not the live array (mutating the result should not affect the store)', () => {
    taskService.create({ title: 'a' });
    const all = taskService.getAll();
    all.push({ title: 'injected' });
    expect(taskService.getAll()).toHaveLength(1);
  });
});

describe('getByStatus', () => {
  test('returns tasks matching the given status exactly', () => {
    taskService.create({ title: 'a', status: 'todo' });
    taskService.create({ title: 'b', status: 'done' });

    const done = taskService.getByStatus('done');
    expect(done).toHaveLength(1);
    expect(done[0].title).toBe('b');
  });

  // Note: Tracking a bug here (BUGS.md #1) where getByStatus uses .includes() 
  // instead of an exact match. This test documents the current buggy behavior.
  test('currently matches on substring, not exact status (documented bug)', () => {
    taskService.create({ title: 'a', status: 'todo' });

    const result = taskService.getByStatus('od');
    expect(result).toHaveLength(1); // Should ideally be 0
  });
});

describe('getPaginated', () => {
  beforeEach(() => {
    for (let i = 1; i <= 5; i++) {
      taskService.create({ title: `Task ${i}` });
    }
  });

  // This covers the fix for BUGS.md #2. The offset used to be calculated incorrectly.
  test('page 1 returns the first `limit` tasks', () => {
    const page1 = taskService.getPaginated(1, 2);
    expect(page1.map((t) => t.title)).toEqual(['Task 1', 'Task 2']);
  });

  test('page 2 returns the next `limit` tasks', () => {
    const page2 = taskService.getPaginated(2, 2);
    expect(page2.map((t) => t.title)).toEqual(['Task 3', 'Task 4']);
  });

  test('a page past the end returns an empty array', () => {
    expect(taskService.getPaginated(10, 2)).toEqual([]);
  });

  test('page <= 0 falls back to page 1 instead of returning a negative offset', () => {
    const zero = taskService.getPaginated(0, 2);
    const first = taskService.getPaginated(1, 2);
    expect(zero).toEqual(first);
  });
});

describe('getStats', () => {
  test('counts tasks per status', () => {
    taskService.create({ title: 'a', status: 'todo' });
    taskService.create({ title: 'b', status: 'todo' });
    taskService.create({ title: 'c', status: 'in_progress' });
    taskService.create({ title: 'd', status: 'done' });

    const stats = taskService.getStats();
    expect(stats.todo).toBe(2);
    expect(stats.in_progress).toBe(1);
    expect(stats.done).toBe(1);
  });

  test('counts a task with a past dueDate as overdue when not done', () => {
    taskService.create({ title: 'late', dueDate: '2020-01-01T00:00:00.000Z' });
    expect(taskService.getStats().overdue).toBe(1);
  });

  test('does not count a done task as overdue even with a past dueDate', () => {
    const task = taskService.create({ title: 'late but done', dueDate: '2020-01-01T00:00:00.000Z' });
    taskService.completeTask(task.id);
    expect(taskService.getStats().overdue).toBe(0);
  });

  test('does not count a task with no dueDate as overdue', () => {
    taskService.create({ title: 'no due date' });
    expect(taskService.getStats().overdue).toBe(0);
  });
});

describe('update', () => {
  test('merges the given fields into the existing task', () => {
    const task = taskService.create({ title: 'old title' });
    const updated = taskService.update(task.id, { title: 'new title' });

    expect(updated.title).toBe('new title');
    expect(updated.id).toBe(task.id);
  });

  test('returns null when the task does not exist', () => {
    expect(taskService.update('missing-id', { title: 'x' })).toBeNull();
  });

  // Note: Bug #3 in BUGS.md. update() lacks an allowlist, so passing an `id` 
  // silently overwrites the system ID. Documenting current behavior here.
  test('currently lets the id field be overwritten via update (documented bug)', () => {
    const task = taskService.create({ title: 'orig' });
    const updated = taskService.update(task.id, { id: 'hijacked-id' });

    expect(updated.id).toBe('hijacked-id');
    expect(taskService.findById(task.id)).toBeUndefined();
  });
});

describe('remove', () => {
  test('deletes an existing task and returns true', () => {
    const task = taskService.create({ title: 'to delete' });
    expect(taskService.remove(task.id)).toBe(true);
    expect(taskService.findById(task.id)).toBeUndefined();
  });

  test('returns false when the task does not exist', () => {
    expect(taskService.remove('missing-id')).toBe(false);
  });
});

describe('completeTask', () => {
  test('sets status to done and fills in completedAt', () => {
    const task = taskService.create({ title: 'finish me' });
    const completed = taskService.completeTask(task.id);

    expect(completed.status).toBe('done');
    expect(completed.completedAt).not.toBeNull();
  });

  test('returns null when the task does not exist', () => {
    expect(taskService.completeTask('missing-id')).toBeNull();
  });

  // Note: Bug #4 in BUGS.md. completeTask forces the priority to 'medium'.
  // Leaving this test to track the behavior until it gets properly fixed.
  test('currently resets priority to medium on completion regardless of original priority (documented bug)', () => {
    const task = taskService.create({ title: 'urgent', priority: 'high' });
    const completed = taskService.completeTask(task.id);

    expect(completed.priority).toBe('medium'); // Should ideally still be 'high'
  });
});

describe('assignTask', () => {
  test('sets the assignee on an existing task', () => {
    const task = taskService.create({ title: 'assign me' });
    const assigned = taskService.assignTask(task.id, 'Priya');

    expect(assigned.assignee).toBe('Priya');
  });

  test('returns null when the task does not exist', () => {
    expect(taskService.assignTask('missing-id', 'Priya')).toBeNull();
  });

  test('reassigning overwrites the previous assignee', () => {
    const task = taskService.create({ title: 'assign me' });
    taskService.assignTask(task.id, 'Priya');
    const reassigned = taskService.assignTask(task.id, 'Arjun');

    expect(reassigned.assignee).toBe('Arjun');
  });
});