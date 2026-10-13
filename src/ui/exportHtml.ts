// Relatório em HTML único (cofre: tecnologia › Desenvolvimento › HTMLs únicos e autocontidos): as seis
// folhas como estão na tela, só com o CSS que elas usam, e as fontes e as imagens embutidas. Abre sem
// rede e sem a pasta do app. Na tela as folhas encolhem para caber; na impressão, cada uma vira um A4.
// Leva junto um retrato dos dados de entrada (sem dado pessoal), num bloco JSON identificável.

const toDataUrl = async (url: string) => {
  const blob = await (await fetch(url)).blob()
  return new Promise<string>((ok, fail) => {
    const r = new FileReader()
    r.onload = () => ok(r.result as string)
    r.onerror = () => fail(r.error)
    r.readAsDataURL(blob)
  })
}

// As regras de CSS que tocam as folhas, mais os tokens (:root), a base (*), as fontes e o @page. O
// seletor é testado sem pseudo-elementos e sem estados (:hover), para não perder ::before e afins.
function cssFor(root: HTMLElement) {
  const probe = (sel: string) => sel.split(',').some((part) => {
    const p = part.replace(/::?(before|after|marker|placeholder|selection)\b/g, '').replace(/:(hover|focus-visible|focus|active)\b/g, '').trim()
    if (p === ':root' || p === '*') return true
    try { return root.matches(p) || !!root.querySelector(p) } catch { return false }
  })
  const pick = (rule: CSSRule): string | null => {
    if (rule instanceof CSSStyleRule) return probe(rule.selectorText) ? rule.cssText : null
    if (rule instanceof CSSFontFaceRule || rule instanceof CSSPageRule) return rule.cssText
    if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule) {
      const inner = [...rule.cssRules].map(pick).filter(Boolean)
      const head = rule instanceof CSSMediaRule ? `@media ${rule.conditionText}` : `@supports ${rule.conditionText}`
      return inner.length ? `${head} {\n${inner.join('\n')}\n}` : null
    }
    return null
  }
  const out: string[] = []
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList
    try { rules = sheet.cssRules } catch { continue }
    for (const r of rules) { const k = pick(r); if (k) out.push(k) }
  }
  return out.join('\n')
}

// troca cada url(...) local do CSS pelo arquivo embutido
async function inlineUrls(css: string) {
  const urls = [...new Set([...css.matchAll(/url\((['"]?)([^'")]+)\1\)/g)].map((m) => m[2]).filter((u) => !u.startsWith('data:')))]
  const map = new Map(await Promise.all(urls.map(async (u) => [u, await toDataUrl(u).catch(() => u)] as const)))
  return css.replace(/url\((['"]?)([^'")]+)\1\)/g, (all, _q, u: string) => (map.has(u) ? `url("${map.get(u)}")` : all))
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projeto'
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export async function exportReportHtml(sheets: HTMLElement, data: { name: string; spec: unknown; checks: unknown }) {
  const clone = sheets.cloneNode(true) as HTMLElement
  clone.removeAttribute('style')
  clone.id = 'sheets'
  // imagens locais (o chapéu) viram data URI; a foto da fachada já vem assim
  await Promise.all([...clone.querySelectorAll('img')].map(async (img) => {
    const src = img.getAttribute('src')
    if (src && !src.startsWith('data:')) img.setAttribute('src', await toDataUrl(src).catch(() => src))
  }))
  const css = await inlineUrls(cssFor(sheets))
  const now = new Date()
  const when = now.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const title = data.name || 'Novo projeto'
  const snapshot = JSON.stringify({ app: 'roomi-maker', kind: 'relatorio', generated_at: now.toISOString(), name: title, spec: data.spec, checks: data.checks }, null, 2).replace(/</g, '\\u003c')
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Relatório Roomi Maker</title>
<meta name="description" content="Simulação de negócio gerada no Roomi Maker em ${esc(when)}.">
<style>
${css}
html, body { height: auto; }
body { margin: 0; overflow: auto; background: #1D1D1B; padding: 40px 24px 48px; }
.gerado { margin: 26px auto 0; max-width: 794px; text-align: center; font: 12px/1.5 'Futura New', sans-serif; color: rgba(241, 233, 231, .6); }
@media print { body { padding: 0; background: none; } .gerado { display: none; } }
@page { size: A4; margin: 0; }
</style>
</head>
<body>
${clone.outerHTML}
<p class="gerado">Gerado no Roomi Maker em ${esc(when)}. Simulação para comparar cenários, não um estudo de viabilidade. Para o PDF em A4, imprima esta página (Ctrl+P), sem margens.</p>
<script type="application/json" id="data">
${snapshot}
</script>
<script>
(function () {
  var s = document.getElementById('sheets')
  function fit() { s.style.setProperty('--s', String(Math.min(1, (window.innerWidth - 48) / 794))) }
  fit()
  window.addEventListener('resize', fit)
  window.addEventListener('beforeprint', function () { s.style.setProperty('--s', '1') })
  window.addEventListener('afterprint', fit)
})()
</script>
</body>
</html>
`
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${slug(title)}-relatorio-roomi.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
