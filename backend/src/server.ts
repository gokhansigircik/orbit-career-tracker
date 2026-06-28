import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

type User = { id: number; fullName: string; email: string; passwordHash: string; createdAt: string };
type Application = { id: number; userId: number; company: string; role: string; stage: 'Applied' | 'Interviewing' | 'Offer' | 'Rejected'; location: string; salaryBand: string; source: string; createdAt: string };
type Interview = { id: number; applicationId: number; kind: string; scheduledAt: string; note: string };
type Goal = { id: number; userId: number; title: string; status: 'On track' | 'Needs focus'; targetDate: string };
type Database = { users: User[]; applications: Application[]; interviews: Interview[]; goals: Goal[] };
type AuthedRequest = Request & { user?: User };

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8)
});
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const applicationSchema = z.object({
  company: z.string().min(2),
  role: z.string().min(2),
  location: z.string().min(2),
  salaryBand: z.string().min(2),
  source: z.string().min(2)
});
const interviewSchema = z.object({
  applicationId: z.number().int().positive(),
  kind: z.string().min(2),
  scheduledAt: z.string().min(4),
  note: z.string().min(2)
});
const stageSchema = z.object({ stage: z.enum(['Applied', 'Interviewing', 'Offer', 'Rejected']) });

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = process.env.DATA_PATH ?? (process.env.VERCEL ? '/tmp/orbit-career-app.json' : join(__dirname, '..', 'data', 'app.json'));
const jwtSecret = process.env.JWT_SECRET ?? 'orbit-career-secret';

function ensureDb(): Database {
  if (!existsSync(dataPath)) {
    mkdirSync(dirname(dataPath), { recursive: true });
    writeFileSync(dataPath, JSON.stringify({ users: [], applications: [], interviews: [], goals: [] }, null, 2));
  }
  return JSON.parse(readFileSync(dataPath, 'utf8')) as Database;
}
function saveDb(db: Database) {
  mkdirSync(dirname(dataPath), { recursive: true });
  writeFileSync(dataPath, JSON.stringify(db, null, 2));
}
function nextId(items: Array<{ id: number }>) { return items.length ? Math.max(...items.map((item) => item.id)) + 1 : 1; }
function success<T>(data: T, message?: string) { return { success: true, data, ...(message ? { message } : {}) }; }
function authMiddleware(request: AuthedRequest, response: Response, next: NextFunction) {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return response.status(401).json({ success: false, message: 'Missing auth token' });
  try {
    const payload = jwt.verify(header.slice(7), jwtSecret) as jwt.JwtPayload;
    const db = ensureDb();
    const user = db.users.find((entry) => entry.id === Number(payload.sub));
    if (!user) return response.status(401).json({ success: false, message: 'Unknown user' });
    request.user = user;
    next();
  } catch {
    return response.status(401).json({ success: false, message: 'Invalid token' });
  }
}

export const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.json(success({ status: 'UP', service: 'orbit-career-api', timestamp: new Date().toISOString() }));
});

app.post('/api/auth/register', async (request, response) => {
  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? 'Invalid payload' });
  const db = ensureDb();
  const email = parsed.data.email.trim().toLowerCase();
  if (db.users.some((user) => user.email == email)) return response.status(400).json({ success: false, message: 'Email already exists' });
  const user: User = { id: nextId(db.users), fullName: parsed.data.fullName.trim(), email, passwordHash: await bcrypt.hash(parsed.data.password, 10), createdAt: new Date().toISOString() };
  db.users.push(user);
  db.goals.push(
    { id: nextId(db.goals), userId: user.id, title: 'Apply to 15 aligned roles', status: 'On track', targetDate: '2026-07-15' },
    { id: nextId([...db.goals, { id: 0 } as Goal]), userId: user.id, title: 'Convert 3 screens to interviews', status: 'Needs focus', targetDate: '2026-07-22' }
  );
  saveDb(db);
  const token = jwt.sign({ email: user.email }, jwtSecret, { subject: String(user.id), expiresIn: '24h' });
  response.json(success({ userId: user.id, fullName: user.fullName, email: user.email, token }, 'Account created'));
});

