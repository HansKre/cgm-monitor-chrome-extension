const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 4173);
const rootDir = path.resolve(__dirname, "..");
const debugDir = path.resolve(__dirname);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

const sendFile = (response, filePath) => {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const extension = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extension] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(content);
  });
};

const server = http.createServer((request, response) => {
  const requestUrl = new URL(
    request.url || "/",
    `http://${request.headers.host}`,
  );

  if (requestUrl.pathname === "/" || requestUrl.pathname === "/index.html") {
    sendFile(response, path.join(debugDir, "graph-preview.html"));
    return;
  }

  if (requestUrl.pathname === "/graph-preview.js") {
    sendFile(response, path.join(debugDir, "graph-preview.js"));
    return;
  }

  if (requestUrl.pathname === "/graph-data.json") {
    sendFile(response, path.join(rootDir, "graph-data.json"));
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

server.listen(port, () => {
  console.log(`Graph preview server listening on http://127.0.0.1:${port}`);
});
