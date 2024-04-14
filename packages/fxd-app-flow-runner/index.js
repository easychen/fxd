import FxdApp from 'fxd-app-core';
import { FxdSdk, getPackageInfo, myFetch, getDesktopPath } from 'fxd-sdk';
import jsonata from 'jsonata';
import Api2d from 'api2d';
import fs from 'fs';
import path from 'path';

async function evalAsync(code, data) {
    try {
        const asyncFunction = new Function('data', `return (async () => { ${code} })()`);
        return await asyncFunction(data);
    } catch (error) {
        console.error('执行代码时发生错误：', error);
        throw error;
    }
}



export default class FxdFlowRunner extends FxdApp {
    constructor() {
        super();
        this.sdk = new FxdSdk(getPackageInfo(import.meta.url));
        this.flowResult = [];
    }

    async main(args, opts, command, cli_path) {
        this.setDefaultOpts(opts);
        this.setDefaultCommand(command);
        this.format = this.get('format');
        
        const id = this.get('id');
        const ret = await this.sdk.flow(id);
        if( ret && ret.data && ret.data.data )
        {
            if( ret.data.data )
            {
                await this.execute(ret.data.data);
                return this.return({
                    'result': this.flowResult.length > 0 ? this.flowResult : '',
                    'output': JSON.stringify(this.flowResult, null, 2).substring(0,100)
                })
            }
            
        }else
        {
            this.echoError('flow not found'+JSON.stringify(ret, null, 2));
        }
    }

    async execute(data) {
        const { nodes, edges } = data;
        let nodeToExecute = [...nodes];
        await this._executeByNode(nodeToExecute, 'start', nodes, edges);
    }

    // Part 2: Executing Node Logic

