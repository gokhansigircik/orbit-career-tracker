import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from '../src/server';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '..', 'data', 'app.json');

afterEach(() => {
  if (existsSync(dataPath)) rmSync(dataPath, { force: true });
});

describe('orbit career backend', () => {
  it('returns health status', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('registers a user, creates an application, and returns dashboard data', async () => {
    const register = await request(app).post('/api/auth/register').send({
      fullName: 'Career Builder', email: 'builder@orbit.dev', password: 'Password123'
    });
    expect(register.status).toBe(200);
    const token = register.body.data.token;

    const created = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ company: 'Linear', role: 'Frontend Engineer', location: 'Remote', salaryBand: '$110k-$140k', source: 'Referral' });

    expect(created.status).toBe(200);

    const dashboard = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.metrics[0].value).toBe('1');
  });
});
