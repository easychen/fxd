import fetch from 'node-fetch';
import fs from 'fs';
import os from 'os';
import { readPackageSync } from 'read-pkg';
import { JsonDB, Config } from 'node-json-db';
import crypto from 'crypto';
import querystring from 'querystring';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { io } from "socket.io-client";
import { exec as execCallback } from 'child_process';
const exec = promisify(execCallback);
import Api2d from 'api2d';
import nodeFetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

const WS_PORT = process.env.WS_PORT || 55106;
const API_URL = process.env.API_URL || 'https://api.apijia.cn';
// const API_URL = process.env.API_URL || 'http://dd.ftqq.com:3333';

export class FxdSdk {
    // 构造函数
    constructor(packageInfo = null) {
        // console.log("FxdSdk constructor", packageInfo);
        // 读取 package.json 中的元信息
        if (!packageInfo) packageInfo = readPackageSync();

        // packageInfo {
        //     name: 'fxd-cli',
        //     version: '1.0.0',
        //     main: 'index.js',
        //     private: 'true',
        //     license: 'PolyForm-Noncommercial',
        //     dependencies: {
        //       chalk: '^5.3.0',
        //       'fxd-sdk': '1.0.6',
        //       humps: '^2.0.1',
        //       minimist: '^1.2.8'
        //     },
        //     type: 'module',
        //     readme: 'ERROR: No README data found!',
        //     _id: 'fxd-cli@1.0.0'
        //   }

        this.apiBase = API_URL;
        this.token = null;
        this.loadToken();
        this.name = packageInfo.name || this.constructor.name;
        this.displayName = packageInfo.displayName || this.name ;
        this.args = packageInfo.meta?.args || [];
        this.packageVersion = packageInfo.version;
        const dbFolder = path.resolve(getHomeDir(), 'db');
        // 如果 dbFile 不存在，则创建(递归创建目录)
        if (!fs.existsSync(dbFolder)) {
            fs.mkdirSync(dbFolder, { recursive: true });
        }
        const dbFile = path.resolve(dbFolder, `${this.name}.json`);
        if (!fs.existsSync(dbFile)) {
            fs.writeFileSync(dbFile, '{}');
        }
        
        const dbConfig = new Config(dbFile, true, true);
        this.db = new JsonDB(dbConfig);
        this.socket = null;
        this.ai = null;
    }

    setAiApi( key, api_base = null )
    {
        this.ai = new Api2d(key, api_base);
    }

    async aiEmbedding( text, model = 'text-embedding-3-small' )
    {
        if( !this.ai )
        {
            // 检查是否存在默认设置
            const settings = this.loadKV('settings.json');
            if( settings.DEFAULT_AI_CHAT_KEY )
            {
                this.ai = new Api2d(settings.DEFAULT_AI_CHAT_KEY, settings.DEFAULT_AI_CHAT_BASEURL || null);
            }
        }
        if( !this.ai ) return { error: 'ai api not set' };
        const response = await this.ai.embeddings({
            input: text,
            model,
        });

        if( response.data[0] && response.data[0].embedding )
            return response.data[0].embedding;
        
        return false;

    }

    async aiStream( messages, data = null, model= null )
    {
        return await this.aiChat( messages, data, model, (chars, char) => {
            this.wslog(chars, true);
        });
    }

    async aiChat( messages, data = null, model= null, callback = null )
    {
        if( !this.ai )
        {
            // 检查是否存在默认设置
            const settings = this.loadKV('settings.json');
            if( settings.DEFAULT_AI_CHAT_KEY )
            {
                this.ai = new Api2d(settings.DEFAULT_AI_CHAT_KEY, settings.DEFAULT_AI_CHAT_BASEURL || null);
            }
            if( !model ) model = settings.DEFAULT_AI_CHAT_MODEL || 'gpt-3.5-turbo'
        }
        if( !this.ai ) return { error: 'ai api not set' };
        
        messages = typeof messages === 'string' ? [{
            'role': 'user',
            'content': messages,
        }] : messages;

        // 如果 data 是一个 object，那么将messages第一条内容的content中的 {{datakey}} 替换为 data.value
        if( data && typeof data === 'object' )
        {
            for( const key of Object.keys(data) )
            {
                messages[0].content = messages[0].content.replace(`{{${key}}}`, data[key]);
            }
        }

        const ret = await this.ai.completion({
            messages,
            stream: true,
            onMessage: ( chars, char ) => {
              if( callback ) callback(chars, char);
            },
            onEnd: ( chars ) => {
                if( callback ) callback(chars);
            }
        });
        return { message: 'success', data: ret };
    }

