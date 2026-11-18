# 本地项目删除验收

- 代码基线：`origin/main` / `d126c880980b8049351729b12e116d6b1ae6406d`
- 被测代码提交：`a0773931aa1ca3e395aed23a4937b9226cb8c205`
- 环境：本地 Next.js 生产构建，通过独立 Chromium Browser Context 访问 `http://127.0.0.1:4331`；未连接 Production，也未读取真实用户浏览器存储。
- 命令：`npm run lint`、`npm run typecheck`、`npm run build` 均通过；`PROJECT_DELETION_BASE_URL=http://127.0.0.1:4331 npm run test:project-deletion` 为 **26 PASS / 0 FAIL**，`browserErrors=[]`。
- 机器可读结果：[results.json](./results.json)。截图：[桌面删除确认](./delete-confirm-desktop.png)、[窄屏项目列表](./project-list-narrow.png)、[窄屏删除确认](./delete-confirm-narrow.png)。

浏览器回归覆盖同名项目按 ID 删除、取消、项目及关联文件/解析记录清理、其他项目隔离、空间统计、刷新、同名重建、备份恢复、年度复制、旧 `localStorage` 中文项目、旧版示例数据、旧键清理失败后的防回流与重试，以及 IndexedDB 事务失败时的回滚。旧项目场景使用隔离 Context 内构造的旧格式记录；线上历史项目未被修改。
