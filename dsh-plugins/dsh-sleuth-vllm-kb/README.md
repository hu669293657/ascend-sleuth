# dsh-sleuth-vllm-kb（vllm-kb 的 DSH 接入插件，实验性）

把 vllm-kb 的只读检索接进 ascend-sleuth 的诊断：步骤 5 按版本或镜像查源码、查修复链、读手册原文，步骤 1 把截图转成文字。**只要配一个端点就能用**——请求直接打它的只读接口（`GET /health`、`POST /code/search`、`GET /graph/chain`、`GET /doc/{id}`、`POST /tags/match`、`POST /ocr`）。

插件是**可选**的：不装、或装着但工具行关掉时，诊断流程与现在完全一样。

## 两行

| 行 id | 默认 | 作用 |
|---|---|---|
| `vllm-kb-tools` | 关 | 注册三个工具：`vllm_kb_code`、`vllm_kb_fix`、`vllm_kb_doc` |
| `vllm-kb-ocr` | 关 | 只注册 `vllm_kb_ocr`（截图转文字）。模型能读图时不必开 |
| `vllm-kb-settings` | 开 | 设置页左侧栏「vllm-kb」那一项背后的配置与探测路由，不注册工具 |

## 装与配

1. 装包：`node scripts/panel_install.js --all`（和面板包一起装/更新），或 `node scripts/panel_install.js --spec "$PWD/dsh-plugins/dsh-sleuth-vllm-kb"` 只装它；也可以在侧栏「插件」里粘贴本目录绝对路径。换装要重启 DSH Desktop。
2. **设置页左侧栏**多一项「vllm-kb」，点进去：添加端点（名称 + 地址）、单选启用、点「测试」看 `/health` 的往返耗时与 embedding 状态（探的就是输入框里那条地址，改完直接测，不必先保存）。**OCR 走哪个地址**：与检索同一个 KB 端点（`POST :8000/ocr`）。从 vllm-kb 实现看，`/ocr` 是同一个 API 应用上的路由，PaddleOCR 由服务端通过 `ocr_provider=api` + `ocr_api_base` 调用，agent 不直连它。
3. 打开插件页里本包的 `vllm-kb-tools` 行；需要截图转文字再单独开 `vllm-kb-ocr`（模型能读图就不用开）。
4. 会话里就有 `vllm_kb_*` 四个工具了。

改端点或切换启用端点不用重启：工具每次调用都重读配置。

配置落在 `~/.dsh/vllm-kb.json`（机器级，不进仓库）：

```json
{
  "endpoints": [{ "id": "ep-1", "label": "内网测试", "base_url": "http://10.0.0.8:8000" }],
  "active": "ep-1",
  "probe_timeout_ms": 1000,
  "probe_ttl_ms": 30000,
  "request_timeout_ms": 15000
}
```

## 分层：工具层在 harness 侧，流程层在仓库侧

- **harness 侧（本插件）**：注册工具、读端点、探测、截断输出。端点存在 `~/.dsh/vllm-kb.json`，**每次工具调用重读**——改端点或切换启用端点，下一次调用就生效，不用重启；走设置页保存会同时清探测缓存。
- **仓库侧（sleuth）**：只写"什么时候调、怎么读、拿不到怎么办"，不写地址、不写服务名。流程判断"有没有这组工具"，**不看端点通不通**（那是可达性）。
- **trace 中性**：动作与顶层字段只记能力、结果、开没开，不记端点地址。

所以换端点、换部署、甚至将来换实现，都不需要改流程文本；反过来关掉工具行，流程回到原路径。

## 四个工具

| 工具 | 请求 | 用在 |
|---|---|---|
| `vllm_kb_code` | `POST /code/search`，body `{keyword, version, repo, path, per_version, kind, limit}` | 步骤 5 源码分析，镜像与 fork 现场 |
| `vllm_kb_fix` | `GET /graph/chain?doc=<source_id>`，`repo#编号` 自动转成 `github:<org-repo>:issue:<编号>` | 步骤 5 回答「修复进了哪个版本」，结果只当线索 |
| `vllm_kb_doc` | `POST /tags/match`（给问题）或 `GET /doc/{id}`（给编号） | 需要手册原文时 |
| `vllm_kb_ocr` | `POST /ocr`（KB 端点），本地图片 base64（上限 6 MB） | 兜底：模型不能读图、工程师也贴不了文字时（单独一行开关） |

每次调用前先探一次 `GET /health`（1 秒超时，30 秒缓存、按端点分键）。不可达或服务端报错时工具返回 `{ok:false, reason}`，**不抛异常**；模型按词条要求记 `external_lookup`（`outcome: skipped`）并回原路径，本单不重试。返回内容截断到 8000 字符。

## 不用 DSH 也能跑的自测

```bash
node scripts/check_vllm_kb.js
```

打桩跑 35 项：插件入口接线（`index.js` 可加载、无 `@deepseek-ai/dsh-tools` 时回退 `defineTool` 能注册三个工具）、配置归一化与读写、`repo#编号 → source_id`、四个能力的请求形状（进程内假服务核对 body 与 query）、输出截断、5xx 映射、可用性三态与缓存，探测路由用请求带来的地址与超时（页面上改了还没保存也能测）、探没保存的地址不写缓存，以及 `scripts/vllm_kb_config.mjs` 这个兜底命令行入口能跑通。CI 的 panel-checks 里跑这一条。

**它证明不了的**：设置页那一项能否渲染、工具注册、真服务返回的业务字段。这几条只能真机验证。

## 联调清单（内网）

1. `curl <KB 端点>/health` 有 JSON 返回，并看 `ocr` 字段的状态（服务端没配 OCR 时这里会显示未配置）。
2. 设置页「vllm-kb」→ 添加端点 → 点「测试」看到 `HTTP 200` 与毫秒数。**填完地址直接点「测试」就行，不必先保存**——探测用的是页面上那条地址；保存只决定工具侧读哪一条。
3. 打开 `vllm-kb-tools` 行，新会话看工具目录里有没有 `vllm_kb_*`。
4. 真实问题跑一次 `vllm_kb_code`（镜像现场最好）：看返回是否被截断、耗时。
   再补三条字段级验证，用来区分「插件/流程没接好」与「服务端数据没构建」：
   - `vllm_kb_code` 三种模式各真命中一次：`version='v0.23.0'`（带 v）、`kind=msg` 用源码里的完整字面量、`in_file` 给精确路径；
   - `vllm_kb_doc` 查 `body` 是否非空（空 = 服务端没返回原文，不是手册没有）；
   - `vllm_kb_fix` 拿一个已关闭 issue 看 `fixes` 是否非空（空 = 图数据没构建，不代表未修复）。
5. 关掉 `vllm-kb-tools` 再跑一次诊断：工具不在、流程走原路径、trace 顶层是 `external_evidence: off`。
6. 把端点改成不可达地址再跑：工具返回 `unreachable`，trace 记 `skipped` 加 `probe-failed`。