app.post('/api/auth/login', async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ success: false, message: 'Invalid payload' });
  const db = ensureDb();
  const user = db.users.find((entry) => entry.email === parsed.data.email.trim().toLowerCase());
  if (!user) return response.status(400).json({ success: false, message: 'Invalid credentials' });
  const matches = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!matches) return response.status(400).json({ success: false, message: 'Invalid credentials' });
  const token = jwt.sign({ email: user.email }, jwtSecret, { subject: String(user.id), expiresIn: '24h' });
  response.json(success({ userId: user.id, fullName: user.fullName, email: user.email, token }));
});

app.get('/api/applications', authMiddleware, (request: AuthedRequest, response) => {
  const db = ensureDb();
  const apps = db.applications.filter((entry) => entry.userId === request.user!.id).map((entry) => ({
    ...entry,
    interviews: db.interviews.filter((interview) => interview.applicationId === entry.id)
  }));
  response.json(success(apps));
});

app.post('/api/applications', authMiddleware, (request: AuthedRequest, response) => {
  const parsed = applicationSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ success: false, message: 'Invalid application payload' });
  const db = ensureDb();
  const application: Application = {
    id: nextId(db.applications), userId: request.user!.id,
    company: parsed.data.company.trim(), role: parsed.data.role.trim(), stage: 'Applied',
    location: parsed.data.location.trim(), salaryBand: parsed.data.salaryBand.trim(), source: parsed.data.source.trim(), createdAt: new Date().toISOString()
  };
  db.applications.push(application);
  saveDb(db);
  response.json(success(application, 'Application created'));
});

app.patch('/api/applications/:id/stage', authMiddleware, (request: AuthedRequest, response) => {
  const parsed = stageSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ success: false, message: 'Invalid stage payload' });
  const db = ensureDb();
  const application = db.applications.find((entry) => entry.id === Number(request.params.id) && entry.userId === request.user!.id);
  if (!application) return response.status(404).json({ success: false, message: 'Application not found' });
  application.stage = parsed.data.stage;
  saveDb(db);
  response.json(success(application));
});

app.post('/api/interviews', authMiddleware, (request: AuthedRequest, response) => {
  const parsed = interviewSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ success: false, message: 'Invalid interview payload' });
  const db = ensureDb();
  const application = db.applications.find((entry) => entry.id == parsed.data.applicationId && entry.userId === request.user!.id);
  if (!application) return response.status(404).json({ success: false, message: 'Application not found' });
  const interview: Interview = { id: nextId(db.interviews), applicationId: application.id, kind: parsed.data.kind.trim(), scheduledAt: parsed.data.scheduledAt, note: parsed.data.note.trim() };
  db.interviews.push(interview);
  application.stage = 'Interviewing';
  saveDb(db);
  response.json(success(interview, 'Interview scheduled'));
});

app.get('/api/dashboard', authMiddleware, (request: AuthedRequest, response) => {
  const db = ensureDb();
  const applications = db.applications.filter((entry) => entry.userId === request.user!.id);
  const goals = db.goals.filter((entry) => entry.userId === request.user!.id);
  const upcomingInterviews = db.interviews.filter((interview) => {
    const app = applications.find((entry) => entry.id === interview.applicationId);
    return Boolean(app);
  }).map((interview) => {
    const app = applications.find((entry) => entry.id === interview.applicationId)!;
    return { ...interview, company: app.company, role: app.role };
  });
  const byStage = ['Applied', 'Interviewing', 'Offer', 'Rejected'].map((stage) => ({ stage, count: applications.filter((entry) => entry.stage === stage).length }));
  response.json(success({
    metrics: [
      { label: 'Pipeline', value: String(applications.length), trend: '+4 this week' },
      { label: 'Interviews', value: String(upcomingInterviews.length), trend: 'live schedule' },
      { label: 'Focus score', value: goals.some((goal) => goal.status === 'Needs focus') ? '74' : '91', trend: 'goal alignment' }
    ],
    goals,
    byStage,
    upcomingInterviews
  }));
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  console.error(error);
  response.status(500).json({ success: false, message: 'Unexpected server error' });
});

const port = Number(process.env.PORT ?? 8090);
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(port, () => console.log(`orbit-career-api listening on http://localhost:${port}`));
}