    async _executeByNode(nodeToExecute, nodeId, nodes, edges, prevNodeData = null, runNext = true) {
        if(!nodeToExecute || nodeToExecute.length < 1 )
        {
            console.error('nodeToExecute is empty',nodeToExecute, [...nodes]);
            nodeToExecute = [...nodes]; 
        }

        const node = nodeToExecute.find(n => n.id === nodeId);
        if (!node) {
            console.error('node not found', nodeId, nodeToExecute);
            return;
        }

        if( nodeId !== 'start')
        {
            // this.log('execute node', JSON.stringify(node,2,null));
            // 先统一处理参数，然后再按type处理业务逻辑
            const { package_name, method, args, input, result, output } = node.data;
            // 这里的 args是输入值的定义，需要从其中的source_from和source_data中计算出实际的输入值；如果没有输入值，又是必填字段，则使用默认值
            
            const argsData = {};
            for (const key in args) {
                const arg = args[key];
                // this.log('arg', arg, 'prevNodeData', prevNodeData);
                // 如果有 source_data 再来查 source_from
                if (arg?.source_data) {
                    // 默认是手工输入
                    const source_from = arg.source_from || 'input';
                    if (source_from === 'input') {
                        argsData[key] = arg.source_data;
                    }

                    if (source_from === 'reference') {
                        // 从 上一个节点的 result 里边取
                        if (prevNodeData && prevNodeData.result) {
                            // argsData[key] = prevNodeData.result[arg.source_data];
                            // 将 arg.source_data 当做 jsonata 表达式处理
                            argsData[key] = await jsonata(arg.source_data).evaluate(prevNodeData.result) || '';
                        }
                    }
                }

                // aichat 在没有指定 ai key等参数的情况下，使用fxd设置的值
                const defaultAiSettings = {
                    'openai_key': '[FXD_SETTINGS::DEFAULT_AI_CHAT_KEY]',
                    'ai_key': '[FXD_SETTINGS::DEFAULT_AI_CHAT_KEY]',
                    'openai_api': '[FXD_SETTINGS::DEFAULT_AI_CHAT_BASEURL]',
                    'ai_apibase': '[FXD_SETTINGS::DEFAULT_AI_CHAT_BASEURL]',
                    'openai_model': '[FXD_SETTINGS::DEFAULT_AI_CHAT_MODEL]',
                    'ai_model': '[FXD_SETTINGS::DEFAULT_AI_CHAT_MODEL]',
                    'sendkey': '[FXD_SETTINGS::DEFAULT_SENDKEY]'
                }
                
                for( const theKey of ['openai_key', 'openai_api', 'openai_model', 'ai_key', 'ai_apibase', 'ai_model', 'sendkey'] )
                {
                    if( this.get(theKey,defaultAiSettings) && !argsData[theKey] )
                    {
                        argsData[theKey] = this.get(theKey,defaultAiSettings);
                    }
                }

                // 如果argsData[key] 未定义，又是必填字段，则使用默认值 
                if (typeof argsData[key] === 'undefined' && arg.required) {
                    argsData[key] = arg.default || '';
                }

                // 如果是必填字段，但是没有默认值，又没有输入值，则报错
                if (arg.required && !argsData[key]) {
                    this.echoError(`参数 ${key} 未设置`);
                    return;
                }
            }
            // args 处理完毕，开始执行业务逻辑
            // this.log('argsData', JSON.stringify(argsData, null, 2));
            
            // 根据 type 执行不同的业务逻辑
            // 首先处理 app 类型，这个是直接调用 fxd命令行
            if (node.type === 'appNode') {
                // 执行节点任务：将输入提交给 localhost:51106/api/exec
                // 参数 {package_name, method, ...args} = req.body;并将结果存入 node.data.result
                // const { package_name, method, args } = node.data;
                this.sdk.wslog(`执行${node.type}节点 - ${node.data.title||""}`);
                const response = await myFetch( 'http://localhost:55106/api/exec', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ package_name, method, ...argsData })
                }, process.env.TIMEOUT || 1000*60*10);
                const ret = await response.json();
                this.sdk.wslog('返回:'+JSON.stringify(ret,2,null).substring(0,100));
                if (ret && ret.message && ret.data) {
                    this.log('retData', ret.data);
                    const retData = {};
                    // 根据 output 的设置，对 ret.data 进行处理
                    if (output && output.success) {
                        for (const key in output.success) {
                            const obj = output.success[key];
                            this.log('obj', obj);

                            // 处理自定义字段
                            if (obj.component === 'with_delete_button') {
                                switch (obj.source_from) {
                                    case 'reference':
                                        if (prevNodeData && prevNodeData.result && prevNodeData.result[obj.source_data]) {
                                            retData[key] = prevNodeData.result[obj.source_data];

                                        }
                                        break;
                                    case 'forward':
                                        const currentNodeData = node.data.args;
                                        const fieldName = obj.source_data;

                                        // obj {
                                        //     "name": "format",
                                        //     "type": "string",
                                        //     "output_filter": "raw",
                                        //     "output_filter_arg": "",
                                        //     "component": "with_delete_button",
                                        //     "source_from": "forward",
                                        //     "source_data": "url"
                                        // }
                                        if (currentNodeData && currentNodeData[fieldName]) {
                                            if (currentNodeData[fieldName] && currentNodeData[fieldName]['source_data'])
                                                retData[key] = currentNodeData[fieldName]['source_data'] || currentNodeData[fieldName]['default'] || '';
                                        }
                                        break;
                                    case 'input':
                                    default:
                                        retData[key] = ret.data[key];
                                }
                            } else {
                                switch (obj.output_filter) {
                                    case 'jsonata':
                                        if (obj.output_filter_arg) {
                                            this.log('obj.output_filter_arg', obj.output_filter_arg, ret.data[key]);

                                            retData[key] = await jsonata(obj.output_filter_arg).evaluate(ret.data[key]);
                                        }
                                        break;
                                    default:
                                        retData[key] = ret.data[key];
                                }
                            }
                        }
                    }

                    // this.log('retData', retData);
                    // unix时间戳
                    const last_execute_at = new Date().getTime();

                    nodes =  nodes.map(n => {
                        if (n.id === nodeId) {
                            const updatedData = { ...n.data, result: retData, last_execute_at };
                            return { ...n, data: updatedData };
                        } else {
                            return n;
                        }
                    });

                    this.flowResult.push(retData);
                }
            }

            if (node.type === 'aiChat') {
                // 
                let content = argsData.prompt;

                // 首先从 content中用正则提取出所有的变量
                const reg = /\{([a-z0-9_\.]+?)\}/ig;
                const matches = content.match(reg);
                if (matches) {
                    for (const match of matches) {
                        this.log('match', match);
                        // 去掉开头的 { 和结尾的 }，不要用replace，用ltrim和rtrim
                        let match_data = match;
                        if (match_data.startsWith('{')) match_data = match_data.substr(1);
                        if (match_data.endsWith('}')) match_data = match_data.substr(0, match_data.length - 1);

                        // match_data包含.，取第一个作为key
                        const match_key = match_data.indexOf('.') > 0 ? match_data.split('.')[0] : match_data;
                        this.log('match_key', match_key);

                        // 根据 match_key 从先 argsData 中取值，如果没有则从 prevNodeData.result 中取值
                        if (argsData[match_key]) {
                            content = content.replaceAll(match, argsData[match_key]['source_data']);
                        } else {
                            if (prevNodeData.result && prevNodeData.result[match_key]) {
                                // 用 jsonata 处理
                                content = content.replaceAll(match, await jsonata(match_data).evaluate(prevNodeData.result) || '');
                            }
                        }

                    }
                }


                this.sdk.wslog(`执行${node.type}节点 - ${node.data.title||""}`);
                const ai = new Api2d(argsData.openai_key, argsData.openai_api || 'https://oa.api2d.net');
                const ret = await ai.completion({
                    model: argsData.openai_model,
                    messages: [
                        {
                            content,
                            role: 'user'
                        }
                    ]
                });
                this.sdk.wslog('返回:'+JSON.stringify(ret,2,null).substring(0,100));
                
                if (ret) {
                    const ret2 = { 'result': ret };
                    const retData = {};
                    // 根据 output 的设置，对 ret.data 进行处理
                    if (output && output.success) {
                        for (const key in output.success) {
                            const obj = output.success[key];
                            this.log('obj', obj);

                            // 处理自定义字段
                            if (obj.component === 'with_delete_button') {
                                switch (obj.source_from) {
                                    case 'reference':
                                        if (prevNodeData && prevNodeData.result && prevNodeData.result[obj.source_data]) {
                                            retData[key] = prevNodeData.result[obj.source_data];

                                        }
                                        break;
                                    case 'forward':
                                        const currentNodeData = node.data.args;
                                        const fieldName = obj.source_data;
                                        // this.log('forward', obj.source_data, currentNodeData, currentNodeData[obj.source_data]);

                                        if (currentNodeData && currentNodeData[fieldName]) {
                                            if (currentNodeData[fieldName] && currentNodeData[fieldName]['source_data']) {
                                                retData[key] = currentNodeData[fieldName]['source_data'] || currentNodeData[fieldName]['default'] || '';
                                            }
                                        }
                                        break;
                                    case 'input':
                                    default:
                                        retData[key] = ret2[key];
                                }
                            } else {
                                switch (obj.output_filter) {
                                    case 'jsonata':
                                        if (obj.output_filter_arg) {
                                            this.log('obj.output_filter_arg', obj.output_filter_arg, ret2[key]);

                                            retData[key] = await jsonata(obj.output_filter_arg).evaluate(ret2[key]);
                                        }
                                        break;
                                    default:
                                        retData[key] = ret2[key];
                                }
                            }
                        }
                    }
                    const last_execute_at = new Date().getTime();
                    nodes =  nodes.map(n => {
                        if (n.id === nodeId) {
                            const updatedData = { ...n.data, result: retData, last_execute_at };
                            return { ...n, data: updatedData };
                        } else {
                            return n;
                        }
                    });

                    this.flowResult.push(retData);
                }
            }

            if (node.type === 'codeNode') {
                this.sdk.wslog(`执行${node.type}节点 - ${node.data.title||""}`);
                let code = argsData.code;
                let ret;
                
                try {
                    ret = await evalAsync(code, { prevNodeData, argsData, nodeData: node.data });
                } catch (error) {
                    this.sdk.wslog('执行代码时发生错误'+error);    
                }
                this.sdk.wslog('返回:'+JSON.stringify(ret,2,null).substring(0,100));
                
                const ret2 = { 'result': ret };
                const retData = {};
                // 根据 output 的设置，对 ret.data 进行处理
                if (output && output.success) {
                    for (const key in output.success) {
                        const obj = output.success[key];
                        this.log('obj', obj);

                        // 处理自定义字段
                        if (obj.component === 'with_delete_button') {
                            switch (obj.source_from) {
                                case 'reference':
                                    if (prevNodeData && prevNodeData.result && prevNodeData.result[obj.source_data]) {
                                        retData[key] = prevNodeData.result[obj.source_data];

                                    }
                                    break;
                                case 'forward':
                                    const currentNodeData = node.data.args;
                                    const fieldName = obj.source_data;
                                    // this.log('forward', obj.source_data, currentNodeData, currentNodeData[obj.source_data]);

                                    if (currentNodeData && currentNodeData[fieldName]) {
                                        if (currentNodeData[fieldName] && currentNodeData[fieldName]['source_data']) {
                                            retData[key] = currentNodeData[fieldName]['source_data'] || currentNodeData[fieldName]['default'] || '';
                                        }
                                    }
                                    break;
                                case 'input':
                                default:
                                    retData[key] = ret2[key];
                            }
                        } else {
                            switch (obj.output_filter) {
                                case 'jsonata':
                                    if (obj.output_filter_arg) {
                                        this.log('obj.output_filter_arg', obj.output_filter_arg, ret2[key]);

                                        retData[key] = await jsonata(obj.output_filter_arg).evaluate(ret2[key]);
                                    }
                                    break;
                                default:
                                    retData[key] = ret2[key];
                            }
                        }
                    }
                }
                const last_execute_at = new Date().getTime();
                nodes =  nodes.map(n => {
                    if (n.id === nodeId) {
                        const updatedData = { ...n.data, result: retData, last_execute_at };
                        return { ...n, data: updatedData };
                    } else {
                        return n;
                    }
                });

                this.flowResult.push(retData)

            }

            if(node.type === 'file')
            {
                this.sdk.wslog(`执行${node.type}节点 - ${node.data.title||""}`);
                if( argsData['file_name'] && argsData['file_content'] )
                {
                    const file_name = argsData['file_name'];
                    const file_content = argsData['file_content'];
                    const file_dir = path.join( getDesktopPath(), 'fxd');
                    const file_path = path.join( file_dir, file_name);
                    this.log('file_path', file_path);
                    
                    // 用 node fs 确保 file_path 的目录存在
                    if( !fs.existsSync( file_dir ) )
                        fs.mkdirSync(file_dir, { recursive: true });
                    
                    // 写入文件，用utf-8编码
                    fs.writeFileSync(file_path, file_content, 'utf-8');
                    this.sdk.wslog('file written');
                    
                    this.flowResult.push({message:'file written', file_path});
                }else
                {
                    this.sdk.wslog('file_name or file_content not found');
                    this.flowResult.push({error:'file_name or file_content not found'});
                }
            }

        }

        if (runNext) {
            // 通过 edges 找到下一个节点(可能包含多个)
            const nextEdges = edges.filter(e => e.source === nodeId);
            for (const nextEdge of nextEdges) {
                // 找到下一个节点
                const nextNodeId = nextEdge.target;
                this.log('nextNodeId', nextNodeId);
                if (nextNodeId) {
                    // 递归执行下一个节点
                    await this._executeByNode(nodeToExecute, nextNodeId, nodes, edges, node.data || {});
                }
            }
        }
    }
    



}