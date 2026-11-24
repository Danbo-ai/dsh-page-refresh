/**
 * dsh-page-refresh — 宿主半体。
 *
 * 这个插件的能力全在客户端（一把键盘监听），宿主侧不注册服务、命令、工具或路由。
 * 保留一个可挂载的 index.js，是为了让 cordis.patch.yml 里有一个正经条目，
 * 启停与热重载都走这条链路，而不是靠「没有宿主半体」的特殊情况。
 */
export const name = 'dsh-page-refresh'

export function apply() {
  // 有意为空：逻辑见 client.js。
}
