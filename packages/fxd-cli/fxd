#!/usr/bin/env node

import chalk from 'chalk';
import minimist from 'minimist';
import humps from 'humps';
import path, { dirname } from 'path';
import { execSync, exec as execCb } from 'child_process';
import { promisify } from 'util';
const exec = promisify(execCb);

async function checkYarnInstallation() {
    try {
        const { stdout } = await exec('yarn --version');
        return true;
    } catch (error) {
        return false;
    }
}

import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';
import os from 'os';
const __dirname = dirname(fileURLToPath(import.meta.url));

// const DEV = true || process.env.NODE_ENV === 'development';

// 读取参数
const { _: args, ...opts } = minimist(process.argv.slice(2));
let [command, ...params] = args;
// ./fxd _login main  --user=easy -p "book/23423432/ 34234"
//       ^     ^     ^     ^     ^     ^     ^     ^
//      command params opts    opts  opts  opts  opts 

// console.log(chalk.green('fxd-cli'), command, params, opts);

// 如果命令不存在，则默认为 core help
if( !command )
{
    command = 'core';
    params = ['help'];
}

// 如果命令以 _ 开头，则为内部命令，转向 core
if( command.startsWith('_') )
{
    // 内部命令
    params = [command.slice(1), ...params];
    command = 'core';
}

// 检查 fxd_app_${command} module 是否存在（ESM语法）
let module;
const formattedCommand = humps.decamelize(command, { separator: '-' });
const packageName = `fxd-app-${formattedCommand}`;
try {
    
    // 调试模式则加载本地文件
    const paths = [];
    // 上级目录
    paths.push(path.join(__dirname, '..', packageName , 'index.js'));
    // 开发目录（独立项目）
    paths.push(`~/Code/gitcode/${packageName}/index.js`);
    
    // npm 全局安装目录，通过 npm root -g 实时获取，使用 ESM 语法
    const npmGlobalRoot = execSync('npm root -g').toString().trim();
    paths.push(path.join(npmGlobalRoot, packageName, 'index.js'));

    // 作为 fxd-cli 全局安装的子目录被安装
    paths.push(path.join(npmGlobalRoot, 'fxd-cli', 'node_modules', packageName, 'index.js'));

    // 检查 yarn 命令是否存在
    if( await checkYarnInstallation() )
    {
        // yarn 全局安装目录，通过 yarn global dir 实时获取，使用 ESM 语法
        const yarnGlobalRoot = execSync('yarn global dir').toString().trim();
        paths.push(path.join(yarnGlobalRoot, 'node_modules', packageName, 'index.js'));

        // 作为 fxd-cli 全局安装的子目录被安装
        paths.push(path.join(yarnGlobalRoot,'node_modules', 'fxd-cli', 'node_modules', packageName, 'index.js'));
    }

    // 挨个尝试，如果都不存在，这为 `${packageName}`
    let thePath = `${packageName}`;
    // 循环 paths，如果存在，则赋值给 thePath
    for (const p of paths) {
        if (fs.existsSync(p)) {
            thePath = p;
            break;
        }
    }

    const app = await import(pathToFileURL(thePath));
    module = new app.default();
    // 如果存在 module.run 方法，则执行
    if (module && module.run) {

        // params, opts, command, cli_path
        await module.run(params, opts, params[0], __dirname);
    }else
    {
        console.log("no module.run", module);
    }
}    
catch(e)
{
    console.log("e", e);
    console.error(chalk.red(`fxd-cli: command "${command}(${packageName})" not found`));
    process.exit(1);
}



