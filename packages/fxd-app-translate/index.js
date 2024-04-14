import FxdApp from 'fxd-app-core';
import { FxdSdk, getPackageInfo } from 'fxd-sdk';
import FxdGptBat from 'fxd-app-gpt-bat';
import Api2d from 'api2d';
import fs  from 'fs';

export default class FxdTranslate extends FxdApp {
    constructor() {
        super();
        this.sdk = new FxdSdk(getPackageInfo(import.meta.url));
        // ...
    }

    async main(args, opts, command, cli_path) {
        this.setDefaultOpts(opts);
        this.setDefaultCommand(command);
        this.format = this.get('format');
        const content = this.get('content');
        let summary;

        if( this.get('summarize_first') )
        {
            // 首先通过 gpt 对 content 进行摘要
            const prompt1 = `你是世界一流的语言学家，正在翻译一篇长文。由于篇幅较长，每次只翻译其中一部分。为了保持翻译的连贯性，请先阅读全文，并编写一个翻译提示，注明文章的主题和内容，涉及什么领域的专有名词。全文如下：\n\n${content}，不要翻译全文，先撰写翻译提示：`;

            const ai = new Api2d(this.get('ai_key'), this.get('ai_apibase'));
            summary = await ai.completion({
                messages: [{
                    role: 'user',
                    content: prompt1
                }],
                stream: true,
                model: this.get('model')||'gpt-3.5-turbo-16k',
                onMessage: (chars) => {
                    this.sdk.wslog(chars, true);
                }
            });
        }
        
        const translate_tips = summary ?  `全文的翻译提示：${summary}` : '';
        if(translate_tips) this.log(translate_tips);

        const gpt_bat = new FxdGptBat();
        return await gpt_bat.main(
            null,
            {
                content: content,
                char_count: this.get('char_count'),
                prompt: `你是世界一流的语言学家，正在翻译一篇长文中的一段。${translate_tips} 请翻译，${this.get('from_lang')}：\n\n{{{content}}}，${this.get('to_lang')}：`,
                ai_key: this.get('ai_key')||"",
                ai_apibase: this.get('ai_apibase')||"https://oa.api2d.net",
                ai_model: this.get('ai_model')||'gpt-3.5-turbo-16k',
                format: this.get('format'),
            },
            'main',
        );
    }

    async file(args, opts, command) {
        const file_path = this.get('file_path', opts, command );
        if( !file_path )
        {
            return this.echoError('file_path is required');
        }
        if(!fs.existsSync(file_path)) return this.echoError(`file not exists: ${file_path}`);
        const content = fs.readFileSync(file_path, 'utf-8');
        opts.content = content;
        return await this.main(args, opts, 'main');
    }
}
