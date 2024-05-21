import FxdApp from 'fxd-app-core';
import { FxdSdk, getPackageInfo, getDirname } from 'fxd-sdk';
// import { FxdSdk, getPackageInfo, getDirname } from '../fxd-sdk/index.js';
import fs from 'fs';
import path from 'path';
import { LocalIndex } from 'vectra';
import chalk from 'chalk';
import inquirer from 'inquirer';
const __dirname = getDirname(import.meta.url);
export default class FxdCodegen extends FxdApp {
    constructor() {
        super();
        this.sdk = new FxdSdk(getPackageInfo(import.meta.url));
        // ...
    }

    async main(args, opts, command, cli_path) {
        // import inquirer from 'inquirer';
        const { package_name, parent_class, description } = await inquirer.prompt([
            // package_name
            {
                type: 'input',
                name: 'package_name',
                message: '请输入 Package name:',
                default: 'fxd-app-',
            },
            {
                type: 'input',
                name: 'description',
                message: '请输入应用介绍:',
            },
            {
                type: 'list',
                name: 'parent_class',
                message: '请选择要继承的父类:',
                choices: [
                    'FxdApp - 通用应用',
                    'FxdBrowser - 模拟浏览器操作类应用',
                    'FxdCheckChan - 监测网站内容变动',
                    'FxdKeepLive2 - 维持网站登录',
                    'FxdGptBat - 批量处理长文本',
                ],
                default: 'FxdApp',
            }

        ]);

        // 确保 package_name 以 fxd-app- 开头，且本地不存在对应的目录
        const package_name_prefix = 'fxd-app-';
        if (!package_name.startsWith(package_name_prefix)) {
            this.log(chalk.red(`Package name 必须以 ${package_name_prefix}开头 `));
            return;
        }
        const package_path = path.join(__dirname, '..', package_name);
        if (fs.existsSync(package_path)) {
            this.log(chalk.red(`Package path ${package_path} 已经存在`));
            return;
        }

        // 创建目录
        fs.mkdirSync(package_path);
        // 读取 fxd-app-demo 的 pacakge.json替换后写入
        const package_json_path = path.join(__dirname, '..', 'fxd-app-demo', 'package.json');
        const package_json_content = fs.readFileSync(package_json_path, 'utf-8');
        const pacakge_info = JSON.parse(package_json_content);
        pacakge_info.name = package_name;
        pacakge_info.description = description;
        fs.writeFileSync(path.join(package_path, 'package.json'), JSON.stringify(pacakge_info, null, 4));
        // 读取 fxd-app-demo 的  index.js 替换 类名和父类名
        const parent_class_name = parent_class.split('-')[0].replace(/^\s+|\s+$/g, '');
        const index_path = path.join(__dirname, '..', 'fxd-app-demo', 'index.js');
        const index_content = fs.readFileSync(index_path, 'utf-8');
        const index_info = index_content.replace(/FxdApp/g, parent_class_name);
        // new_app_class_name = pacakge_name 去掉 -app- ，然后转大驼峰
        const new_app_class_name = package_name.replace('-app', '').split('-').map(item => item[0].toUpperCase() + item.slice(1)).join('');
        // 替换 FxdDemo 为 new_app_class_name
        const index_info_new = index_info.replace(/FxdDemo/g, new_app_class_name);
        fs.writeFileSync(path.join(package_path, 'index.js'), index_info_new);

        const { codegen } = await inquirer.prompt([
            {
                type: "confirm",
                // 是否要生成代码
                name: "codegen",
                message: "是否需要AI生成代码？",
                default: true
            }
        ]);

        if (codegen) {
            let parent_package = '';
            switch (parent_class_name) {
                case 'FxdApp':
                    parent_package = 'fxd-app-core';
                    break;
                case 'FxdBrowser':
                    parent_package = 'fxd-app-browser';
                    break;
                case 'FxdCheckChan':
                    parent_package = 'fxd-app-check-chan';
                    break;
                case 'FxdKeepLive2':
                    parent_package = 'fxd-app-keep-live2';
                    break;
                case 'FxdGptBat':
                    parent_package = 'fxd-app-gpt-bat';
                    break;
            }
            return this.gen(args, { ...opts, package_name, parent_package, description });
        }
    }

