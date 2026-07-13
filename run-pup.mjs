import puppeteer from 'puppeteer';
import fs from 'fs';
import { SourceMapConsumer } from 'source-map';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('pageerror', async (err) => {
    console.log('PAGE ERROR:', err.toString());
    
    const stack = err.stack;
    console.log('STACK:', stack);
    
    const match = stack.match(/assets\/index-.*\.js:(\d+):(\d+)/);
    if (match) {
      const line = parseInt(match[1], 10);
      const column = parseInt(match[2], 10);
      const files = fs.readdirSync('dist/assets');
      const mapFile = files.find(f => f.endsWith('.js.map'));
      if (mapFile) {
        const mapData = JSON.parse(fs.readFileSync('dist/assets/' + mapFile, 'utf8'));
        await SourceMapConsumer.with(mapData, null, consumer => {
          const pos = consumer.originalPositionFor({ line, column });
          console.log('ORIGINAL POS:', pos);
        });
      }
    }
  });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto('http://localhost:3000/');
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
