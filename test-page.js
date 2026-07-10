import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('response', response => {
    if (!response.ok()) {
      console.log('404 URL:', response.url());
    }
  });
  await page.goto('http://127.0.0.1:3000');
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