    async gen(args, opts, command, cli_path) {
        this.setDefaultOpts(opts);
        this.setDefaultCommand(command);
        let howto1 = this.get('howto');
        const package_name = this.get('package_name');
        const parent_package = this.get('parent_package');
        const description = this.get('description');

        if (!howto1) {
            const { howto } = await inquirer.prompt(
                {
                    type: 'input',
                    name: 'howto',
                    message: '请详细描述本应用的功能，及会用到的具体数据，比如需要处理的网址等',
                    default: description || "",
                }
            );
            if (!howto) {
                this.log(chalk.red(`应用描述不能为空`));
            }
            howto1 = howto;
        }

        // 首先从 sdk 和 parent_class 中获取可能用到的函数
        const sdk_function_list = fs.readFileSync(path.join(__dirname, 'sdk-and-core.txt'), 'utf-8');

        const parent_class_file = path.join(__dirname, '..', parent_package, 'index.js');
        const parent_class_content = fs.existsSync(parent_class_file) ? fs.readFileSync(parent_class_file, 'utf-8') : '';


        const get_function_prompt = `你是世界一流的NODE JS工程师。正在为开发FXD应用整理资料。请根据需求，从SDK和父类代码中列出可能被用到的函数列表(列出名称和参数，如 aiChat( message ) )。<SDK>${sdk_function_list}</SDK>\n<父类代码>${parent_class_content}</父类代码>\n<需求>${howto1}</需求>\n\n 为了完成需求，我们需要... ，在这个过程中，用到的函数列表如下：`;

        this.log(`正在思考，请稍候……`);
        let function_to_use_text = await this.sdk.aiChat(get_function_prompt, null, process.env.DEFAULT_AI_CHAT_MODEL||"gpt-4o");
        // console.log(function_to_use_text);
        
        if (function_to_use_text.data) 
            function_to_use_text = function_to_use_text.data;
        else 
            function_to_use_text = '';

        // this.log(`正在通过向量检索资料库，请稍候……`);
        // const howto_vector = await this.sdk.aiEmbedding(`${howto1} - ${function_to_use_text}`);
        // let result_items = [];
        // // const sdk_index = new LocalIndex(path.join(__dirname, `sdk-index`));
        // // if( await sdk_index.isIndexCreated() )
        // // {
        // //     const results = await sdk_index.queryItems(howto_vector, 3);
        // //     if (results.length > 0) {
        // //         for (const result of results) {
        // //             result_items .push( result );
        // //         }
        // //     }
        // // }
        // const code_index = new LocalIndex(path.join(__dirname, `code-index`));
        // if (await code_index.isIndexCreated()) {
        //     let results = await code_index.queryItems(howto_vector, 10);
        //     if (results.length > 0) {
        //         this.log(`查询返回 ${results.length} 条数据`);
        //         // 按 order 排序，逆序
        //         results = results.sort((a, b) => b.score - a.score);
        //         for (const result of results) {
        //             if (result.score > 0.6)
        //                 result_items.push(result);
        //         }
        //         // 只取前三个
        //         this.log(`分值0.6以上的共 ${result_items.length} 条数据`);
        //         result_items = result_items.slice(0, 3);
        //     }
        // }

        // // 保存 result_items 到文件
        // // const result_items_path = path.join(__dirname, `result_items.json`);
        // // fs.writeFileSync(result_items_path, JSON.stringify(result_items, null, 4));

        // const reffer_code = result_items.map(item => item.item.metadata.chunk).join("\n---\n");

        // console.log( "reffer_code", reffer_code );

        // return false;

        const intro = fs.readFileSync(path.join(__dirname, 'fxd-intro.txt'), 'utf-8');

        const exists_app = fs.readFileSync(path.join(__dirname, 'fxd-apps.txt'), 'utf-8');

        const old_index_code = fs.readFileSync(path.join(__dirname, '..', package_name, 'index.js'), 'utf-8');
        const old_packages_json = fs.readFileSync(path.join(__dirname, '..', package_name, 'package.json'), 'utf-8');

        const prompt = `
# ROLE
你是世界一流的NodeJS专家，正在编写FXD应用。

# TASK
根据需求和规范编写应用代码。

# INPUT
<规范>${intro}</规范>
<已有FXD应用>${exists_app}</已有FXD应用>
<相关函数>${function_to_use_text}</相关函数>
<index.js>${old_index_code}</index.js>
<package.json>${old_packages_json}</package.json>
<需求>${howto1}</需求>

# RULES
1. 确保可以在 Node18+ 环境下运行，使用 ESM 语法
2. 一步一步思考，首先分析需求，输出分析结果
3. 优先使用「extend已有FXD应用」和「混搭一个或者多个已有FXD」的方式来实现需求
4. 优先使用父类的方法和SDK中的函数来实现
5. 如果不够用，再通过Node内置函数来实现
5. 如果依然不够用，从你的知识库中寻找npm包作为补充，确保该package在npmjs.com上可以找到
6. 不要省略和举例，直接完成需求
7. 分析结果采用纯文本输出
8. 输出聪明高效的、可以完成需求的、确保可以正确运行的最终代码
9. 最终代码用FINAL-CODE标签包裹，标签中不要包含多余的markdown符号，标签内容直接写入一个nodejs文件应该可以正确运行
10. 输出最终代码对应的package.json，用FINAL-JSON标签包裹，标签中不要包含多余的markdown符号，标签内容应该能被JSON.parse正确解析。

# OUTPUT

输出格式如下：
\`\`\`
<FINAL-CODE>
// 这里是生成的最终代码
</FINAL-CODE>

<FINAL-JSON>
// package.json content here
</FINAL-JSON>
\`\`\`
现在立刻输出：`;

        this.log(`正在生成代码，请稍候……`);
        // console.log( 'prompt', prompt );
        const ret2 = await this.sdk.aiChat(prompt, null, process.env.DEFAULT_AI_CHAT_MODEL||"gpt-4o");
        // fs.writeFileSync('ret', JSON.stringify(ret2, null, 4));
        if (ret2.data) {
            // 从中提取 <FINAL-CODE></<FINAL-CODE>
            try {
                const code = ret2.data.match(/<(FINAL-CODE)>(.+?)<\/\1>/is) ? ret2.data.match(/<(FINAL-CODE)>(.+?)<\/\1>/is)[2] : false;
                if (code)
                    fs.writeFileSync(path.join(__dirname, '..', package_name, 'index.js'), code);
                else
                    fs.writeFileSync(path.join(__dirname, '..', package_name, 'index.js'), ret2.data);

                const json = ret2.data.match(/<(FINAL-JSON)>(.+?)<\/\1>/is) ? ret2.data.match(/<(FINAL-JSON)>(.+?)<\/\1>/is)[2]: false;
                if (json)
                    fs.writeFileSync(path.join(__dirname, '..', package_name, 'package.json'), json);
                else
                    fs.writeFileSync(path.join(__dirname, '..', package_name, 'index.js'), ret2.data);

                this.log(chalk.green(`代码生成完毕，请进入代码目录 ${path.resolve(__dirname, '..', package_name)} 查看`));
            } catch (error) {
                console.log(error);
                fs.writeFileSync(path.join(__dirname, 'log.txt'), JSON.stringify(ret2, null, 4));
            }

        }




    }

