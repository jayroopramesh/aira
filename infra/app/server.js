// Dummy app the infra runs so "is it working" is answerable in a browser.
// No LLM endpoint, no auth, no escrow logic -- just health + region, until
// the real auth+escrow API (infra/README.md, aira-tofu-plan-s10/report.md §2)
// gets built.
const http = require("http");

const PORT = process.env.PORT || 8080;
const REGION = process.env.AZURE_REGION || "unknown";
const SERVICE = "aira-dummy";

const server = http.createServer((req, res) => {
  const body = JSON.stringify({
    status: "ok",
    service: SERVICE,
    region: REGION,
    path: req.url,
    timestamp: new Date().toISOString(),
  });
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(body);
});

server.listen(PORT, () => {
  console.log(`${SERVICE} listening on :${PORT} (region=${REGION})`);
});
