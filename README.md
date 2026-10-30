# [智能视觉实验室官网](https://visualintelligencelab.github.io/)

原生 HTML / CSS / JavaScript 静态网站，无需安装依赖。保留六个页面的原有地址，可直接双击 `index.html` 浏览。

## 文件结构

```text
lab-website/
├── index.html                 首页
├── research.html              研究方向
├── publications.html          成果与开源
├── team.html                  团队
├── join.html                  加入我们
├── portal.html                成员资源入口
├── assets/
│   ├── css/
│   │   ├── style.css          样式入口
│   │   ├── base.css           颜色、字体、全局默认值
│   │   ├── layout.css         导航、页脚、网格、响应式布局
│   │   ├── components.css     按钮、卡片、表格、FAQ
│   │   └── pages.css          各页面专用样式
│   ├── js/site.js             共享导航与页脚、移动菜单、表格和资源搜索
│   └── images/               SVG 站点图标、研究示意图
├── scripts/
│   ├── preview.mjs            本机预览服务
│   └── check.mjs              本地链接、锚点、页面结构与 JS 语法检查
└── package.json               开发命令，无第三方依赖
```

## 本地预览

安装 Node.js 后，在本目录执行：

```sh
npm run dev
```

访问终端输出的地址，默认为 `http://127.0.0.1:4173`。按 Ctrl+C 停止。也可执行 `node scripts/preview.mjs`；端口由环境变量 `PORT` 控制。

```sh
npm run check
```

检查只验证本地文件与引用，不验证外部网站可访问性或实验室内容的真实性。

## 内容维护

- 页面正文直接修改对应 HTML。负责人、成员、招募要求、项目数量和日期由维护者核实更新。
- 导航和页脚统一在 `assets/js/site.js` 修改；每页的 `body[data-page]` 对应当前导航项。
- 开源平台主页集中在 `assets/js/site.js` 的 `platforms` 列表维护，自动生成全站页脚、成果页与成员入口的平台目录。OpenDataLab 链接使用 OpenXLab 共用个人空间的公开数据集页；已通过官方匿名用户名查询接口确认 `VisualIntelligenceLab` 账号存在。
- 全站配色和字体在 `assets/css/base.css` 的 `:root` 中调整。
- 所有页面位于根目录，公共资源用 `assets/` 相对路径引用，支持部署到域名子目录。
- 首页项目为精选列表，不代表全部项目。研究插图是概念示意，不是实验结果。
- 成员入口搜索仅在当前浏览器筛选已有链接。文档访问权限仍由对应外部平台管理。
- 公共导航与页脚、成员搜索需要启用 JavaScript；正文和原生 FAQ 不依赖脚本。

## 静态部署

将六个 HTML 文件和整个 `assets/` 文件夹一起上传到静态托管目录即可，无需构建。`scripts/`、`package.json` 和本文档用于源码维护，不必放入部署产物。

## [GitHub 仓库](https://github.com/VisualIntelligenceLab/visualintelligencelab.github.io)

网站源码仓库：[VisualIntelligenceLab/visualintelligencelab.github.io](https://github.com/VisualIntelligenceLab/visualintelligencelab.github.io)。仓库包含全部页面、公共资源、维护文档及本地预览和检查脚本。仓库名遵循 GitHub Pages 对用户站点的小写命名要求。

Gitee 镜像：[VisualIntelligenceLab/visualintelligencelab.github.io](https://gitee.com/VisualIntelligenceLab/visualintelligencelab.github.io)。日常开发在 GitHub 主仓进行，Gitee 通过 Pull 镜像获取代码。

网站已通过 GitHub Pages 发布，官网地址：[https://visualintelligencelab.github.io/](https://visualintelligencelab.github.io/)。发布源为 `main` 分支的 `/ (root)` 目录，后续推送会自动更新网站。发布配置可在仓库 [Settings → Pages](https://github.com/VisualIntelligenceLab/visualintelligencelab.github.io/settings/pages) 中查看。