    async test() {
        // const old_index_code = fs.readFileSync(path.join(__dirname, '..', package_name, 'index.js'), 'utf-8');
        // const old_packages_json = fs.readFileSync(path.join(__dirname, '..', package_name, 'package.json'), 'utf-8');

        // const ret2 = JSON.parse(fs.readFileSync('ret', 'utf-8'));
        // // /<(FINAL-(.+?))>(.+?)<\/\1>/gis
        // // console.log( ret2.data );
        // const code = ret2.data.match(/<(FINAL-CODE)>(.+?)<\/\1>/is)[2];
        // if( code )
        //     fs.writeFileSync(path.join(__dirname, '..', package_name, 'index.js'), code);

        // const json = ret2.data.match(/<(FINAL-JSON)>(.+?)<\/\1>/is)[2];
        // if( json )
        //     fs.writeFileSync(path.join(__dirname, '..', package_name, 'package.json'), json);

    }

    async codebase(args, opts, command, cli_path) {
        // 创建整个代码库的 codebase 的向量索引

        // 搜索 ../下所有 fxd-app 的目录
        const inludeApps = [
            'fxd-cli',
            'fxd-sdk',
            'fxd-app-core',
            'fxd-app-browser',
            'fxd-app-check-chan',
            'fxd-app-douyin-count',
            'fxd-app-fetch',
            'fxd-app-gpt-bat',
            'fxd-app-keep-live2',
            'fxd-app-rss-fetch',
            'fxd-app-screenshot',
            'fxd-app-search',
            'fxd-app-translate',
            'fxd-app-weibo-live',
            'fxd-app-weibo-publish',
            'fxd-app-x-publish',
        ];

        // 将 incloudeapps 目录下的 packages.json 和 index.js 内容获取并合并到codebase.txt 中，包含文件名和代码
        const codebase = [];
        for (const app of inludeApps) {
            const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', app, 'package.json'), 'utf-8'));
            const index = fs.readFileSync(path.join(__dirname, '..', app, 'index.js'), 'utf-8');
            codebase.push({
                name: pkg.name,
                version: pkg.version,
                description: pkg.description || "",
                code: index,
            });
        }
        // 生成文本文件，用 xml 标签来组织
        const codebaseText = codebase.map(item => `<package name="${item.name}" version="${item.version}" description="${item.description}">\n${item.code}\n</package>`).join('\n');

        // 写入文件，写到当前目录
        fs.writeFileSync(path.join(__dirname, 'codebase.txt'), codebaseText);

        this.log("codebase generared");
    }

