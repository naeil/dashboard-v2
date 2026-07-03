'use client';

import { useState, useEffect, useCallback } from 'react';

const API_BASE = 'https://highfree-event-api.onrender.com';
const ADMIN_PASSWORD = 'hf2026admin';

interface Participant {
    id: number;
    phoneNumber: string;
    points: number;
    couponCode: string;
    marketingAgree: boolean;
    joinedAt: string;
}

export default function AdminPage() {
    const [authed, setAuthed] = useState(false);
    const [pw, setPw] = useState('');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState('');

  const fetchData = useCallback(async () => {
        setLoading(true);
        try {
                const [pRes, sRes] = await Promise.all([
                          fetch(`${API_BASE}/api/admin/participants`),
                          fetch(`${API_BASE}/api/admin/summary`),
                        ]);
                const pData = await pRes.json();
                const sData = await sRes.json();
                setParticipants(pData);
                setSummary(sData);
                setLastUpdated(new Date().toLocaleTimeString('ko-KR'));
        } catch (e) {
                console.error(e);
        } finally {
                setLoading(false);
        }
  }, []);

  useEffect(() => {
        if (authed) {
                fetchData();
                const interval = setInterval(fetchData, 30000);
                return () => clearInterval(interval);
        }
  }, [authed, fetchData]);

  const handleLogin = () => {
        if (pw === ADMIN_PASSWORD) setAuthed(true);
        else alert('Wrong password');
  };

  const downloadCSV = () => {
        const header = ['No', 'Phone', 'Points', 'CouponCode', 'Marketing', 'JoinedAt'];
        const rows = participants.map((p, i) => [
                i + 1, p.phoneNumber, p.points ?? '', p.couponCode ?? '',
                p.marketingAgree ? 'Y' : 'N',
                p.joinedAt ? new Date(p.joinedAt).toLocaleString('ko-KR') : '',
              ]);
        const csv = [header, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `participants_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
  };

  if (!authed) {
        return (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#0f0f0f', color:'#fff' }}>
                          <div style={{ background:'#1a1a1a', padding:'2rem', borderRadius:'12px', width:'320px' }}>
                                      <h1 style={{ textAlign:'center', marginBottom:'1.5rem' }}>Admin Login</h1>h1>
                                      <input type="password" placeholder="Password" value={pw}
                                                    onChange={e => setPw(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                                                    style={{ width:'100%', padding:'0.75rem', borderRadius:'8px', border:'1px solid #333', background:'#2a2a2a', color:'#fff', fontSize:'1rem', boxSizing:'border-box', marginBottom:'1rem' }} />
                                      <button onClick={handleLogin}
                                                    style={{ width:'100%', padding:'0.75rem', borderRadius:'8px', background:'#22c55e', color:'#fff', border:'none', fontSize:'1rem', cursor:'pointer' }}>
                                                    Login
                                      </button>button>
                          </div>div>
                </div>div>
              );
  }

  return (
        <div style={{ minHeight:'100vh', background:'#0f0f0f', color:'#fff', padding:'2rem', fontFamily:'sans-serif' }}>
                <div style={{ maxWidth:'1200px', margin:'0 auto' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem', flexWrap:'wrap', gap:'1rem' }}>
                                      <h1 style={{ fontSize:'1.6rem', margin:0 }}>Highfree Event Admin</h1>h1>
                                      <div style={{ display:'flex', gap:'0.75rem', alignItems:'center' }}>
                                                    <span style={{ color:'#aaa', fontSize:'0.85rem' }}>Updated: {lastUpdated}</span>span>
                                                    <button onClick={fetchData} disabled={loading}
                                                                    style={{ padding:'0.5rem 1rem', borderRadius:'8px', background:'#2563eb', color:'#fff', border:'none', cursor:'pointer' }}>
                                                      {loading ? 'Loading...' : 'Refresh'}
                                                    </button>button>
                                                    <button onClick={downloadCSV}
                                                                    style={{ padding:'0.5rem 1rem', borderRadius:'8px', background:'#16a34a', color:'#fff', border:'none', cursor:'pointer' }}>
                                                                    CSV
                                                    </button>button>
                                      </div>div>
                          </div>div>

                  {summary && (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:'1rem', marginBottom:'2rem' }}>
                      {([
                                    ['QR Scans', String(summary.totalScans ?? 0)],
                                    ['Claims', String(summary.totalClaims ?? 0)],
                                    ['Total Points', `${Number(summary.totalPointsEarned ?? 0).toLocaleString()}P`],
                                    ['Customers', String(summary.totalCustomers ?? 0)],
                                    ['Conversion', `${summary.conversionRate ?? 0}%`],
                                  ] as [string, string][]).map(([label, value]) => (
                                    <div key={label} style={{ background:'#1a1a1a', borderRadius:'10px', padding:'1rem', textAlign:'center' }}>
                                                      <div style={{ color:'#aaa', fontSize:'0.8rem', marginBottom:'0.4rem' }}>{label}</div>div>
                                                      <div style={{ fontSize:'1.4rem', fontWeight:700, color:'#4ade80' }}>{value}</div>div>
                                    </div>div>
                                  ))}
                    </div>div>
                  )}

                          <div style={{ background:'#1a1a1a', borderRadius:'12px', overflow:'hidden' }}>
                                      <div style={{ padding:'1rem 1.5rem', borderBottom:'1px solid #333' }}>
                                                    <h2 style={{ margin:0, fontSize:'1rem' }}>Participants ({participants.length})</h2>h2>
                                      </div>div>
                                      <div style={{ overflowX:'auto' }}>
                                                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                                                                    <thead>
                                                                                    <tr style={{ background:'#222' }}>
                                                                                      {['#','Phone','Points','Coupon','Marketing','Joined'].map(h => (
                              <th key={h} style={{ padding:'0.7rem 1rem', textAlign:'left', color:'#888', fontSize:'0.8rem', fontWeight:600 }}>{h}</th>th>
                            ))}
                                                                                      </tr>tr>
                                                                    </thead>thead>
                                                                  <tbody>
                                                                    {participants.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding:'2rem', textAlign:'center', color:'#555' }}>No participants yet.</td>td></tr>tr>
                          ) : participants.map((p, i) => (
                            <tr key={p.id} style={{ borderBottom:'1px solid #222' }}>
                                                <td style={{ padding:'0.7rem 1rem', color:'#555' }}>{i+1}</td>td>
                                                <td style={{ padding:'0.7rem 1rem', fontFamily:'monospace' }}>{p.phoneNumber}</td>td>
                                                <td style={{ padding:'0.7rem 1rem', color:'#4ade80', fontWeight:600 }}>{p.points ? `${p.points.toLocaleString()}P` : '-'}</td>td>
                                                <td style={{ padding:'0.7rem 1rem', fontFamily:'monospace', fontSize:'0.8rem', color:'#fbbf24' }}>{p.couponCode || '-'}</td>td>
                                                <td style={{ padding:'0.7rem 1rem' }}>
                                                                      <span style={{ background: p.marketingAgree ? '#16a34a33' : '#dc262633', color: p.marketingAgree ? '#4ade80' : '#f87171', padding:'0.2rem 0.5rem', borderRadius:'4px', fontSize:'0.75rem' }}>
                                                                        {p.marketingAgree ? 'Y' : 'N'}
                                                                      </span>span>
                                                </td>td>
                                                <td style={{ padding:'0.7rem 1rem', color:'#888', fontSize:'0.8rem' }}>
                                                  {p.joinedAt ? new Date(p.joinedAt).toLocaleString('ko-KR') : '-'}
                                                </td>td>
                            </tr>tr>
                          ))}
                                                                  </tbody>tbody>
                                                    </table>table>
                                      </div>div>
                          </div>div>
                </div>div>
        </div>div>
      );
}
</thead>
