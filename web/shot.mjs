// Captura uma screenshot do painel rodando (localhost:8090) para o README/release.
// Uso: ter o painel no ar (python main.py) e rodar: node shot.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL || 'http://localhost:8090';
const OUT = process.env.SHOT_OUT || '../docs/painel.png';

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 820, height: 1400 },
  deviceScaleFactor: 2,
});
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500); // deixa a contagem animada assentar
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
console.log('screenshot salvo em', OUT);
