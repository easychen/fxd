import chalk from 'chalk';
import { FxdSdk, getPackageInfo, findCommands, getHomeDir } from 'fxd-sdk';
import inquirer from 'inquirer';
import child_process from 'child_process';
import fs from 'fs';
import path, { relative } from 'path';
import humps from 'humps';
import _ from 'lodash';
import clipboard from 'clipboardy';

// 应用程序核心类，供其他应用程序继承
export default class FxdApp {
    constructor() {
        this.sdk = new FxdSdk(getPackageInfo(import.meta.url));
        this.lastOpts = {};
        this.lastCommand = null;
    }

    run(params, opts, raw = false, cli_path = null) {
        if (!raw) {
            const warppedArgv = process.argv.slice(2).map(arg => arg.includes('=') ? arg.replace(/(.*)=(.*)/, '$1="$2"') : arg);
            const originalLine = warppedArgv.join(' ').replace(/\-\-save=.*|\-\-save/i, '').trim();

            // 如果包含 --save 参数，则保存命令到 ~/.fxd/commands.json
            if (opts['save']) {
                let commands = [];
                const commandFile = path.resolve(getHomeDir(), 'commands.json');
                if (fs.existsSync(commandFile)) {
                    const commandList = fs.readFileSync(commandFile, 'utf-8');
                    commands = commandList ? JSON.parse(commandList) : [];
                }
                const index = commands.findIndex(item => item.cmd == originalLine);
                console.log("index", index);
                const { save, ...restOpts } = opts;
                if (index < 0) commands.push({
                    cmd: originalLine,
                    meta: {
                        app: process.argv[2],
                        params,
                        opts: restOpts
                    }
                });
                fs.writeFileSync(commandFile, JSON.stringify(commands, null, 4));
                console.log(chalk.blue(`Saved as ${commands.length}`));
                return true;
            }
        }


        const [command, ...args] = params;
        // console.log("command", command, "args", args);
        // 如果当前对象有 command 方法，则执行
        try {
            if (this[command]) {
                const cmd = this[command](args, opts, command, cli_path);
                if(cmd?.catch) cmd.catch( error =>
                    {
                        console.log( chalk.red("error in 1") )
                        throw error;
                        return false; 
                    } );
            } else {
                // 应用的默认入口方法
                if (this['main']) {
                    const cmd = this['main'](args, opts, 'main')
                    if(cmd?.catch) cmd.catch( error =>{
                        console.log( chalk.red("error in 2") )
                        throw error;
                        return false; 
                    });
                } else {
                    console.error(chalk.red(`fxd-cli: command "${command}" not found`));
                    process.exit(1);
                }
            }

        } catch (error) {
            console.log( chalk.red("error in 3") )
            throw error;
            return false;
        }

        // console.log('run', command, args , opts);
    }

    install(args, opts, _command, cli_path = null) {
        // 在当前目录通过 npm 安装package
        const packageName = args[0];
        if (!packageName) {
            console.log(chalk.red("package name is required"));
            return false;
        }
        // 将全部参数都传递给 npm install，再加上 opts
        const install_path  = cli_path ? cli_path : process.cwd();
        const command = `cd  ${install_path} && npm install ${args.join(' ')} ${Object.keys(opts).map(key => `--${key}=${opts[key]}`).join(' ')} `;
        console.log(chalk.blue(command));
        child_process.execSync(command, { stdio: 'inherit' });
        return true;
    }

    list(args, opts) {
        const commandFile = path.resolve(getHomeDir(), 'commands.json');
        if (!fs.existsSync(commandFile)) {
            console.log(chalk.red("No commands saved"));
            return false;
        }
        const commandList = fs.readFileSync(commandFile, 'utf-8');
        const commands = commandList ? JSON.parse(commandList) : [];
        // 彩色输出，加上 index 
        commands.forEach((command, index) => {
            console.log(chalk.green(`${index + 1}.`) + chalk.blue(`fxd ${command.cmd}`));
        }
        );
        return true;
    }

    test(args, opts) {
        const name = this.get('name', opts, 'test');
        console.log("name", name);
    }

    exe(index) {
        return this.exec(index);
    }