    async wslog( message, replace = false )
    {
        // 如果 messsage 是 object，则转为 json 字符串
        if( typeof message === 'object' )
        {
            message = JSON.stringify(message, null, 2);
        }
        
        
        // 如果设置了 WSLOG_TO_FILE 环境变量，则将消息写入文件
        if( process.env.WSLOG_TO_FILE )
        {
            // WSLOG_TO_FILE 就是文件名
            const file = path.join(getHomeDir(), process.env.WSLOG_TO_FILE);
            // 最新的内容置于最前面，仅保留最新的100条
            const content = fs.existsSync(file) ? fs.readFileSync(file, { encoding: 'utf8' }) : '';
            const lines = content.split('\n');
            lines.unshift(message);
            const newContent = lines.slice(0, 100).join('\n');
            fs.writeFileSync(file, newContent);
            return true;
        }
        
        
        const channel = replace ? 'char' : 'log';
        const socket = io(`http://localhost:${WS_PORT}`);
        return new Promise((resolve, reject) => {
            socket.on('connect', () => {
                socket.emit(channel, message);
                socket.disconnect();
                socket.close();
                resolve(true);
            });
            socket.on('connect_error', (error) => {
                socket.disconnect();
                socket.close();
                resolve(false);
            });
            socket.on('connect_timeout', (timeout) => {
                socket.disconnect();
                socket.close();
                resolve(false);
            });
            socket.on('error', (error) => {
                socket.disconnect();
                socket.close();
                resolve(false);
            }
            );
        });
    }


    // set value
    async setValue(key, value, overwrite = true) {
        // 如果 key 不以 / 开头，则自动添加
        if (!key.startsWith('/')) {
            key = `/${key}`;
        }
        return await this.db.push(key, value, overwrite);
    }

    // get value
    async getValue(key) {
        try {
            if (!key.startsWith('/')) {
                key = `/${key}`;
            }
            return await this.db.getData(key);
        } catch (error) {
            // 如果 DEBUG 环境变量为 true，则打印错误信息
            if (process.env.DEBUG)
                console.log("getValue error", error);
            
            return false;
        }
    }

    // set token
    setToken(token) {
        this.token = token;
    }

    saveKV(filename, key, value) {
        const content = this.loadFile(filename);
        const contentObject = content ? JSON.parse(content) : {};
        const newObject = Object.assign(contentObject, {[key]: value});
        this.saveFile(filename, JSON.stringify(newObject));
        return newObject;
    }

    loadKV(filename, key = false) {
        const content = this.loadFile(filename);
        const contentObject = content ? JSON.parse(content) : {};
        if( !key ) 
            return contentObject;
        else
            return contentObject[key] === undefined ? null : contentObject[key];
    }

    saveFile(filename, content) {
        const fold = getHomeDir();
        const file = path.join(fold, filename);
        if (!fs.existsSync(fold)) {
            fs.mkdirSync(fold);
        }
        fs.writeFileSync(file, content);
    }

    loadFile(filename) {
        const file = path.join(getHomeDir(), filename);
        if (fs.existsSync(file)) {
           return fs.readFileSync(file, { encoding: 'utf8' });
        }else
        {
            return false;
        }
    }

    // save token
    saveToken(token) {
        // 保存到 ~/.fxd/token
        this.saveFile('token', token);
    }

