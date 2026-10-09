import { readFile, writeFile } from 'node:fs/promises'

const nodes = [
  ['queued', 60, 140, 180, 80, 'active', '排队'],
  ['starting', 300, 140, 180, 80, 'active', '启动'],
  ['running', 540, 140, 200, 80, 'active', '运行'],
  ['succeeded', 1260, 140, 240, 80, '', '成功'],
  ['awaiting_input', 350, 360, 250, 80, 'wait', '等待输入'],
  ['awaiting_approval', 690, 360, 290, 80, 'wait', '等待审批'],
  ['failed', 1260, 360, 240, 80, '', '失败'],
  ['cancelling', 670, 650, 240, 90, 'wait', '正在取消'],
  ['cancelled', 1260, 650, 240, 90, '', '已取消'],
]
const edges = [
  ['queued', 'starting', 'M240 180 H300'],
  ['starting', 'running', 'M480 180 H540'],
  ['running', 'succeeded', 'M740 180 H1260'],
  ['running', 'awaiting_input', 'M600 220 V300 H475 V360'],
  ['awaiting_input', 'running', 'M430 360 V260 H560 V220'],
  ['running', 'awaiting_approval', 'M680 220 V315 H835 V360'],
  ['awaiting_approval', 'running', 'M930 360 V275 H720 V220'],
  ['running', 'failed', 'M740 205 H1110 V400 H1260'],
  ['awaiting_input', 'failed', 'M600 400 H640 V505 H1110 V400 H1260'],
  ['awaiting_approval', 'failed', 'M980 400 H1260'],
  ['any_nonterminal', 'cancelling', 'M560 695 H670'],
  ['cancelling', 'cancelled', 'M910 695 H1260'],
]
const text = (x, y, value, style = 'small') =>
  `<text x="${x}" y="${y}" class="${style}">${value}</text>`

for (const language of ['en', 'zh']) {
  const zh = language === 'zh'
  const title = zh ? '执行生命周期' : 'Portable Execution Lifecycle'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-labelledby="title desc">
<title id="title">${title}</title>
<desc id="desc">${zh ? '运行及等待期间的 Provider 错误都可进入失败终态；所有非终态均可发起取消。' : 'Provider failures can end running or awaiting states; cancellation applies to every non-terminal state.'}</desc>
<defs>
<marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#59616d"/></marker>
<style>
text { font-family: Inter, "PingFang SC", system-ui, sans-serif; text-anchor: middle; fill: #20242b; }
.title { font-size: 48px; font-weight: 700; }
.label { font-size: 25px; font-weight: 650; }
.small { font-size: 20px; fill: #59616d; }
.node { fill: #fff; stroke: #59616d; stroke-width: 3; rx: 8; }
.active { stroke: #1473e6; } .wait { stroke: #b66b00; }
.edge { fill: none; stroke: #59616d; stroke-width: 3; marker-end: url(#arrow); }
</style></defs>
<rect width="1600" height="900" fill="#fff"/>
${text(800, 66, title, 'title')}
${text(800, 104, zh ? '一次有界执行，只产生一个终态结果' : 'One bounded attempt, one terminal outcome')}
${nodes.map(([name, x, y, width, height, style, label]) => `<rect data-state="${name}" x="${x}" y="${y}" width="${width}" height="${height}" class="node ${style}"/>${text(x + width / 2, y + (zh ? 36 : 49), name, 'label')}${zh ? text(x + width / 2, y + 67, label) : ''}`).join('\n')}
<rect x="60" y="650" width="500" height="90" class="node wait"/>
${text(310, 690, zh ? '发起取消' : 'Cancel request', 'label')}
${text(310, 722, zh ? '适用于任意非终态' : 'from any non-terminal state')}
${edges.map(([from, to, path]) => `<path data-from="${from}" data-to="${to}" d="${path}" class="edge"/>`).join('\n')}
${text(990, 164, zh ? '执行完成' : 'completed')}
${text(430, 248, zh ? '响应恢复' : 'response')}
${text(515, 332, zh ? '请求输入' : 'request')}
${text(880, 261, zh ? '响应恢复' : 'response')}
${text(740, 342, zh ? '请求审批' : 'request')}
${text(1380, 478, zh ? 'Provider 错误' : 'Provider failure')}
${text(1380, 508, zh ? '运行或等待期间均可失败' : 'running or awaiting')}
${text(800, 832, zh ? '终态不会返回活动状态；取消流程拥有其最终取消结果。' : 'Terminal states never return to active states. Cancellation owns its terminal outcome.')}
</svg>\n`
  const target = new URL(`../assets/execution-lifecycle-${language}.svg`, import.meta.url)
  if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8')) !== svg)
      throw new Error(`Stale lifecycle diagram: ${language}`)
  } else {
    await writeFile(target, svg)
  }
}
console.log('Bilingual lifecycle SVGs verified with 12 explicit transitions')