    exec(index) {
        const commandFile = path.resolve(getHomeDir(), 'commands.json');
        if (!fs.existsSync(commandFile)) {
            console.log(chalk.red("No commands saved"));
            return false;
        }
        const commandList = fs.readFileSync(commandFile, 'utf-8');
        const commands = commandList ? JSON.parse(commandList) : [];
        const command = commands[index - 1] || false;
        if (command) {
            console.log(chalk.blue(`fxd ${command.cmd}`));
            child_process.execSync(`./fxd ${command.cmd}`, { stdio: 'inherit' });
        }
    }

    async login(args, opts) {
        let { token, format } = opts;
        if( format ) this.format = format;
        if (!token) {
            // 交互式输入
            const answers = await inquirer.prompt([
                {
                    type: 'password',
                    name: 'token',
                    message: 'Please input your token',
                },
            ]);
            token = answers.token;
        }
        if (token) {
            this.sdk.setToken(token);
            const ret = await this.sdk.profile();
            // console.log("ret",ret);
            if (ret) {
                if (ret.errors) {
                    this.echoError(ret.errors[0].message);
                    process.exit(1);
                }
                else {
                    if (ret.nickname) {
                        this.log(chalk.green(`login success, welcome ${ret.nickname}`));
                        // 将 token 保存到 ~/.fxd/token
                        this.sdk.saveToken(token);
                        this.return(ret);
                    }
                }
            }
        }
    }

    async logout() {
        this.sdk.cleanToken();
        console.log(chalk.green(`logout success`));
    }

    async profile() {
        const ret = await this.sdk.profile();
        console.log(JSON.stringify(ret, null, 4));
        // await this.sdk.setValue('test', ['book']);
        // console.log(await this.sdk.getValue('test'));
    }

    async cron()
    {
        const ret = await this.sdk.cron();
        console.log(JSON.stringify(ret, null, 4));
    }

    async shortcuts()
    {
        const ret = await this.sdk.shortcuts();
        console.log(JSON.stringify(ret, null, 4));
    }

    list_sheet(args, opts)
    {
        const ret = this.sdk.listSheet();
        console.log(JSON.stringify(ret, null, 4));
    }

    load_sheet(args, opts)
    {
        const name = opts['name'];
        if( !name ) this.echoError("name is required");
        const ret = this.sdk.loadSheet(name);
        console.log(JSON.stringify(ret, null, 4));
    }

    save_sheet(args, opts)
    {
        // 将 name 中的空白格替换为下划线
        let name = opts['name'].replace(/\s/g, '_');
        let content = opts['content'];
        if( !name ) this.echoError("name is required");
        if( !content ) this.echoError("content is required");
        // 如果 content 以 base64: 开头，则表示是 base64 编码的内容
        if( content.startsWith('base64:') )
        {
            content = jsonDecode(Buffer.from(content.replace('base64:', ''), 'base64').toString());
        }
        const ret = this.sdk.saveSheet(name, content);
        console.log(JSON.stringify(ret, null, 4));
    }

    remove_sheet(args, opts)
    {
        const name = opts['name'];
        if( !name ) this.echoError("name is required");
        const ret = this.sdk.removeSheet(name);
        console.log(JSON.stringify(ret, null, 4));
    }

    // settings_list , settings_save ; 用 sdk.saveKV、LoadKV操作存放在 settings.json 中的数据
    settings_list(args, opts)
    {
        const settings = this.sdk.loadKV('settings.json');
        console.log(JSON.stringify(settings, null, 4));   
    }

    settings_save(args, opts)
    {
        const key = opts['key'];
        const value = opts['value'] || '';
        if( !key ) this.echoError("key is required");
        const ret = this.sdk.saveKV('settings.json', key, value);
        console.log(JSON.stringify(ret, null, 4));
    }

    list_var(args, opts)
    {
        const ret = this.sdk.listVar();
        this.log(JSON.stringify(ret, null, 4));
        return this.return(ret);
    }

    save_last(args, opts)
    {
        const task_id = opts['task_id'];
        const output = opts['output'];
        if( output.startsWith('base64:') )
        {
            output = Buffer.from(content.replace('base64:', ''), 'base64').toString();
        }
        this.sdk.saveKV('last.json', task_id, output);
    }

    get_last(args, opts)
    {
        const last = this.sdk.loadKV('last.json');
        console.log(JSON.stringify(last, null, 4));
    }