    // load token
    loadToken() {
        this.token = this.loadFile('token');
    }

    cleanToken() {
        const file = path.join(getHomeDir(), 'token');
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
        }
        this.token = null;
    }

    // 对 sheet 目录进行文件管理：
    // list / read / write / delete
    listSheet() {
        const sheetDir = path.join(getHomeDir(), 'sheet');
        if (!fs.existsSync(sheetDir)) {
            fs.mkdirSync(sheetDir, { recursive: true });
        }
        const files = fs.readdirSync(sheetDir).filter(file => file.endsWith('.json')); // 过滤掉非 .json 文件
        
        // 按照修改时间逆序排序
        files.sort((a, b) => {
            const statA = fs.statSync(path.join(sheetDir, a));
            const statB = fs.statSync(path.join(sheetDir, b));
            return statB.mtimeMs - statA.mtimeMs;
        });
        // 用正则将文件名中的.json 后缀去掉
        const ret = files.map(file => file.replace(/\.json$/, ''));
        return ret;
    }

    loadSheet(sheetName) {
        const sheetDir = path.join(getHomeDir(), 'sheet');
        const file = path.join(sheetDir, `${sheetName}.json`);
        if (fs.existsSync(file)) {
            return jsonDecode(fs.readFileSync(file, { encoding: 'utf8' }));
        } else {
            return false;
        }
    }

    saveSheet(sheetName, content) {
        
        const json = JSON.stringify(content, null, 4);
        const sheetDir = path.join(getHomeDir(), 'sheet');
        const file = path.join(sheetDir, `${path.basename(sheetName)}.json`);
        if (!fs.existsSync(sheetDir)) {
            fs.mkdirSync(sheetDir);
        }
        fs.writeFileSync(file, json);
        // 检测是否成功
        return fs.existsSync(file) && fs.readFileSync(file, { encoding: 'utf8' }) === json ;
    }

    removeSheet(sheetName) {
        const sheetDir = path.join(getHomeDir(), 'sheet');
        const file = path.join(sheetDir, `${sheetName}.json`);
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
        }
        return !fs.existsSync(file);
    }

    listVar()
    {
        // 首先读取环境变量的Key
        const env = Object.keys(process.env);
        env.sort();
        const settings = Object.keys(this.loadKV('settings.json'));
        settings.sort();
        // 然后读取sheet目录下的文件，及其字段
        const fields = {};
        const sheetDir = path.join(getHomeDir(), 'sheet');
        if (fs.existsSync(sheetDir)) {
            // 遍历 sheet 目录下的所有.json文件
            const files = fs.readdirSync(sheetDir).filter(file => file.endsWith('.json')); // 过滤掉非 .json 文件
            for( const file of files )
            {
                const sheetName = file.replace(/\.json$/, '');
                // 用 fs 读取文件内容
                const content = fs.readFileSync(path.join(sheetDir, file), { encoding: 'utf8' });
                const json = jsonDecode(content);
                if( json.rows )
                {
                    fields[sheetName] = [];
                    // 遍历 rows，获取所有的键值对的key
                    for( const row of json.rows )
                    {
                        for( const key of Object.keys(row) )
                        {
                            if( !fields[sheetName].includes(key) ) fields[sheetName].push(key);
                        }
                    }
                }
            }
        }

        return { env, fields, settings };

    }

    // _request
    async _request(method, uri, data) {
        const url = `${this.apiBase}${uri}`;
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        const options = {
            method,
            headers,
        };
        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }

        const response = await myFetch(url, options);
        return await response.json();
    }

    // profile
    async profile() {
        return await this._request('GET', '/profile');
    }

    // flow
    async flow(id) {
        return await this._request('GET', `/fxd/flow/detail?id=${id}`);
    }

    async cron() {
        const ret = await this._request('GET', '/fxd/task/index');
        // console.log(ret);
        if( ret && ret.data && ret.data.length > 0 )
        {
            return ret.data.filter( item => item.with_cron > 0 && item.is_active > 0 );
        }else
        {
            if( ret && ret.error ) this.wslog(ret.error);
            return [];
        }
    }

    async shortcuts() {
        const ret = await this._request('GET', '/fxd/task/index');
        if( ret && ret.data && ret.data.length > 0 )
        {
            return ret.data.filter( item => item.shortcut && item.is_active > 0 );
        }else
        {
            return [];
        }
    }

    sha1(string) {
        return crypto.createHash('sha1').update(string).digest('hex');
    }

    async scSend(text, desp = '', key = null) {

        if( !key )
        {
            // 检查是否存在默认设置
            const settings = this.loadKV('settings.json');
            if( settings.DEFAULT_SENDKEY )
            {
                key = DEFAULT_SENDKEY;
            }
        }
        if( !key ) return { error: 'ai api not set' };

        const postData = querystring.stringify({ text, desp });
        const url = `https://sctapi.ftqq.com/${key}.send`;

        const response = await myFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            },
            body: postData
        }, 1000 * 5);

        const data = await response.text();
        return {'message': 'success', data};
    }

    async apprise(url, title, body, type = 'markdown') {
        // const cmd = `apprise -t '${this.sdk.displayName} 有新的动态' -b '${markdown_body}' -i 'markdown' '${apprise_server_url}'`;
        //             const { stdout, stderr } = await exec(cmd);
        const cmd = `apprise -t '${title}' -b '${body}' -i '${type}' '${url}'`;
        const { stdout, stderr } = await exec(cmd);
        return stderr ? { 'message': 'error', 'error': stderr } : { 'message': 'success', 'data': stdout };
    }
}

