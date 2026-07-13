import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('pageerror', (err) => {
    console.log('PAGE ERROR:', err.toString());
  });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto('http://localhost:3000/#/login');
  await new Promise(r => setTimeout(r, 1000));
  
  // Fill login
  await page.type('input[type="text"]', 'admin');
  await page.type('input[type="password"]', 'password');
  await page.click('button[type="submit"]');
  
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
