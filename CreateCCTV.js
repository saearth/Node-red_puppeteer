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

        const selectorSettings = `button[type="button"][class*="group relative flex"]`; // ปรับปรุง selector ให้กระชับขึ้น
        await page.waitForSelector(selectorSettings);
        await page.click(selectorSettings);

        const selectorCameras = `a[href="/settings/cameras"]`;
        await page.waitForSelector(selectorCameras);
        await page.click(selectorCameras);

        // const selectorTextBox = `input[placeholder="กรองข้อมูล ..."]`;
        // await page.waitForSelector(selectorTextBox);
        // await page.type(selectorTextBox,'test');
        // await page.keyboard.press('Enter');
        
        //เพิ่มกล้อง
        await page.click('//button[@type="button" and .//span[text()="เพิ่มกล้อง"]]');
        const selectorCreateCameras = `div:nth-child(1) > .input-group #ip`;
        await page.waitForSelector(selectorCreateCameras);
        await page.type(selectorCreateCameras);

        //บันทึก
        const confirm = '.bg-gray-900';
        await page.waitForSelector(confirm);
        await page.click(confirm);

        //ทดสอบ Create
        const textContent = await page.evaluate(() => document.body.textContent);
        if (textContent.includes('test_name')) {
            msg.find = 'พบ "test_name" ในหน้าเว็บ';
        } else {
            msg.find = 'ไม่พบ "test_name" ในหน้าเว็บ';
        }

        // Capture screenshot
        const capCreate = {
            width: 1440,
            height: 1080,
            left: 0,
            top: 0
        };
        await delay(5000);  // Give it some time to log in
        msg.create = await captureAndCrop(page, capCreate);


        return msg;

    } catch (error) {
        node.error("Error during Puppeteer operation: " + error);
        msg.payload = "Puppeteer operation failed: " + error.message;
    } finally {
        await browser.close();
    }
})();
