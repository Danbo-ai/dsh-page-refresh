# dsh-page-refresh

用键盘快捷键刷新 DSH 的前端页面。**没有任何按钮**，也不会重启 host 进程——只是让 Web UI 重新加载一次，重连会话、重拉数据。

## 键位

| 快捷键 | 动作 |
| --- | --- |
| `F5` | 重载页面 |
| `Ctrl+R` | 重载页面 |

`Ctrl+Shift+R`（硬刷新）不拦截，交给浏览器原生处理。

## 换键位

打开 `client.js`，改 `SHORTCUTS` 这张表，存盘后在页面上按一次 F5（或 Ctrl+R）让新代码生效：

```js
const SHORTCUTS = [
  { label: 'F5', key: 'f5', ctrl: false, alt: false, shift: false, meta: false },
  { label: 'Ctrl+R', key: 'r', ctrl: true, alt: false, shift: false, meta: false },
  // 例如再加一个自定义组合：
  // { label: 'Ctrl+Alt+R', key: 'r', ctrl: true, alt: true, shift: false, meta: false },
]
```

修饰键必须与表里**完全一致**才算命中，所以 `Ctrl+Shift+R` 不会误触 `Ctrl+R`。

## 控制台调试

页面每次加载成功都会打印一行：

```
[dsh-page-refresh] 已接管快捷键：F5 / Ctrl+R
```

看到这行就说明模块已装进页面、监听就位。另外：

- `__dshPageRefresh.shortcuts` 看当前生效的键位
- `__dshPageRefresh.trigger()` 直接刷一次

## 实现

- `client.js`：`window.__ModuleLoader__.load({ id, factory })`，在 `ctx.effect` 里挂 `keydown` 监听（捕获阶段），命中就 `location.reload()`；卸载时移除监听，热重载不会叠出两份。
- `index.js`：宿主半体，空实现——只为让 `cordis.patch.yml` 有个可挂载条目。
- 不注册 slot、菜单、命令、工具、路由，所以界面上看不到任何入口。

## 安装（desktop profile）

1. `%USERPROFILE%\.dsh\profiles\desktop\package.json` 的 `dependencies` 加：
   `"dsh-page-refresh": "link:D:/dsh-project/plugin/packages/dsh-page-refresh"`
2. 同文件 `dsh.profile.bundles` 加 `"dsh-page-refresh"`
3. 在 profile 的 `node_modules` 下建一个指向本目录的 junction（link 依赖 pnpm 不会替你建）：
   `mklink /J "%USERPROFILE%\.dsh\profiles\desktop\node_modules\dsh-page-refresh" "D:\dsh-project\plugin\packages\dsh-page-refresh"`
4. 热加载：`plugin_manager set_bundle target:"dsh-page-refresh" enabled:true`（关一次再开一次即可，不需要重启进程）
