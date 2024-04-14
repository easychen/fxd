import FxdApp from 'fxd-app-core';
import { FxdSdk, getPackageInfo } from 'fxd-sdk';
import Api2d from 'api2d';
import fs from 'fs';

export default class FxdGptBat extends FxdApp {
    constructor() {
        super();
        this.sdk = new FxdSdk(getPackageInfo(import.meta.url));
        // ...
    }

    async main(args, opts, command, cli_path) {
        this.setDefaultOpts(opts);
        this.setDefaultCommand(command);
        this.format = this.get('format');
        
        let content = this.get('content');
        const char_count = parseInt(this.get('char_count'))||1000;
        // 将 content 按句号和换行符分割成数组，然后拼接起来，保证每一段字数不超过 char_count。注意，句号和换行不能丢
        // 先把句号后边没有换行的都加上换行
        content = content.replace(/([。！？])([^\\n])/g, '$1\n$2');
        // 然后按换行符分割
        let contentArray = content.split('\n');
        // 按字数重新组合为段
        let newContentArray = [];
        let temp = '';
        for( let i = 0; i < contentArray.length; i++ )
        {
            let line = contentArray[i];
            if( temp.length + line.length > char_count )
            {
                newContentArray.push(temp);
                temp = '';
            }
            temp += line;
        }
        if( temp.length > 0 )
        {
            newContentArray.push(temp);
        }

        // 去掉空行
        newContentArray = newContentArray.filter( item => item.length > 0 );

        this.log(`分为 ${newContentArray.length} 段`);
        // console.log(newContentArray);

        try {
            const result = [];
            const prompt_template = this.get('prompt');
            // 然后分段用 gpt 处理
            for( let i = 0; i < newContentArray.length; i++ )
            {
                this.log(`处理第 ${i+1}/${newContentArray.length} 段`);
                let line = newContentArray[i];
                const prompt = prompt_template.replace('{{{content}}}', line);
                // console.log(prompt);
                const ai = new Api2d(this.get('ai_key'), this.get('ai_apibase'));
                const ret = await ai.completion({
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    stream: true,
                    model: this.get('model')||'gpt-3.5-turbo',
                    onMessage: (chars) => {
                        this.sdk.wslog(chars, true);
                    }
                });
                if( ret )
                {
                    this.log(ret);
                    result.push(ret);
                }  
            }
            this.log(result);
            return this.return({ message: 'success', data: result.join('\n') });
            
        } catch (error) {
            return this.echoError(error?.message);  
        }
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