    async wslog(args, opts)
    {
        const message = opts['message'];
        if( !message ) this.echoError("message is required");
        const replace = opts['replace'] || false;
        const ret = await this.sdk.wslog(message, replace);
        this.log(JSON.stringify(ret, null, 4));
        return this.return(ret);
    }

    // async test(args, opts)
    // {
    //     const ret = await this.sdk.aiStream('{{user}} 这个名字怎么样', {'user': '小明'});
    //     console.log(JSON.stringify(ret, null, 4));
    // }

    // 显示错误
    echoError(msg) {
        if( this.format == 'json' )
        {
            console.log( JSON.stringify({error: msg}, null, 4) );
        }else
        {
            console.log(chalk.red(msg));
        }
        process.exit(1);
    }

    help() {
        const args = this.sdk.args;
        // console.log(args);
        // 打印下版本
        console.log(chalk.bold('Version:'));
        console.log(' ' + chalk.cyan(this.sdk.packageVersion));

        console.log(chalk.bold('Usage:'));
        console.log(' ' + chalk.cyan(`fxd ${this.sdk.name.replace('fxd-app-', '')}`) + ' [command] [options]');

        // 将 args 按照命令进行分组，key中包含 | 的拆分为多个命令
        const newArgs = {};
        for( const key in args )
        {
            const commands = key.split('|');
            for( const command of commands )
            {
                newArgs[command] = {...newArgs[command]|| {}, ...args[key]};
            }
        }
        // console.log("newArgs", newArgs);

        for (const key in newArgs) {
            // 先打印命令 args[key]
            console.log(chalk.bold(`\nCommand - ${key}:`));

            Object.keys(newArgs[key]).forEach(name => {
                const option = newArgs[key][name];
                let line = ' ' + chalk.yellow(`--${name}`);

                if (option.short) {
                    line += `, -${option.short}`;
                }

                if (option.type) {
                    line += ` <${chalk.blue(option.type)}>`;
                }

                line += '\t' + chalk.green(option.description);

                if ('default' in option) {
                    line += ` (default: ${chalk.magenta(option.default)})`;
                }

                if (option.required) {
                    line += ' ' + chalk.red('(required)');
                }

                // if (option.example) {
                //     line += ` example: ${chalk.gray(option.example)}`;
                // }

                console.log(line);
            });
        }


    }

    setDeaultOpts(opts) {
        this.setDefaultOpts(opts);
    }

    setDeaultCommand(command) {
        this.setDefaultCommand(command);
    }

    setDefaultOpts(opts) {
        this.lastOpts = opts;
    }

    setDefaultCommand(command) {
        this.lastCommand = command;
    }

