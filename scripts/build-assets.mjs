import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
};

const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(
    new URL(request.url, "http://127.0.0.1").pathname,
  );
  const file = path.resolve(
    root,
    `.${pathname === "/" ? "/index.html" : pathname}`,
  );
  if (!file.startsWith(root)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const info = await stat(file);
    if (!info.isFile()) {
      response.writeHead(404).end();
      return;
    }
    const content = await readFile(file);
    response.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
    });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      response.writeHead(404).end();
      return;
    }
    console.error(error);
    response.writeHead(500).end();
  }
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const source = process.argv[2];
  if (source) {
    const imageMime = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
    }[path.extname(source).toLowerCase()];
    if (!imageMime)
      throw new Error("Avatar must be a PNG, JPEG, or WebP image.");
    const bytes = await readFile(source);
    const uri = `data:${imageMime};base64,${bytes.toString("base64")}`;
    for (const [name, size] of [
      ["avatar.webp", 960],
      ["avatar-480.webp", 480],
      ["avatar-96.webp", 96],
    ]) {
      const encoded = await page.evaluate(
        async ({ uri, size }) => {
          const image = new Image();
          image.src = uri;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = size;
          const context = canvas.getContext("2d");
          const crop = Math.min(image.naturalWidth, image.naturalHeight);
          context.drawImage(
            image,
            (image.naturalWidth - crop) / 2,
            (image.naturalHeight - crop) / 2,
            crop,
            crop,
            0,
            0,
            size,
            size,
          );
          return canvas.toDataURL("image/webp", 0.88).split(",")[1];
        },
        { uri, size },
      );
      await writeFile(
        path.join(root, "assets", name),
        Buffer.from(encoded, "base64"),
      );
    }
    console.log(
      "Generated responsive avatar images; source metadata is not copied.",
    );
  } else {
    await stat(path.join(root, "assets/avatar.webp"));
  }

  await page.goto(base);
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(`<!doctype html><html lang="en"><head>
    <style>
      @font-face{font-family:Reddit;src:url("${base}/assets/fonts/reddit-sans-latin.woff2") format("woff2");font-weight:400 700}
      *{box-sizing:border-box}body{margin:0;background:#eef0f3;color:#0b0c0e;font-family:Reddit,system-ui,sans-serif}
      main{display:grid;grid-template-columns:1.3fr 1fr;align-items:center;gap:40px;width:1200px;height:630px;padding:56px}
      .name{font-size:26px;font-weight:500;letter-spacing:-1px;margin:0 0 28px}
      h1{font-weight:500;font-size:82px;line-height:1.02;letter-spacing:-4px;margin:0}
      h1 span{color:#1f2de6}.role{font-size:20px;line-height:1.5;margin:32px 0 0}
      img{width:100%;border-radius:24px}.url{font-size:16px;color:#5d6470;margin:12px 0 0}
    </style></head><body><main><div>
      <p class="name">Xingtai Li</p>
      <h1>Building <span>AI</span><br>that works<br>at scale.</h1>
      <p class="role">Senior Staff Machine Learning Engineer &#183; Adobe</p>
      <p class="url">listar60.github.io</p>
    </div><img src="${base}/assets/avatar.webp" alt="Illustrated portrait of Xingtai Li"></main></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.locator("img").evaluate(async (image) => image.decode());
  await page.screenshot({
    path: path.join(root, "assets/social-preview.png"),
  });
  console.log("Generated 1200x630 social preview.");
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
