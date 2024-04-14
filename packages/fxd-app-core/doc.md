FxdApp 类，是Fxd系列应用的基础类，应用都直接或者间接的继承自它。

以下是它包含的方法：

## 方法

### run(params, opts, raw)
- 用途:运行命令
- 参数:
  - params:命令参数数组
  - opts:选项参数对象
  - raw:是否原始模式,默认为false

### list(args, opts) 
- 用途:列出保存的命令

### exe(index) / exec(index)
- 用途:执行保存的命令
- 参数:
  - index:命令索引

### login(args, opts)
- 用途:登录
- 参数: 
  - opts.token: 用户令牌,字符串,非必填

### logout()
- 用途:退出登录

### profile()
- 用途:获取用户信息

### echoError(msg) 
- 用途:显示错误信息
- 参数:
  - msg:错误消息文本

### help()
- 用途:显示帮助信息

### setDeaultOpts(opts)
- 用途:设置默认选项
- 参数:
  - opts:选项参数对象  

### setDeaultCommand(command)
- 用途:设置默认命令 
- 参数:
  - command:命令名称,字符串

### get(key, opts, command)
- 用途:获得参数  
- 参数:
  - key:参数名称
  - opts:选项参数对象,非必填  
  - command:命令名称,字符串,非必填

### log(...args)  
- 用途:打印日志
- 参数:
  - args: 要打印的内容

### return(ret)
- 用途:统一返回值格式  
- 参数:
  - ret:要返回的值

### feedPublish(content, meta, is_public, command)
- 用途:发布 feed  
- 参数: 
  - content: feed 内容 
  - meta: feed 元信息
  - is_public: 是否公开
  - command: 命令名,字符串,非必填

### feedRemove(id)
- 用途:删除 feed
- 参数:
  - id: feed id

### mergeProps(oldObject, props)  
- 用途:合并属性
- 参数:
  - oldObject: 原对象
  - props: 新的属性

