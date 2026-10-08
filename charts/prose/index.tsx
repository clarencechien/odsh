import { defineChart, type Format } from '@open-dashboard/core'
// React escapes both query values and literal prose; never render database values as HTML.
export default defineChart<{ text: string }>({
  name: 'Prose', height: 130,
  sample: { query: 'sample', props: { text: '本期用電 {{load_kwh:integer}} kWh。' } },
  render: ({ rows, props, format }) => {
    const row = rows[0] ?? {}
    const parts = props.text.split(/(\{\{\s*\w+(?::\w+)?\s*\}\})/g)
    return <p className="odd-text" style={{ margin: 0 }}>{parts.map((part, i) => {
      const match = /^\{\{\s*(\w+)(?::(\w+))?\s*\}\}$/.exec(part)
      return match ? <strong key={i}>{row[match[1]] == null ? '—' : format(row[match[1]], match[2] as Format | undefined)}</strong> : part
    })}</p>
  },
})
