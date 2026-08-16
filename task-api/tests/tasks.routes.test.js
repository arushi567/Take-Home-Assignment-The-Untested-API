const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

beforeEach(() => {
  taskService._reset();
});

describe('error handling', () => {
  test('malformed JSON body is caught by the error handler and returns 500', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Content-Type', 'application/json')
      .send('{ this is not valid json');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });
});

describe('POST /tasks', () => {
  test('creates a task and returns 201', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'Write tests', priority: 'high' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Write tests');
    expect(res.body.priority).toBe('high');
    expect(res.body.id).toBeDefined();
  });

  test('400s when title is missing', async () => {
    const res = await request(app).post('/tasks').send({ priority: 'high' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/i);
  });

  test('400s when title is an empty/whitespace string', async () => {
    const res = await request(app).post('/tasks').send({ title: '   ' });
    expect(res.status).toBe(400);
  });

  test('400s on an invalid status', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'x', status: 'not-a-status' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/i);
  });

  test('400s on an invalid priority', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'x', priority: 'urgent' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/priority/i);
  });

  test('400s on a dueDate that is not a valid date string', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'x', dueDate: 'not-a-date' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/dueDate/i);
  });
});

describe('GET /tasks', () => {
  test('returns an empty array when there are no tasks', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns all tasks', async () => {
    await request(app).post('/tasks').send({ title: 'a' });
    await request(app).post('/tasks').send({ title: 'b' });

    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('filters by status', async () => {
    await request(app).post('/tasks').send({ title: 'a', status: 'todo' });
    await request(app).post('/tasks').send({ title: 'b', status: 'done' });

    const res = await request(app).get('/tasks?status=done');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('b');
  });

  test('paginates with page and limit', async () => {
    for (let i = 1; i <= 5; i++) {
      await request(app).post('/tasks').send({ title: `Task ${i}` });
    }

    const res = await request(app).get('/tasks?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((t) => t.title)).toEqual(['Task 1', 'Task 2']);
  });

  test('an out-of-range page returns an empty array rather than erroring', async () => {
    await request(app).post('/tasks').send({ title: 'only one' });

    const res = await request(app).get('/tasks?page=99&limit=10');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /tasks/stats', () => {
  test('returns counts by status plus an overdue count', async () => {
    await request(app).post('/tasks').send({ title: 'a', status: 'todo' });
    await request(app)
      .post('/tasks')
      .send({ title: 'overdue', dueDate: '2020-01-01T00:00:00.000Z' });

    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body.todo).toBe(2);
    expect(res.body.overdue).toBe(1);
  });

  test('returns all zeros when there are no tasks', async () => {
    const res = await request(app).get('/tasks/stats');
    expect(res.body).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });
});

describe('PUT /tasks/:id', () => {
  test('updates an existing task', async () => {
    const created = await request(app).post('/tasks').send({ title: 'old' });

    const res = await request(app)
      .put(`/tasks/${created.body.id}`)
      .send({ title: 'new' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('new');
  });

  test('404s when the task does not exist', async () => {
    const res = await request(app).put('/tasks/does-not-exist').send({ title: 'new' });
    expect(res.status).toBe(404);
  });

  test('400s when the update body is invalid', async () => {
    const created = await request(app).post('/tasks').send({ title: 'old' });

    const res = await request(app)
      .put(`/tasks/${created.body.id}`)
      .send({ status: 'not-a-status' });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /tasks/:id', () => {
  test('deletes an existing task and returns 204', async () => {
    const created = await request(app).post('/tasks').send({ title: 'to delete' });

    const res = await request(app).delete(`/tasks/${created.body.id}`);
    expect(res.status).toBe(204);

    const getRes = await request(app).get('/tasks');
    expect(getRes.body).toHaveLength(0);
  });

  test('404s when the task does not exist', async () => {
    const res = await request(app).delete('/tasks/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  test('marks a task as done and sets completedAt', async () => {
    const created = await request(app).post('/tasks').send({ title: 'finish me' });

    const res = await request(app).patch(`/tasks/${created.body.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.completedAt).not.toBeNull();
  });

  test('404s when the task does not exist', async () => {
    const res = await request(app).patch('/tasks/does-not-exist/complete');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /tasks/:id/assign', () => {
  test('assigns a task and returns the updated task', async () => {
    const created = await request(app).post('/tasks').send({ title: 'assign me' });

    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: 'Priya' });

    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Priya');
    expect(res.body.id).toBe(created.body.id);
  });

  test('404s when the task does not exist', async () => {
    const res = await request(app)
      .patch('/tasks/does-not-exist/assign')
      .send({ assignee: 'Priya' });

    expect(res.status).toBe(404);
  });

  test('400s when assignee is missing', async () => {
    const created = await request(app).post('/tasks').send({ title: 'assign me' });

    const res = await request(app).patch(`/tasks/${created.body.id}/assign`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/assignee/i);
  });

  test('400s when assignee is an empty string', async () => {
    const created = await request(app).post('/tasks').send({ title: 'assign me' });

    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: '   ' });

    expect(res.status).toBe(400);
  });

  test('400s when assignee is not a string', async () => {
    const created = await request(app).post('/tasks').send({ title: 'assign me' });

    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: 123 });

    expect(res.status).toBe(400);
  });

  test('reassigning an already-assigned task overwrites the assignee', async () => {
    const created = await request(app).post('/tasks').send({ title: 'assign me' });
    await request(app).patch(`/tasks/${created.body.id}/assign`).send({ assignee: 'Priya' });

    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: 'Arjun' });

    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Arjun');
  });

  test('trims whitespace around the assignee name', async () => {
    const created = await request(app).post('/tasks').send({ title: 'assign me' });

    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: '  Priya  ' });

    expect(res.body.assignee).toBe('Priya');
  });
});
