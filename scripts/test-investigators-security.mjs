const BASE = "https://app.interligens.com";
const FAKE_ID = "clfake00000000000000000000";

const routes = [
  { method: "GET",  path: "/api/investigators/cases",                                       name: "list cases" },
  { method: "GET",  path: "/api/investigators/workspace/metrics",                           name: "workspace metrics" },
  { method: "POST", path: "/api/investigators/cases",                                       name: "create case", body: { title: "x" } },
  { method: "GET",  path: `/api/investigators/cases/${FAKE_ID}`,                            name: "fetch fake case" },
  { method: "GET",  path: `/api/investigators/cases/${FAKE_ID}/entities`,                   name: "fetch fake entities" },
  { method: "POST", path: `/api/investigators/cases/${FAKE_ID}/assistant`,                  name: "call assistant", body: { messages: [] } },
  { method: "GET",  path: `/api/investigators/cases/${FAKE_ID}/intelligence-summary`,       name: "intel summary" },
];

const results = [];

for (const r of routes) {
  try {
    const res = await fetch(BASE + r.path, {
      method: r.method,
      headers: { "Content-Type": "application/json" },
      body: r.body ? JSON.stringify(r.body) : undefined,
    });
    const status = res.status;
    const pass = status === 401 || status === 403;
    results.push({ ...r, status, pass });
    console.log(`${pass ? "PASS" : "FAIL"} ${r.method} ${r.path} → ${status} (${r.name})`);
  } catch (err) {
    results.push({ ...r, status: "ERR", pass: false, err: String(err).slice(0, 100) });
    console.log(`ERR  ${r.method} ${r.path} → ${String(err).slice(0, 60)}`);
  }
}

const passed = results.filter((r) => r.pass).length;
console.log(`\nSUMMARY: ${passed}/${results.length} passed`);
process.stdout.write("\n__JSON__\n" + JSON.stringify(results) + "\n");