    // 从 package.json 中获取参数
    get(key, opts = {}, command = null) {
        // 首先获得值，优先级依次为 传递的参数、预先保存的参数
        let value = opts[key] || opts[humps.camelize(key)] || this.lastOpts[key] || this.lastOpts[humps.camelize(key)];

        // 如果 value 以 base64: 开头，则表示是 base64 编码的内容
        if( typeof value === 'string' && value.startsWith('base64:') )
        {
            value = Buffer.from(value.replace('base64:', ''), 'base64').toString();
        }

        // 检查value是否特殊符号，如果是，则按符号意义进行替换，包括3类：
        // [FXD_CLIPBOARD] 剪贴板数据
        // [FXD_ENV::xxx] 环境变量
        // [FXD_FIELD::sheetname||field] 数据表字段
        // [FXD_SHEET::sheetname] 数据表名称
        const cmds = findCommands(value);
        if (cmds.length > 0) {
            // 循环 cmds ， 拆分信息。
            // :: explore ，前边为 action ，后边为参数；参数之间用 || 分隔
            for (const cmd of cmds) {
                const [action, params_string] = cmd.split('::');
                const params = params_string ? params_string.split('||') : [];
                switch (action) {
                    case 'FXD_CLIPBOARD':
                        // 从剪贴板获取数据
                        value = clipboard.readSync() || '';
                        break;
                    case 'FXD_ENV':
                        // 从环境变量获取数据
                        value = process.env[params[0]] || '';
                        break;
                    case 'FXD_FIELD':
                        // 从数据表字段获取数据
                        const sheetname = params[0];
                        const field = params[1];
                        if (!sheetname || !field) {
                            this.echoError(`sheetname and field is required`);
                        }
                        // 从数据表中获取数据
                        const sheet = this.sdk.loadSheet(sheetname);
                        if (!sheet) {
                            value = '';
                            break;
                        }

                        let found = false;
                        // 循环rows,获得全部 rows[i][field] 的值
                        for( let i = 0 ; i < sheet.rows.length ; i ++ )
                        {
                            if( sheet.rows[i][field] )
                            {
                                value = sheet.rows[i][field];
                                sheet.rows[i][field] = '';
                                found = true;
                                this.sdk.saveSheet(sheetname, sheet);
                                break;
                            }
                        }

                        if( !found ) value = '';
                        
                        break;
                    case 'FXD_SHEET':
                        value = params[0] || '';
                        break;
                    case 'FXD_SETTINGS':
                        // 从 settings.json 中获取数据
                        const settings = this.sdk.loadKV('settings.json');
                        value = settings[params[0]] || '';
                        break;
                    default:
                        value = '';
                        break;
                }
            }
        }
        
        // 如果 opts 不为空，且 value 存在，则保存 opts
        if( Object.keys(opts).length > 0 && value ) this.lastOpts = opts;

        // 如果 command 不为空，则保存 command
        if( command ) this.lastCommand = command;
        // 否则载入 lastCommand，如果不存在，则使用 main
        else command = this.lastCommand || 'main';
        
        // 开始获取参数字段的定义
        const argsObject = {};
        for (const commandstring in this.sdk.args) {
            // key 可能包含多个命令，如 main,test，所以需要拆分
            const commands = commandstring.split('|');
            commands.forEach(_command => {
                // argsObject[_command] = this.sdk.args[commandstring];
                // 不要赋值，要合并，避免多个命令中有相同的参数导致覆盖
                // 使用 lodash 实现
                argsObject[_command] = _.merge(argsObject[_command], this.sdk.args[commandstring]);

            });
        }

        // console.log("argsObject", argsObject);

        // if( key == 'format' )
        //     console.log("argsObject=", argsObject, "command=", command, "key=", key, "opts=", opts , "value=", value);

        if( !argsObject[command.toLowerCase()] && !value ) this.echoError(`command ${command} args not set （${key}）`);
        const argInfo = argsObject[command.toLowerCase()] ? argsObject[command.toLowerCase()][key] : false;

        // console.log("argInfo", argInfo);
        // argInfo 就是字段定义
        if (argInfo) {

            // 处理设置了枚举值的情况
            if (argInfo.enum && !argInfo.enum.includes(value)) {
                // 如果存在非枚举值，则返回默认值
                value = argInfo.default;
            }
            // 必填参数为空
            if (argInfo.required && !value) {
                this.echoError(`--${key} is required`);
            }

            switch (argInfo.type) {
                case 'boolean':
                    // 如果 value 不存在，则返回默认值
                    // 如果 value 存在，但不是 true/false，则返回默认值
                    if (!value || (value != 'true' && value != 'false')) {
                        return argInfo.default;
                    }
                    else {
                        return value == 'true' ? true : false;
                    }
                case 'number':
                    return value ? Number(value) : argInfo.default;
                default:
                    return value || argInfo.default;
            }
        }else
        {
            // 如果字段没有定义，但是有值，则直接返回
            // 字段定义只是为了加强规范，但是不是必须的
            // 一些重用场景下，动态指定的参数，可能没有（对应方法的）定义
            if( value ) return value;
        }
    }

    // 打印日志，但是检测格式
    log( ...args )
    {
        if( this.format == 'json' || this.format == 'function' )
        {
            // json格式不输出中间值
        }else
        {
            // 非json格式直接输出
            console.log( ...args );
        }
    }

    return ( ret, force_silent = false )
    {
        // console.log( "format", this.format );
        // json 格式在返回时，统一输出最终结果
        if( this.format == 'json' && !force_silent)
        {
            console.log( JSON.stringify(ret, null, 4) );
        }
        return ret;
    }

