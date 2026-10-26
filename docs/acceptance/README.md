# 第一轮产品验收材料

本目录用于 ESG Disclosure Platform 第一轮产品原型验收，不包含新增业务功能。

## 运行截图

截图生成于 2026-10-26，来源为通过 `npm run build` 构建后启动的本地生产服务。浏览器视口为 1440 × 1000，步骤页采用全页截图。

| 页面 | 截图 |
| --- | --- |
| 项目首页 | [01-project-home.png](screenshots/01-project-home.png) |
| Step 1 创建报告与企业基础画像 | [02-step-1-enterprise-profile.png](screenshots/02-step-1-enterprise-profile.png) |
| Step 2 ESG 实质性议题评估 | [03-step-2-materiality.png](screenshots/03-step-2-materiality.png) |
| Step 3 构建披露框架与报告大纲 | [04-step-3-framework-outline.png](screenshots/04-step-3-framework-outline.png) |
| Step 4 ESG 资料收集、汇总与规整 | [05-step-4-data-collection.png](screenshots/05-step-4-data-collection.png) |

## 已真实实现的前端交互

- 首页“新建报告”弹窗开关、继续编辑跳转。
- 首页、工作台侧边栏及步骤底部的 App Router 页面导航。
- 桌面侧边栏和平板抽屉导航。
- Step 1 上市身份切换、披露框架多选、议题移除。
- Step 2 议题搜索与筛选、纳入调整、评估方式切换、结果确认。
- Step 3 页内标签切换、披露要求搜索与框架筛选、适用性调整和人工确认、章节选择与表单编辑。
- Step 4 页内标签切换、资料搜索、责任部门调整、上传/在线补充面板、示例 AI 结果人工确认、事实来源展开查看。
- 无效项目或步骤进入自定义 404 页面。

上述交互均在浏览器本地状态中运行，刷新后不会持久化。

## 模拟数据与占位逻辑

- 企业、报告项目、议题、披露要求、资料任务、事实库及来源关联均为本地模拟数据。
- 新建报告不会创建真实项目；保存草稿不会写入数据库。
- 文件上传、在线补充及导出按钮仅展示原型交互，不会传输或生成文件。
- AI 资料规整结果为明确标注的示例结果，不调用真实 AI 接口。
- Step 5–8 仅为“待开发”占位页面。
- 当前未接入后端 API、数据库、身份权限、文件存储或真实协作能力。

## 验证结果

```text
npm run lint       通过
npm run typecheck  通过
npm run build      通过
```

生产构建已成功预生成项目首页及 Step 1–8 路由。
