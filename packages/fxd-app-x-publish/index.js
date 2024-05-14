import FxdBrowser from 'fxd-app-browser';
import { FxdSdk, getPackageInfo } from 'fxd-sdk';
import dayjs from 'dayjs';
import path from 'path';
import fs from 'fs';
import download from 'download';
import { renderText } from './render.js';


export default class FxdXPublish extends FxdBrowser {
    constructor() {
        super();
        this.sdk = new FxdSdk(getPackageInfo(import.meta.url));
        // ...
    }

    async publish(args, opts, command) {
        this.setDefaultOpts(opts);
        this.setDefaultCommand(command);
        this.format = this.get('format');

        const url = 'https://twitter.com/compose/post'; 
        let content = this.get('content');
        let long_content = false;
        // 如果内容超过140个字符，截断
        if( content.length > 139 )
        {
            long_content = content;
            content = content.substr(0, 139)+"…";
        }

        let images  = this.get('images') ;
        images = images ? images.split(',') : []
        
        if (!content) {
            console.error('推文内容不能为空');
            return;
        }
    
        const { browser, page } = await this.getBrowserAndMore(this.getUserDirFullPath(this.get('user')), { 
            headless: this.get('headless'), 
            browserType: this.get('browser'),
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36'
        });

        try {
            await page.goto(url, { waitUntil: this.get('wait_type') });

            // 等待输入图层
            await page.waitForSelector('[data-testid="tweetTextarea_0"]', {
                state:'attached'    
            });
            // 点击输入图层
            await page.click('[data-testid="tweetTextarea_0"]');
            // 输入内容
            await page.type('[data-testid="tweetTextarea_0"]', content);

            

            if( images.length > 0 || long_content )
            {
                // 确保临时目录存在
                const tmp_dir = path.join( "/tmp", this.sdk.name );
                if( !fs.existsSync(tmp_dir) ){
                    fs.mkdirSync(tmp_dir);
                }
                this.log("tmp_dir", tmp_dir);

                if( long_content )
                {
                    // 将文字生成图片。然后将链接放入images数组。
                    const filename = `${dayjs().format('YYYYMMDDHHmmss')}_long_content.jpg`;
                    const image = path.join(tmp_dir, filename);

                    await renderText({
                        // 将换行替换为 <br />
                        text: long_content.replace(/\n/g, '<br />'),
                        output: image,
                        width: 920,
                        style: {
                          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB','Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif, 'Apple Color Emoji','Segoe UI Emoji', 'Segoe UI Symbol'",
                          fontSize: 48,
                          lineHeight: 1.8,
                          fontWeight: 'lighter',
                          padding: 32
                        }
                      })
    
                    // 将 image 添加到 images 列表开头
                    images.unshift(image);
                }

                // 如果 images 元素超过4个，只保留前4个
                images = images.slice(0, 4);

                for (let i = 0; i < images.length; i++) {
                    let image = images[i].trim();
                    this.log("deal with image", image)
                    // 如果是网络图片，先下载到本地
                    if( image.startsWith('http') )
                    {
                        // 根据url获得文件扩展名
                        const ext = path.extname(image)??'.jpg';
                        this.log( "ext", ext );
                        if( ext == '.mp4' ) continue;
                        
                        const filename = `${dayjs().format('YYYYMMDDHHmmss')}_${i}${ext}`;
                        this.log("referrer",new URL(image).origin )
                        await download(image, tmp_dir, {
                            filename,
                            headers:
                            {
                                Referer: new URL(image).origin
                            }
                        });
                        image = path.join(tmp_dir, filename);
                        this.log("local image path", image);
                    }

                    await page.setInputFiles('[data-testid="fileInput"]', image);
                    // 等待图片上传完成
                    // 一张图等待5秒
                    await page.waitForTimeout(1000*5);
                }    
            }
            // 发布内容
            await  page.click('[data-testid="tweetButton"]');
            
            await page.waitForTimeout(1000*5);
            // AppTabBar_Profile_Link
            await page.click('[data-testid="AppTabBar_Profile_Link"]');
            // 等待页面转向
            await page.waitForURL();
            // wait for [data-testid="cellInnerDiv"]
            await page.waitForSelector('[data-testid="cellInnerDiv"]', {
                timeout: 1000*10
            });
            // 获取tweetTextArray 
            const tweetTextArray = await page.evaluate(() => {
                let data = [];
                let elements = document.querySelectorAll('[data-testid="cellInnerDiv"]');
                for (var element of elements) {
                    data.push( element.innerText );
                }
                return data;
            });
            
            await browser.close();
            let checked = false;
            // console.log("tweetTextArray",tweetTextArray);
            for( const tweetText of tweetTextArray )
            {
                // 检查其中是否包含 刚刚 和推文正文的前5个字
                if( tweetText.includes(String(content)?.substring(0,5)) )
                {
                    checked = true;
                    break;
                }
            }

            this.log('推文发布成功');
            return this.return({ 'action': 'publish', 'message': 'done', 'output': String(content)?.substring(0,100) + '...', 'checked': checked});
        } catch (error) {
            console.error('发布推文时出错：', error);
            await browser.close();
            return this.return({ 'action': 'publish', 'message': 'error', 'error': error, 'output' : error.message });
        }
    }

    async main(args, opts, command) {
        return await this.publish(args, opts, command);
    }

    async test(args, opts, command) {
        const long_content = `终于把无感录屏这事搞定了。这事我觉得挺重要，因为它可以在你工作或者写开源项目的时候直接把过程录制下来，只需要再剪辑一下，直接就可以作为副产品了。  不过我的电脑配置不太高，OBS跑起来本身就挺费资源，要是再同时把 docker/android studio/xcode开着（比如开发Flutter应用的时候），就会很卡。  之前尝试通过vnc让另外一台电脑登录进来录制，但是对被录制的电脑影响还是蛮大的。最后还是得靠硬件方案，花600多买了个支持4K录制和环出的视频采集卡，终于搞定了。  之前测试的时候买过小几百块的那种，录下来清晰度都不行，还是一分钱一分货啊`;
        await renderText({
            // 将换行替换为 <br />
            text: long_content.replace(/\n/g, '<br />'),
            output: '/tmp/long_test.jpg',
            width: 920,
            style: {
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB','Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif, 'Apple Color Emoji','Segoe UI Emoji', 'Segoe UI Symbol'",
              fontSize: 48,
              lineHeight: 1.8,
              fontWeight: 'lighter',
              padding: 32
            }
          })
    }

    
}
