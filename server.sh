#!/bin/bash

# Directory to serve - change this to serve a different directory
WEB_DIR="./web"

cat << EOF | bun -
const server = Bun.serve({
  port: 8080,
  async fetch(req) {
    const url = new URL(req.url);
    let path = "${WEB_DIR}" + url.pathname;
    if (path.endsWith("/")) path += "index.html";

    const file = Bun.file(path);
    if (!(await file.exists())) {
      return new Response("File not found: " + path, { status: 404 });
    }

    console.log("200: " + path);
    return new Response(file);
  },
});
console.log("🚀 Serving ${WEB_DIR} at http://localhost:8080");
EOF

