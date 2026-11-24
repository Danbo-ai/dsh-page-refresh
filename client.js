/**
 * dsh-page-refresh — 客户端半体：只提供快捷键，刷新 DSH 前端页面。
 *
 * 为什么要有它：开发插件时经常需要让前端重新拉一次（新代码、新会话、新标题），
 * 但重载以前只能靠原生 F5，或者干脆重启进程。这里把重载做成一个自己可控的按键，
 * 不新增任何按钮、菜单或侧栏入口。
 *
 * 做法：在 window 上挂一个 keydown 监听（捕获阶段），命中白名单里的组合就
 * location.reload()。只拦截白名单内的组合，Ctrl+Shift+R（硬刷新）等其他按键
 * 一律原样交给浏览器处理。
 */
window.__ModuleLoader__.load({
  id: 'dsh-page-refresh',
  factory() {
    /**
     * 快捷键白名单。换键就改这张表，存盘后刷新一次页面即生效。
     *
     * 字段说明：
     *   key     event.key 的小写形式（'f5'、'r' 都可以）
     *   ctrl / alt / shift / meta  修饰键必须与这里完全一致才算命中
     *   label   仅用于控制台调试输出
     *
     * 默认两条：F5、Ctrl+R。要加自定义组合，照下面的形状补一行即可，例如：
     *   { label: 'Ctrl+Alt+R', key: 'r', ctrl: true, alt: true, shift: false, meta: false },
     */
    const SHORTCUTS = [
      { label: 'F5', key: 'f5', ctrl: false, alt: false, shift: false, meta: false },
      { label: 'Ctrl+R', key: 'r', ctrl: true, alt: false, shift: false, meta: false },
    ]

    /** 命中判断：修饰键严格相等，键名忽略大小写。 */
    const matches = (event, shortcut) => {
      if (String(event.key).toLowerCase() !== shortcut.key) return false
      return event.ctrlKey === shortcut.ctrl
        && event.altKey === shortcut.alt
        && event.shiftKey === shortcut.shift
        && event.metaKey === shortcut.meta
    }

    /**
     * 一次按键只放行一次 reload：同一个事件里如果还有别的监听器也调了 reload，
     * 只认第一次；下一个任务（也就是下一次真实按键）自动重新武装。
     */
    let armed = true
    const reload = () => {
      if (!armed) return
      armed = false
      queueMicrotask(() => {
        armed = true
      })
      window.location.reload()
    }

    const onKeyDown = (event) => {
      if (event.repeat || event.isComposing) return
      const hit = SHORTCUTS.find((shortcut) => matches(event, shortcut))
      if (hit === undefined) return
      // 只吃掉默认动作（原生 F5 / Ctrl+R），不 stopPropagation，别的监听器照旧收得到。
      event.preventDefault()
      reload()
    }

    return {
      // 不依赖任何客户端服务：没有 UI、没有远程调用，只有一把键盘监听。
      inject: [],
      apply(ctx) {
        ctx.effect(() => {
          // 热重载或重复注入时先卸掉上一份，避免同一页面叠出两个监听（一次按键刷两次）。
          const previous = globalThis.__dshPageRefresh
          if (previous !== undefined && typeof previous.dispose === 'function') {
            try {
              previous.dispose()
            } catch {
              /* 旧的一份已经没了，忽略 */
            }
          }

          window.addEventListener('keydown', onKeyDown, { capture: true })
          console.info(`[dsh-page-refresh] 已接管快捷键：${SHORTCUTS.map((s) => s.label).join(' / ')}`)

          const dispose = () => {
            window.removeEventListener('keydown', onKeyDown, { capture: true })
          }

          // 调试入口：控制台里 __dshPageRefresh.trigger() 刷一次；__dshPageRefresh.shortcuts 看当前键位。
          globalThis.__dshPageRefresh = { shortcuts: SHORTCUTS, trigger: reload, dispose }

          return () => {
            dispose()
            if (globalThis.__dshPageRefresh?.dispose === dispose) {
              globalThis.__dshPageRefresh = undefined
            }
          }
        }, 'dsh-page-refresh: 快捷键刷新页面')
      },
    }
  },
})
