import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import ow from 'ow';
import { firefox } from 'playwright';  // 使用Playwright的firefox

import { cssifyObject } from 'css-in-js-utils';

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const observerScript = fs.readFileSync(
    path.join(dirname, 'lib', 'fontfaceobserver.standalone.js'),
    'utf8'
);
const observer = `
<script>
  ${observerScript}
</script>
`;

/**
 * Renders the given text / html via Playwright.
 *
 * Asynchronously returns the generated html page as a string for debugging purposes.
 *
 * If you want to load multiple google fonts, juse specify their font-families in `opts.style.fontFamily`
 * separated by commas as you normally would for CSS fonts.
 *
 * @name renderText
 * @function
 *
 * @param {object} opts - Configuration options
 * @param {string} opts.text - HTML content to render
 * @param {string} opts.output - Path of image file to store result
 * @param {number} [opts.width] - Optional max width for word-wrap
 * @param {number} [opts.height] - Optional max height to clip overflow
 * @param {string} [opts.loadFontFamily] - Optional font family to load with fontfaceobserver
 * @param {boolean} [opts.loadGoogleFont=false] - Whether or not to load and wait for `opts.style.fontFamily` as one or more google fonts
 * @param {boolean} [opts.verbose=false] - Optional whether to log browser console messages
 * @param {object} [opts.style={}] - JS [CSS styles](https://www.w3schools.com/jsref/dom_obj_style.asp) to apply to the text's container div
 * @param {object} [opts.inject={}] - Optionally injects arbitrary string content into the head, style, or body elements.
 * @param {string} [opts.inject.head] - Optionally injected into the document <head>
 * @param {string} [opts.inject.style] - Optionally injected into a <style> tag within the document <head>
 * @param {string} [opts.inject.body] - Optionally injected into the document <body>
 *
 * @return {Promise}
 */
export async function renderText(opts) {
    const {
        text,
        output,
        width = undefined,
        height = undefined,
        loadFontFamily = undefined,
        loadGoogleFont = false,
        verbose = false,
        style = {},
        inject = {}
    } = opts;

    ow(output, 'output', ow.string.nonEmpty);
    ow(text, 'text', ow.string);
    ow(style, 'style', ow.object.plain);

    const { fontFamily = '' } = style;

    if (loadGoogleFont && !fontFamily) {
        throw new Error('valid style.fontFamily required when loading google font');
    }

    const fonts = loadFontFamily
        ? [loadFontFamily]
        : loadGoogleFont
            ? fontFamily.split(',').map((font) => font.trim())
            : [];

    const fontHeader = loadFontFamily
        ? observer
        : loadGoogleFont
            ? `
      ${observer}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=${fonts
                .map((font) => font.replace(/ /g, '+'))
                .join('|')}">
    `
            : '';

    const fontsToLoad = fonts.map((font) => `new FontFaceObserver('${font}')`);
    const fontLoader = fontsToLoad.length
        ? `Promise.all([ ${fontsToLoad.join(
            ', '
        )} ].map((f) => f.load())).then(ready);`
        : 'ready();';

    const html = `
<html>
<head>
  <meta charset="UTF-8">

  ${inject.head || ''}
  ${fontHeader}

  <style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: transparent;

  ${width ? 'max-width: ' + width + 'px;' : ''}
  ${height ? 'max-height: ' + height + 'px;' : ''}

  overflow: hidden;
}

.text {
  display: inline-block;
  ${width ? '' : 'white-space: nowrap;'}

  ${cssifyObject(style)}
}

  ${inject.style || ''}
  </style>
</head>

<body>
${inject.body || ''}

<div class="text">${text}</div>

<script>
  function ready () {
    var div = document.createElement('div');
    div.className = 'ready';
    document.body.appendChild(div);
  }
  ${fontLoader}
</script>

</body>
</html>
`;

    // testing
    // fs.writeFileSync('test.html', html)

    const browser = await firefox.launch({ headless: true });
    const page = await browser.newPage();

    if (verbose) {
        page.on('console', console.log);
        page.on('error', console.error);
    }

    await page.setViewportSize({
        width: width || 640,
        height: height || 480
    });
    await page.setContent(html);
    await page.evaluate(() => {
    // 检查 ready 元素是否存在并打印日志
    if (document.querySelector('.ready')) {
        console.log('Ready element created');
    } else {
        console.log('Ready element not created yet');
    }
    });

    // 等待 ready 函数执行完成
    await page.evaluate(() => {
    return new Promise((resolve) => {
        const checkReady = () => {
        const readyElement = document.querySelector('.ready');
        if (readyElement) {
            resolve();
        } else {
            requestAnimationFrame(checkReady);
        }
        };
        checkReady();
    });
    });

    const textHandle = await page.$('.text');
    const boundingBox = await textHandle.boundingBox();
    await page.setViewportSize({
    width: Math.ceil(boundingBox.width),
    height: Math.ceil(boundingBox.height)
    });

    const isPng = output.toLowerCase().endsWith('png');
    await textHandle.screenshot({
    path: output,
    type: isPng ? 'png' : 'jpeg',
    omitBackground: opts.omitBackground ?? (isPng ? true : false)
    });
    await textHandle.dispose();
    await browser.close();


    return html;
}