export function getHomeDir() {
    return path.join(os.homedir(), '.fxd');
}

export function getDesktopPath(filePath=null) {
    // 如果包含了 path，把它拼接到 desktop 后面
    if( filePath && !Array.isArray(filePath) ) filePath = [filePath];
    return filePath ? path.join(os.homedir(), 'Desktop', ...filePath) : path.join(os.homedir(), 'Desktop');
    
}

export function getDirname(filePath) {
    return dirname(fileURLToPath(filePath));
}

export function getPackageInfo(filePath) {
    return readPackageSync({ cwd: getDirname(filePath) });
}

// myFetch 添加 try catch 和 超时设置
export async function myFetch(url, options, timeout = 1000 * 5) // ms
{
    let controller = new AbortController();
    const id = setTimeout(() => {
        controller.abort()
        controller = new AbortController()
    }, timeout);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('fetch timeout', timeout, 'ms');
        } else {
            throw error;
        }
    } finally {
        clearTimeout(id);
    }
}

export function jsonDecode(str) {
    try {
        return JSON.parse(str);
    } catch (error) {
        return false;
    }
}

export function findCommands(inputString) {
    const regex = /\[(FXD_[^\]]+)\]/gm;
    let matches = [];
    let match;

    while ((match = regex.exec(inputString)) !== null) {
        // 这是为了避免在不匹配的位置无限循环
        if (match.index === regex.lastIndex) {
            regex.lastIndex++;
        }

        // 匹配到的字符串添加到数组中
        matches.push(match[1]);
    }

    return matches;
}

// 支持 timeout 和 http_proxy 参数
export async function pFetch (url, options)
{
    return new Promise( async (resolve, reject) => {
        const { timeout, http_proxy, ...otherOptions } = options;
        const proxy = http_proxy || process.env.HTTP_PROXY || process.env.http_proxy || false;
        const data = {
        ...otherOptions,
        ...( proxy? { "agent": new HttpsProxyAgent(proxy) } : {})
        };
        const controller = new AbortController();
        const timeout_handle = setTimeout(() => {
            controller.abort();
            resolve(false);
        }, timeout);

        try {
            const ret = await nodeFetch(url, {data, signal: controller.signal});
            if( timeout_handle ) clearTimeout(timeout_handle);
            resolve(ret);
        } catch (error) {
            throw error;
        }
    });
};
