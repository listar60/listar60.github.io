import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

const viewports = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 820, height: 1180 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 760 },
];

for (const viewport of viewports) {
  test(`complete layout at ${viewport.width}px`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) {
        errors.push(`${response.status()} ${response.url()}`);
      }
    });
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const layout = await page.evaluate(() => {
      const hero = document.querySelector(".hero");
      const art = document.querySelector(".hero__art img");
      return {
        width: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        heroHeight: hero.getBoundingClientRect().height,
        primaryBottom: hero
          .querySelector(".btn--primary")
          .getBoundingClientRect().bottom,
        missingAnchors: [...document.querySelectorAll('a[href^="#"]')]
          .map((link) => link.getAttribute("href"))
          .filter((href) => !document.getElementById(href.slice(1))),
        imagesLoaded: [...document.images].every(
          (image) => image.complete && image.naturalWidth > 0,
        ),
        fontLoaded: [...document.fonts].some(
          (font) => font.family === "Reddit Sans" && font.status === "loaded",
        ),
        artWidth: art.getBoundingClientRect().width,
      };
    });
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width);
    expect(layout.heroHeight).toBeGreaterThanOrEqual(viewport.height);
    expect(layout.primaryBottom).toBeLessThan(viewport.height);
    expect(layout.missingAnchors).toEqual([]);
    expect(layout.imagesLoaded).toBe(true);
    expect(layout.fontLoaded).toBe(true);
    expect(layout.artWidth).toBeGreaterThan(200);
    expect(errors).toEqual([]);

    for (const control of await page
      .locator(
        ".btn, .desktop-navigation a, .mobile-menu summary, .footer-links a",
      )
      .all()) {
      if (await control.isVisible()) {
        const box = await control.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }

    await mkdir(".test-artifacts", { recursive: true });
    await page.screenshot({
      path: `.test-artifacts/${viewport.width}.png`,
      fullPage: true,
    });
    if (viewport.width === 1440 || viewport.width === 390) {
      await page.screenshot({
        path: `.test-artifacts/${viewport.width}-hero.png`,
      });
    }
  });
}

test("WCAG accessibility on desktop and mobile", async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  }
});

test("portrait and interest areas reflect the supplied brief", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("img", { name: "Illustrated portrait of Xingtai Li" }),
  ).toBeVisible();
  const interests = page.locator("#interests");
  await expect(
    interests.getByRole("heading", { name: "Large-scale data systems" }),
  ).toBeVisible();
  await expect(
    interests.getByRole("heading", { name: "Cloud-native ML infrastructure" }),
  ).toBeVisible();
  const copy = await interests.innerText();
  for (const term of [
    "Apache Spark",
    "Apache Flink",
    "Kubernetes",
    "MLOps",
    "Claims automation",
    "damage assessment",
    "outfit suggestions",
    "Image and video editing",
    "generative features",
  ]) {
    expect(copy).toContain(term);
  }
});

test("work cards respond to hover and keep impact figures aligned", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const card = page.locator(".work-card").first();
  await card.hover();
  await expect(card).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, -2)");
  await expect(card.getByRole("link")).toHaveAttribute(
    "href",
    "https://www.adobe.com/products/firefly.html",
  );
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const metrics = await page.locator(".impact dd").evaluateAll((elements) =>
      elements.map((element) => ({
        top: element.getBoundingClientRect().top,
        size: parseFloat(getComputedStyle(element).fontSize),
      })),
    );
    expect(
      Math.max(...metrics.map((metric) => metric.top)) -
        Math.min(...metrics.map((metric) => metric.top)),
    ).toBeLessThan(1);
    const headingSize = await page
      .locator("#work-heading")
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    expect(metrics.every((metric) => metric.size < headingSize)).toBe(true);
  }
});

test("keyboard navigation and the mobile menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeInViewport();

  const menu = page.locator(".mobile-menu");
  const summary = menu.locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(summary).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("body")).toHaveClass("menu-open");
  await page.keyboard.press("Escape");
  await expect(summary).toHaveAttribute("aria-expanded", "false");
  await expect(summary).toBeFocused();

  await summary.click();
  await menu.getByRole("link", { name: "Experience", exact: true }).click();
  await expect(summary).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("body")).not.toHaveClass("menu-open");
  await expect(page).toHaveURL(/#experience$/);
  const headingTop = await page
    .locator("#experience-heading")
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(headingTop).toBeGreaterThanOrEqual(72);
});

test("content remains usable without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4173/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".work-card")).toHaveCount(2);
    await page.locator(".mobile-menu summary").click();
    await expect(
      page
        .locator(".mobile-menu")
        .getByRole("link", { name: "About", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".contact__email")).toHaveAttribute(
      "href",
      "mailto:listar60@gmail.com",
    );
  } finally {
    await context.close();
  }
});

test("reduced motion disables all automatic animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const animationCount = await page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((animation) => animation.playState === "running").length,
  );
  expect(animationCount).toBe(0);
  await expect(page.locator(".hero__copy")).toHaveCSS("opacity", "1");
});

test("resume download, public-safe content, and sharing assets", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const downloadPromise = page.waitForEvent("download");
  await page
    .locator(".hero")
    .getByRole("link", { name: "Download resume" })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Xingtai-Li-Resume.pdf");

  const pdf = await request.get("/assets/xingtai-li-resume.pdf");
  expect(pdf.ok()).toBe(true);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  const image = await request.get("/assets/social-preview.png");
  expect(image.ok()).toBe(true);
  expect((await image.body()).subarray(0, 8).toString("hex")).toBe(
    "89504e470d0a1a0a",
  );

  await page.goto("/resume.html");
  const resume = await page.locator("body").innerText();
  expect(resume).toContain("Senior Staff Machine Learning Engineer");
  expect(resume).toContain("University of California, Davis");
  expect(resume).not.toMatch(/\b\d{5}(?:-\d{4})?\b/);
  expect(resume).not.toMatch(/\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}/);
  expect(resume).not.toContain("Gen6");
  expect(resume).not.toContain("PERSONAL_GH_TOKEN");
});
