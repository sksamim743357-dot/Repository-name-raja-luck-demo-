const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!ADMIN_PASSWORD || !SESSION_SECRET) {
  console.error("Set ADMIN_PASSWORD and SESSION_SECRET environment variables before starting.");
  process.exit(1);
}

const DATA_FILE = path.join(__dirname, "data.json");
function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return { users: [], rounds: [], bets: [], nextUserId: 1, nextRoundId: 1001 }; }
}
let db = loadData();
function saveData() { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), { mode: 0o600 }); }

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));
app.use(session({
  name: "raja.sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, "public")));

function cleanUser(u) { return { id: u.id, username: u.username, demoBalance: u.demoBalance }; }
function requireUser(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Please log in." });
  req.user = db.users.find(u => u.id === req.session.userId);
  if (!req.user) return res.status(401).json({ error: "Session expired." });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) return res.status(403).json({ error: "Admin login required." });
  next();
}
function validUsername(s) { return typeof s === "string" && /^[A-Za-z0-9_]{3,24}$/.test(s); }

app.get("/api/status", (req, res) => {
  const user = db.users.find(u => u.id === req.session.userId);
  res.json({ loggedIn: !!user, user: user ? cleanUser(user) : null, isAdmin: !!req.session.isAdmin, demoOnly: true });
});

app.post("/api/register", async (req, res) => {
  const { username, password } = req.body || {};
  if (!validUsername(username)) return res.status(400).json({ error: "Username must be 3–24 letters, numbers, or underscores." });
  if (typeof password !== "string" || password.length < 10 || password.length > 100) return res.status(400).json({ error: "Password must be 10–100 characters." });
  if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) return res.status(409).json({ error: "Username already exists." });
  const user = { id: db.nextUserId++, username, passwordHash: await bcrypt.hash(password, 12), demoBalance: 10000, createdAt: new Date().toISOString() };
  db.users.push(user); saveData();
  req.session.userId = user.id;
  res.status(201).json({ user: cleanUser(user), message: "Demo account created." });
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body || {};
  const user = db.users.find(u => u.username.toLowerCase() === String(username || "").toLowerCase());
  if (!user || !(await bcrypt.compare(String(password || ""), user.passwordHash))) return res.status(401).json({ error: "Invalid username or password." });
  req.session.userId = user.id;
  req.session.isAdmin = false;
  res.json({ user: cleanUser(user) });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", requireUser, (req, res) => res.json({ user: cleanUser(req.user) }));

app.post("/api/bet", requireUser, (req, res) => {
  const { prediction, stake } = req.body || {};
  const amount = Number(stake);
  const validPrediction = typeof prediction === "string" &&
    (["Red", "Green", "Violet"].includes(prediction) || /^Number [0-9]$/.test(prediction));
  if (!validPrediction) return res.status(400).json({ error: "Choose a colour or number." });
  if (!Number.isInteger(amount) || amount < 10 || amount > 5000) return res.status(400).json({ error: "Stake must be 10–5000 demo points." });
  if (amount > req.user.demoBalance) return res.status(400).json({ error: "Not enough demo points." });

  const roundId = db.nextRoundId++;
  const number = Math.floor(Math.random() * 10);
  const colour = (number === 0 || number === 5) ? "Violet" : (number % 2 === 0 ? "Red" : "Green");
  const won = prediction.startsWith("Number ") ? Number(prediction.slice(7)) === number : prediction === colour;
  req.user.demoBalance -= amount;
  if (won) req.user.demoBalance += amount * 2;
  const record = { id: roundId, userId: req.user.id, username: req.user.username, prediction, stake: amount, resultNumber: number, resultColour: colour, outcome: won ? "DEMO WIN" : "DEMO LOSS", createdAt: new Date().toISOString() };
  db.bets.push(record);
  db.rounds.unshift({ id: roundId, number, colour, createdAt: record.createdAt });
  db.rounds = db.rounds.slice(0, 100);
  saveData();
  res.json({ user: cleanUser(req.user), bet: record, latestRounds: db.rounds.slice(0, 10) });
});

app.get("/api/history", requireUser, (req, res) => {
  res.json({
    bets: db.bets.filter(b => b.userId === req.user.id).slice(-100).reverse(),
    rounds: db.rounds.slice(0, 20)
  });
});

app.post("/api/admin/login", async (req, res) => {
  const { username, password } = req.body || {};
  const expectedUser = ADMIN_USER;
  if (String(username || "") !== expectedUser || String(password || "") !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid admin credentials." });
  }
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: "Could not start admin session." });
    req.session.isAdmin = true;
    res.json({ ok: true });
  });
});

app.get("/api/admin/overview", requireAdmin, (req, res) => {
  res.json({
    userCount: db.users.length,
    betCount: db.bets.length,
    totalDemoPoints: db.users.reduce((sum, u) => sum + u.demoBalance, 0),
    users: db.users.map(u => ({ id: u.id, username: u.username, demoBalance: u.demoBalance, createdAt: u.createdAt })),
    bets: db.bets.slice(-30).reverse()
  });
});

app.post("/api/admin/user/:id/reset-demo-balance", requireAdmin, (req, res) => {
  const user = db.users.find(u => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: "User not found." });
  user.demoBalance = 10000;
  saveData();
  res.json({ user: cleanUser(user) });
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`Raja Luck demo server listening on port ${PORT}`));
