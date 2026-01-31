#!/bin/bash

Directory="./web"

cat << 'EOF' | bun -
const server = Bun.serve({
  port: 8080,
  async fetch(req) {
    const url = new URL(req.url);
    let path = "./web" + url.pathname;
    if (path.endsWith("/")) path += "index.html";

    const file = Bun.file(path);
    if (!(await file.exists())) {
      return new Response("File not found: " + path, { status: 404 });
    }

    console.log("200: " + path);
    return new Response(file);
  },
});
console.log("🚀 Serving ./web at http://localhost:8080");
EOF

