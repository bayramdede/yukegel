'use client'

import { useState, useCallback } from 'react'

const CONCURRENCY = 4

export default function ReprocessWidget() {
  const [ids, setIds]           = useState<string[]>([])
  const [count, setCount]       = useState<number | null>(null)
  const [running, setRunning]   = useState(false)
  const [done, setDone]         = useState(0)
  const [total, setTotal]       = useState(0)
  const [ok, setOk]             = useState(0)
  const [still, setStill]       = useState(0)
  const [errors, setErrors]     = useState(0)
  const [finished, setFinished] = useState(false)

  const fetchIds = useCallback(async () => {
    const res = await fetch('/api/admin/reprocess-no-lane')
    const json = await res.json()
    const list: string[] = json.ids ?? []
    setIds(list)
    setCount(list.length)
    return list
  }, [])

  const processOne = async (id: string): Promise<'ok' | 'no_lane' | 'error'> => {
    try {
      const res = await fetch('/api/admin/reprocess-no-lane', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_post_id: id }),
      })
      const json = await res.json()
      if (!res.ok) return 'error'
      return (json.lanes ?? 0) > 0 ? 'ok' : 'no_lane'
    } catch {
      return 'error'
    }
  }

  const start = async () => {
    setRunning(true)
    setFinished(false)
    setDone(0); setOk(0); setStill(0); setErrors(0)

    const list = ids.length > 0 ? ids : await fetchIds()
    setTotal(list.length)
    if (list.length === 0) { setRunning(false); setFinished(true); return }

    let doneN = 0, okN = 0, stillN = 0, errorsN = 0

    for (let i = 0; i < list.length; i += CONCURRENCY) {
      const batch = list.slice(i, i + CONCURRENCY)
      const results = await Promise.all(batch.map(id => processOne(id)))
      for (const r of results) {
        doneN++
        if (r === 'ok') okN++
        else if (r === 'no_lane') stillN++
        else errorsN++
      }
      setDone(doneN); setOk(okN); setStill(stillN); setErrors(errorsN)
    }

    setRunning(false)
    setFinished(true)
    setCount(stillN)
    setIds([])
  }

  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div style={{
      background: '#161b22',
      border: '1px solid #30363d',
      borderRadius: 10,
      padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <span style={{ fontSize: '1.8rem' }}>🔄</span>
        <div>
          <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem' }}>
            WhatsApp — no_lane Yeniden İşle
          </div>
          <div style={{ color: '#8b949e', fontSize: '0.82rem', marginTop: 2 }}>
            Şehir tespit edilemeyen mesajları tekrar parse et
          </div>
        </div>
      </div>

      {count !== null && !running && (
        <div style={{ marginBottom: 12, color: count === 0 ? '#22c55e' : '#f59e0b', fontSize: '0.88rem' }}>
          {count === 0
            ? '✅ Bekleyen no_lane kaydı yok'
            : `⚠️ ${count} adet no_lane kayıt bekliyor`}
        </div>
      )}

      {running && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.82rem', color: '#8b949e' }}>
            <span>{done}/{total} işlendi (%{pct})</span>
            <span>✅ {ok} &nbsp;⏭️ {still} &nbsp;❌ {errors}</span>
          </div>
          <div style={{ background: '#0d1117', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{ background: '#22c55e', height: '100%', width: `${pct}%`, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {finished && !running && (
        <div style={{ marginBottom: 14, fontSize: '0.85rem', color: '#8b949e' }}>
          <span style={{ color: '#22c55e' }}>✅ {ok} ilan oluşturuldu</span>
          {' · '}
          <span>⏭️ {still} hâlâ no_lane</span>
          {errors > 0 && <><span>{' · '}</span><span style={{ color: '#f87171' }}>❌ {errors} hata</span></>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!running && count === null && (
          <button onClick={fetchIds} style={btnStyle('#1e3a5f', '#60a5fa')}>
            Sayımı Getir
          </button>
        )}
        {!running && count !== null && count > 0 && (
          <button onClick={start} style={btnStyle('#14532d', '#22c55e')}>
            {finished ? '🔄 Tekrar Çalıştır' : '▶ Başlat'}
          </button>
        )}
        {running && (
          <button disabled style={{ ...btnStyle('#161b22', '#8b949e'), cursor: 'not-allowed', opacity: 0.6 }}>
            ⏳ İşleniyor...
          </button>
        )}
        {!running && count !== null && (
          <button onClick={fetchIds} style={btnStyle('#1e3a5f', '#60a5fa')}>
            🔃 Yenile
          </button>
        )}
      </div>
    </div>
  )
}

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    background: bg,
    color,
    border: `1px solid ${color}40`,
    borderRadius: 6,
    padding: '7px 14px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  }
}
