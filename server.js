// Zero-dependency Node server: serves the dashboard and stores links in a JSON file.
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const PORT = process.env.PORT || 3000;
const DATA = process.env.DATA_FILE || path.join(__dirname, "data", "state.json");
const PASS = process.env.EDIT_PASSWORD || "";   // optional: require a password to change links
const PUB = path.join(__dirname, "docs");
const TYPES = {".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8"};
fs.mkdirSync(path.dirname(DATA), {recursive:true});

const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, {"Content-Type": type, "Cache-Control": "no-store"}); res.end(body);
};
const err = (res, code, msg) => send(res, code, JSON.stringify({error: msg}));
const valid = d => d && Array.isArray(d.sites) && d.sites.length <= 500 && d.sites.every(s =>
  s && typeof s.name === "string" && s.name.trim() && typeof s.url === "string" &&
  /^https?:\/\//i.test(s.url) && ["social","learning"].includes(s.group));
const same = (a, b) => { const x = Buffer.from(String(a||"")), y = Buffer.from(PASS);
  return x.length === y.length && crypto.timingSafeEqual(x, y); };

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/state") {
    if (req.method === "GET") return fs.readFile(DATA, "utf8", (e, txt) => send(res, 200, e ? "null" : txt));
    if (req.method !== "PUT") return err(res, 405, "Method not allowed");
    if (PASS && !same(req.headers["x-edit-password"], PASS)) return err(res, 401, "Wrong or missing password");
    let body = "", tooBig = false;
    req.on("data", c => { body += c; if (body.length > 1e6) { tooBig = true; req.destroy(); } });
    req.on("end", () => {
      if (tooBig) return;
      let d; try { d = JSON.parse(body); } catch(e) { return err(res, 400, "Invalid JSON"); }
      if (!valid(d)) return err(res, 400, "Invalid data");
      const clean = {sites: d.sites.map(s => ({name: s.name.trim().slice(0,60), url: s.url, group: s.group,
        color: /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : "#2f5bea", pinned: !!s.pinned}))};
      const tmp = DATA + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
      fs.writeFile(tmp, JSON.stringify(clean, null, 2), e => {
        if (e) return err(res, 500, "Could not save");
        fs.rename(tmp, DATA, e2 => e2 ? err(res, 500, "Could not save") : send(res, 200, '{"ok":true}'));
      });
    });
    return;
  }
  const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  if (!/^[\w.-]+$/.test(file) || !TYPES[path.extname(file)]) return err(res, 404, "Not found");
  fs.readFile(path.join(PUB, file), (e, buf) => e ? err(res, 404, "Not found") : send(res, 200, buf, TYPES[path.extname(file)]));
}).listen(PORT, () => console.log("Hub running on http://localhost:" + PORT));
