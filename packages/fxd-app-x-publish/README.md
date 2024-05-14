# fxd-app-x-publish

## 如何使用

这是一个 fxd 应用，需要安装 fxd-cli 命令行工具。更多信息请[查看手册](https://ft07.com/fxd/)。

本应用需要维持登录态，因此要先用 fxd-app-keep-live2 打开推特登录，然后再运行命令行。

## 使用实例

### 长文+图

`./fxd xPublish --content="终于把无感录屏这事搞定了。这事我觉得挺重要，因为它可以在你工作或者写开源项目的时候直接把过程录制下来，只需要再剪辑一下，直接就可以作为副产品了。  不过我的电脑配置不太高，OBS跑起来本身就挺费资源，要是再同时把 docker/android studio/xcode开着（比如开发Flutter应用的时候），就会很卡。  之前尝试通过vnc让另外一台电脑登录进来录制，但是对被录制的电脑影响还是蛮大的。最后还是得靠硬件方案，花600多买了个支持4K录制和环出的视频采集卡，终于搞定了。  之前测试的时候买过小几百块的那种，录下来清晰度都不行，还是一分钱一分货啊" --headless="false" --images="/Users/easy/Playground/fxd/images/20240414114221.png"`

### 调试模式

DEBUG=pw:api ./fxd xPublish --content="在调试playwright时,可以加入DEBUG=pw:api 环境变量,这样会输出非常详细的日志,方便在headless模式下定位问题" --format="json"