    async indexing(args, opts, command, cli_path) {
        this.setDefaultOpts(opts);
        this.setDefaultCommand(command);
        const theType = this.get('type') || 'intro';

        // intro
        // sdk 
        // code

        const index = new LocalIndex(path.join(__dirname, `${theType}-index`));

        if (!await index.isIndexCreated()) {
            await index.createIndex();
        }

        let content = '';
        switch (theType) {
            case 'code':
                content = fs.readFileSync(path.join(__dirname, 'codebase.txt'), 'utf-8');
                break;
            case 'sdk':
                content = fs.readFileSync(path.join(__dirname, 'sdk-and-core.txt'), 'utf-8');
                break;
            case 'intro':
            default:
                content = fs.readFileSync(path.join(__dirname, 'fxd-intro.txt'), 'utf-8');
        }

        // 将 content 按 800 字分段
        // 将 content 按 800 字分段
        const chunkSize = 800;
        const chunks = [];
        for (let i = 0; i < content.length; i += chunkSize) {
            chunks.push(content.substring(i, i + chunkSize));
        }

        // 显示分块数量，确认是否继续
        this.log(`theType ${theType} total ${chunks.length} chunks`);
        const { continue_do } = await inquirer.prompt(
            {
                type: 'confirm',
                name: 'continue_do',
                message: '是否继续'
            }
        );

        if (!continue_do) return false;

        // 处理分段后的内容
        let i = 1;
        for (const chunk of chunks) {
            // 这里可以加入对每个chunk的处理逻辑，比如将其写入索引等
            console.log(`${i++}/${chunks.length}`);
            const ret = await this.sdk.aiEmbedding(chunk);
            if (!ret) {
                this.log(chalk.red(`AI embedding failed`));
            }

            await index.insertItem({
                vector: ret,
                metadata: { chunk, type: theType }
            });

        }
        this.log("index generated");

    }
}