    // 发布 feed 到 fxd 云端
    async feedPublish(content, meta, is_public = true, command = null, task_title = null , task_icon = '/logo.svg') {
        // 首先整理出 feed 需要的信息
        // public schema = schema.create({
        //     app_slug: schema.string({ trim: true }),
        //     // app_icon_url 可以为空
        //     app_icon_url: schema.string.optional({ trim: true }),
        //     app_name: schema.string({ trim: true }),
        //     feed_content: schema.string({ trim: true }),
        //     feed_meta: schema.string({ trim: true }),
        //     is_public: schema.boolean(),
        //   })
        const app_slug = this.sdk.name.replace('fxd-app-', '');
        const app_name = task_title || (this.sdk.displayName + (command ? `::${command}` : ''));
        const feed_content = content;
        const feed_meta = JSON.stringify(meta);
        
        // 通过 sdk 进行发布
        const json = await this.sdk._request('POST', '/fxd/feed/publish', {
            app_slug,
            app_name,
            app_icon_url: task_icon,
            feed_content,
            feed_meta,
            is_public
        });

        if( json.message == 'success' )
        {
            this.log(chalk.green(`feed published success`, JSON.stringify(json.data.id, null, 4)));
            return true;
        }else
        {
            this.log(chalk.red(`feed published failed`,JSON.stringify(json, null, 4)));
            return false;
        }


    }

    async feedRemove( id )
    {
        const json = await this.sdk._request('POST', '/fxd/feed/remove', {
            id
        });

        if( json.message == 'success' )
        {
            console.log(chalk.green(`feed removed success`));
            return true;
        }else
        {
            console.log(chalk.red(`feed removed failed`,JSON.stringify(json, null, 4)));
            return false;
        }
    }

    mergeProps(oldObject, props) {
        return mergeProps(oldObject, props);
    }
}


function mergeProps(oldObject, props) {
    const newObject = {};

    for (const key in props) {
        const prop = props[key];
        // 如果包含 .- 则表示这一条是排除规则
        if (prop.includes('.-')) {
            // Handle exclusion of properties in a nested object
            const [parentKey, excludedKeysString] = prop.split('.-');
            const excludedKeys = excludedKeysString.split(',');
            let childObject = false;
            // parentKey 可能是多级的用 点号分隔
            if (parentKey.includes('.')) {
                const parentKeys = parentKey.split('.');
                // childObject = oldObject.parentKeys[0].parentKeys[1]...
                childObject = _.get(oldObject, parentKeys);
            } else {
                childObject = oldObject[parentKey];
            }

            if (childObject && typeof childObject === 'object') {
                //newObject.parentKeys[0].parentKeys[1]... = _.omit(childObject, excludedKeys);
                _.set(newObject, parentKey, _.omit(childObject, excludedKeys));
            }
        } else {
            // 开始处理复制规则
            // 从 , 开始分隔
            const [firstFullKey, ...otherShortKeys] = prop.split(',');
            // main.url,book → [main.url, book] 
            // 开始根据firstFullKey 获得 parentObject
            // firstFullKey 可能是多级的用 点号分隔
            if (firstFullKey.includes('.')) {
                const firstFullKeys = firstFullKey.split('.');
                // 去掉最后一个，因为最后一个是要复制的 key
                const firstkey = firstFullKeys.pop();
                const allkeys = [firstkey, ...otherShortKeys];
                // console.log('allkeys1', allkeys);

                // 处理同级的 otherShortKeys
                for (const shortKey of allkeys) {
                    // 拼接 key数组
                    const keys = [...firstFullKeys, shortKey];
                    // console.log('keys', keys);
                    // console.log('newObject before', newObject);
                    // 使用 lodash 按key 将 oldObject 合并到 newObject
                    _.set(newObject, keys, _.get(oldObject, keys));
                    // console.log('newObject after', newObject);

                }


            } else {
                // 不包含点号，意味着没有分级
                // url,book → [url, book]
                const allkeys = [firstFullKey, ...otherShortKeys];
                // console.log('allkeys', allkeys);
                for (const shortKey of allkeys) {
                    // console.log('shortKey', shortKey, "newObject", newObject, "oldObject", oldObject);
                    newObject[shortKey] = oldObject[shortKey]
                }
            }

            // console.log('mergedObject', newObject);
        }
    }
    return newObject;
}

function jsonDecode(jsonString) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        return jsonString;
    }
}