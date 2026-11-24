/**
 * dsh-page-refresh 冒烟测试：在 Node 里用一个假的 window 跑一遍 client.js，
 * 检查键位命中、默认动作是否被吃掉、热重载是否会叠出两个监听、卸载是否干净。
 *
 * 跑法：node tests/smoke.mjs
 */
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

let reloads = 0
const listeners = new Set()

const windowStub = {
  addEventListener(type, handler, options) {
    listeners.add({ type, handler, options })
  },
  removeEventListener(type, handler) {
    for (const item of [...listeners]) {
      if (item.type === type && item.handler === handler) listeners.delete(item)
    }
  },
  location: {
    reload() {
      reloads += 1
    },
  },
}

globalThis.window = windowStub

let loaded
windowStub.__ModuleLoader__ = {
  load(mod) {
    loaded = mod
  },
}

const file = pathToFileURL(resolve(import.meta.dirname, '..', 'client.js')).href
await import(file)

const problems = []
const check = (name, ok, detail = '') => {
  if (!ok) problems.push(`${name}${detail === '' ? '' : ` — ${detail}`}`)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail === '' ? '' : `  (${detail})`}`)
}

check('module id', loaded?.id === 'dsh-page-refresh', String(loaded?.id))
const mod = loaded.factory()
check('exports inject/apply', Array.isArray(mod.inject) && typeof mod.apply === 'function')
check('inject 为空数组', mod.inject.length === 0, JSON.stringify(mod.inject))

/** 模拟宿主 cordis 的 ctx：effect 立刻执行回调，并回传清理函数。 */
const makeCtx = () => {
  const disposers = []
  return {
    disposers,
    effect(fn) {
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
      return dispose
    },
  }
}

const dispatch = (key, { ctrl = false, alt = false, shift = false, meta = false, repeat = false, composing = false } = {}) => {
  const event = {
    key,
    ctrlKey: ctrl,
    altKey: alt,
    shiftKey: shift,
    metaKey: meta,
    repeat,
    isComposing: composing,
    prevented: false,
    preventDefault() {
      this.prevented = true
    },
  }
  for (const item of [...listeners]) if (item.type === 'keydown') item.handler(event)
  return event
}

/** 真实按键是各自独立的任务，测试里让出一次微任务，模拟「下一按」。 */
const press = async (key, mods) => {
  await Promise.resolve()
  return dispatch(key, mods)
}

const ctx1 = makeCtx()
mod.apply(ctx1)

const keydownCount = () => [...listeners].filter((i) => i.type === 'keydown').length
check('挂了一个 keydown 监听', keydownCount() === 1)

const f5 = await press('F5')
check('F5 被拦截并重载', f5.prevented === true && reloads === 1, `prevented=${f5.prevented} reloads=${reloads}`)

const ctrlR = await press('r', { ctrl: true })
check('Ctrl+R 被拦截并重载', ctrlR.prevented === true && reloads === 2, `prevented=${ctrlR.prevented} reloads=${reloads}`)

const hard = await press('R', { ctrl: true, shift: true })
check('Ctrl+Shift+R 不拦截', hard.prevented === false && reloads === 2, `prevented=${hard.prevented} reloads=${reloads}`)

const plainR = await press('r')
check('裸 r 不拦截', plainR.prevented === false && reloads === 2, `reloads=${reloads}`)

const repeat = await press('F5', { repeat: true })
check('长按重复事件不触发', repeat.prevented === false && reloads === 2, `reloads=${reloads}`)

const composing = await press('F5', { composing: true })
check('输入法组合中不触发', composing.prevented === false && reloads === 2, `reloads=${reloads}`)

// 同一事件里连调两次 reload（模拟两个监听同时命中）只算一次
const before = reloads
globalThis.__dshPageRefresh.trigger()
globalThis.__dshPageRefresh.trigger()
check('同一任务内重复 reload 只放行一次', reloads === before + 1, `reloads=${reloads}`)
await Promise.resolve()

// —— 热重载：第二次 apply 应卸掉第一份监听 ——
const ctx2 = makeCtx()
mod.apply(ctx2)
check('重复注入后仍只有一个监听', keydownCount() === 1, `count=${keydownCount()}`)

const afterHot = await press('F5')
check('重复注入后一次按键只重载一次', afterHot.prevented === true && reloads === before + 2, `reloads=${reloads}`)

// —— 卸载 ——
for (const dispose of ctx2.disposers) dispose()
check('卸载后监听被移除', keydownCount() === 0, `count=${keydownCount()}`)

const afterDispose = await press('F5')
check('卸载后按键不再触发', afterDispose.prevented === false && reloads === before + 2, `reloads=${reloads}`)

// 第一次 apply 的清理函数（已被第二次替换掉）不应把页面搞坏
for (const dispose of ctx1.disposers) {
  try {
    dispose()
  } catch {
    /* 允许：旧的一份已经被替换 */
  }
}

console.log(`\nreloads=${reloads}`)
if (problems.length > 0) {
  console.error(`\n${problems.length} 项失败：\n- ${problems.join('\n- ')}`)
  process.exitCode = 1
} else {
  console.log('全部通过')
}
