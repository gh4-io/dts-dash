import puppeteer from "puppeteer-core";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:3000";

const pages = ["/flight-board", "/dashboard"];

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900"],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();

  // Login first
  console.log("Logging in...");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });
  await page.type('input[name="email"]', "admin@cvg.local");
  await page.type('input[name="password"]', "admin123");
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 });
  console.log("Logged in, now at:", page.url());

  for (const route of pages) {
    console.log(`Navigating to ${route}...`);
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle2", timeout: 15000 });
    // Wait for dynamic content
    await new Promise((r) => setTimeout(r, 3000));
    const filename = route.replace("/", "").replace("/", "-") + "-screenshot.png";
    await page.screenshot({ path: filename, fullPage: true });
    console.log(`Saved: ${filename}`);
  }

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
