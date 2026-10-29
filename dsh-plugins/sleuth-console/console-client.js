// sleuth-console/console-client.js —— 常驻包里的整页「Ascend Sleuth」（client-only）
//
// 为什么单有这一页：指标与自演进读的是**全库**（`metrics/`、`proposals/`、`knowledge/`），
// 与当前会话无关。挂在 `conversation.view` 上等于"必须先开一单诊断才能看库"，而且每个会话
// 各记一份"停在哪个全局页"。整页挂在 `main` + `sidebar.panellist`：左侧多一个图标，没有会话
// 也能打开；会话里只留「诊断」一个 tab。
//
// 两个子页的组件不在这里。两个面板 apply 时把视图登记进 `SLEUTH_VIEWS`（常驻包的生成器在
// 包里建这个对象）；动态热加载路径没有它，面板会退回 `conversation.view`，这一页也就不挂载。
//
// 只读边界不变：只渲染 RPC 读到的数据 + 给可复制指令，不做决策、不写仓库。

return {
  apply(ctx) {
    // 动态热加载路径没有整页容器：安静退出，面板自己注册 tab。
    if (typeof SLEUTH_VIEWS === 'undefined' || SLEUTH_VIEWS === null) return
    const slots = ctx.get('slots')
    if (slots === undefined) return

    const PANEL_ID = 'ascend-sleuth-console'
    const PANEL_LABEL = 'Ascend Sleuth'

    const VIEWS = [
      { id: 'metrics', label: '指标' },
      { id: 'evolve', label: '自演进' },
    ]

    const styleHost = typeof styles !== 'undefined' && styles !== null ? styles : ctx.get('styles')
    const CSS = `
      .sleu-console{height:100%;box-sizing:border-box;overflow:auto;padding:18px 0 40px;
        font-family:var(--font-sans);color:var(--dsw-alias-label-primary);
        background:var(--dsw-alias-bg-layer-1)}
      .sleu-console-inner{max-width:1180px;margin:0 auto;padding:0 20px}
      .sleu-console-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
      .sleu-console-title{font-size:var(--t-2xl);font-weight:700;letter-spacing:.2px}
      .sleu-console-sub{margin-top:3px;font-size:var(--t-sm);color:var(--dsw-alias-label-secondary)}
      .sleu-console-tabs{display:flex;gap:18px;margin-top:14px;border-bottom:1px solid var(--hair)}
      .sleu-console-tab{appearance:none;border:0;border-bottom:2px solid transparent;background:none;
        padding:6px 2px 9px;font:inherit;font-size:var(--t-md);color:var(--dsw-alias-label-secondary);
        cursor:pointer;transition:color .16s ease,border-color .16s ease}
      .sleu-console-tab:hover{color:var(--dsw-alias-label-primary)}
      .sleu-console-tab[data-on="1"]{color:var(--dsw-alias-label-primary);font-weight:600;border-bottom-color:var(--acc-blue)}
      .sleu-console-tab:focus-visible{outline:none;border-radius:var(--r-xs);
        box-shadow:0 0 0 3px color-mix(in srgb, var(--acc-blue) 22%, transparent)}
      .sleu-console-body{padding-top:2px}
      .sleu-console-empty{padding:20px 0;font-size:var(--t-md);color:var(--dsw-alias-label-secondary)}
    `
    let cssDisposer = null
    if (styleHost !== undefined && styleHost !== null && typeof styleHost.insert === 'function') {
      cssDisposer = styleHost.insert(CSS)
    }

    // 图标与 dsh-plugins/sleuth-console/icon.svg 同形（render_check 会逐条比对 path 数据）：
    // 方框取芯片的形，里面一条体检读数线——读的是全库健康，不是某一单的轨迹。
    function ConsoleIcon(props) {
      const size = props && typeof props.size === 'number' ? props.size : 18
      return React.createElement('svg', {
        viewBox: '0 0 24 24', width: size, height: size, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': 'true',
      },
        React.createElement('rect', { x: 3.6, y: 3.6, width: 16.8, height: 16.8, rx: 5 }),
        React.createElement('path', { d: 'M6.4 12h2.1l1.5-3.1 2.3 6.2 1.5-3.1h3.8' }),
      )
    }

    function ConsolePage(props) {
      const requested = props && (props.view === 'metrics' || props.view === 'evolve') ? props.view : 'metrics'
      const [active, setActive] = React.useState(requested)
      const view = SLEUTH_VIEWS[active]
      return React.createElement('div', { className: 'sleu-console' },
        React.createElement('div', { className: 'sleu-console-inner' },
          React.createElement('div', { className: 'sleu-console-head' },
            React.createElement('div', null,
              React.createElement('div', { className: 'sleu-console-title' }, PANEL_LABEL),
              React.createElement('div', { className: 'sleu-console-sub' }, '全库读数 · 判据判决 · 自演进'),
            ),
          ),
          React.createElement('div', { className: 'sleu-console-tabs', role: 'tablist' },
            VIEWS.map(item => React.createElement('button', {
              key: item.id,
              type: 'button',
              role: 'tab',
              'aria-selected': active === item.id ? 'true' : 'false',
              'data-on': active === item.id ? '1' : '0',
              className: 'sleu-console-tab',
              onClick: () => setActive(item.id),
            }, item.label)),
          ),
          React.createElement('div', { className: 'sleu-console-body' },
            view
              ? React.createElement(view, { sessionId: props && props.sessionId })
              : React.createElement('div', { className: 'sleu-console-empty' },
                '这个子页没接上：面板源码没登记视图（重装常驻包或重启 DSH Desktop）。'),
          ),
        ),
      )
    }

    const disposers = []
    disposers.push(slots.inject('main', () => slots.register({
      name: 'main',
      key: PANEL_ID,
    }, ConsolePage)))
    disposers.push(slots.inject('sidebar.panellist', () => slots.register({
      name: 'sidebar.panellist',
      id: PANEL_ID,
      order: 30,
      label: PANEL_LABEL,
    }, ConsoleIcon)))

    if (cssDisposer !== undefined && cssDisposer !== null) disposers.push(cssDisposer)

    return () => {
      for (const dispose of disposers) {
        try {
          if (typeof dispose === 'function') dispose()
        } catch (e) { /* 一个卸载失败不阻塞其余 */ }
      }
    }
  },
}
