const puppeteer = global.get('puppeteer');
const sharp = global.get('sharp');
const moment = global.get('moment');
const { date } = msg.date;
const myenv = flow.get("myenv");

const dateBefore = moment(date, 'MM/DD/YYYY').subtract(1, 'days').format('MM/DD/YYYY');

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

async function captureAndCrop(page, extractOptions) {
    const screenshotBuffer = await page.screenshot({
        encoding: 'binary',
        fullPage: true,
        type: 'png',
        optimizeForSpeed: true,
        omitBackground: true,
        fromSurface: false,
        captureBeyondViewport: false
    });
    const imageMetadata = await sharp(screenshotBuffer).metadata();

    if (extractOptions.left + extractOptions.width > imageMetadata.width) {
        extractOptions.width = imageMetadata.width - extractOptions.left;
    }
    if (extractOptions.top + extractOptions.height > imageMetadata.height) {
        extractOptions.height = imageMetadata.height - extractOptions.top;
    }

    const croppedImageBuffer = await sharp(screenshotBuffer)
        .extract(extractOptions)
        .toBuffer();

    return croppedImageBuffer;
}

return (async function () {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        ignoreHTTPSErrors: true,
        headless: true,
        dumpio: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--headless',
            '--disable-gpu',
            '--disable-software-rasterizer'
        ],
        timeout: 5000  // Set global timeout to 5 seconds
    });
    const page = await browser.newPage();
    await page.setViewport({
        width: 1440,
        height: 1080
    });
    try {
        
        await page.goto(myenv.BMAaiURL, { waitUntil: 'networkidle2', timeout: 5000 }); // Set navigation timeout to 5 seconds
        await delay(5000);

        // Wait for the initial button to be available in the DOM and visible
        await page.waitForSelector('button.w-full.flex.justify-center.items-center', { visible: true, timeout: 3000 });
        
        // Click the initial button
        await page.click('button.w-full.flex.justify-center.items-center');
        await page.evaluate(() => {
            const loginIcon = document.querySelector('.i-simple-icons-keystone.flex-shrink-0.h-5.w-5');
            if (loginIcon) {
                loginIcon.click();
            }
        });

        // Wait for a key element that indicates the page is loaded
        await page.waitForSelector('#username', { visible: true, timeout: 3000 });
        await page.waitForSelector('#kc-page-title', { visible: true, timeout: 3000 });

        // Fill in the username and password fields
        await page.type('#username', myenv.AdminUser);
        await page.type('#password', myenv.AdminPass);

        // Click the login button
        await page.click('#kc-login');

        // Capture screenshot after login
        const keyLogin = {
            width: 1440,
            height: 1080,
            left: 0,
            top: 0
        };
        await delay(5000);  // Give it some time to log in
        msg.login = await captureAndCrop(page, keyLogin);

        await delay(5000);
        // หลังจากรอโหลด คลิกที่ element /ai
        await page.click('a[href="/citylaw"]');
        await delay(5000);

        const frame = page.frames().find(frame => frame.url().includes('https://bmaai.iboc.co/citylaw'));

        try {
            await frame.evaluate((selector) => {
                const element = document.querySelector(selector);
                if (element) {
                    element.click();
                } else {
                    throw new Error('Element not found in iframe');
                }
            }, 'body > div > div.navbar.z-50.h-10.justify-between.bg-navbar.text-white > div:nth-child(4) > div > button');

            console.log('Clicked element in iframe successfully!');
        } catch (error) {
            console.error('Error clicking element in iframe:', error);
        }

        // Capture screenshot after login
        const capSSOcitylaw = {
            width: 1440,
            height: 1080,
            left: 0,
            top: 0
        };
        await delay(12000);  // Give it some time to log in
        msg.citylaw = await captureAndCrop(page, capSSOcitylaw);
        
        return msg;

    } catch (error) {
        node.error("Error during Puppeteer operation: " + error);
        msg.payload = "Puppeteer operation failed: " + error.message;
    } finally {
        await browser.close();
    }
})();
