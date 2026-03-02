import { describe, it, expect } from 'vitest';
import { apiOk, apiError } from '../api-response';

describe('apiOk', () => {
  it('returns 200 with success:true and data', async () => {
    const res = apiOk({ foo: 'bar' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, data: { foo: 'bar' } });
  });

  it('accepts a custom status code', async () => {
    const res = apiOk({ created: true }, 201);
    expect(res.status).toBe(201);
  });
});

describe('apiError', () => {
  it('returns 500 with success:false and error message by default', async () => {
    const res = apiError('Something went wrong');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'Something went wrong' });
  });

  it('accepts a custom status code', async () => {
    const res = apiError('Not found', 404);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Not found');
  });
});
