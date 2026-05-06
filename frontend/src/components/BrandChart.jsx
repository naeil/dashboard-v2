import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const KW = (n) => '₩' + Math.round(Number(n ?? 0)).toLocaleString('ko-KR')

const OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => ' ' + KW(ctx.parsed.y),
      },
      backgroundColor: '#fff',
      titleColor: '#181c1e',
      bodyColor: '#434652',
      borderColor: '#c3c6d4',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(195,198,212,0.10)' },
      ticks: { font: { family: 'Inter', size: 11 }, color: '#434652' },
    },
    y: {
      grid: { color: 'rgba(195,198,212,0.10)' },
      ticks: {
        font: { family: 'Inter', size: 11 },
        color: '#434652',
        callback: (v) => '₩' + (v / 1_000_000).toFixed(0) + 'M',
      },
    },
  },
}

export default function BrandChart({ data, loading }) {
  if (loading) return <div className="state-box"><div className="spinner" /></div>
  if (!data?.length) return <div className="state-box">데이터가 없습니다</div>

  const top10 = [...data].slice(0, 10)

  const chartData = {
    labels: top10.map((d) => d.brandName),
    datasets: [
      {
        label: '순 매출',
        data: top10.map((d) => Math.round(Number(d.totalNetRevenue))),
        backgroundColor: 'rgba(0, 56, 91, 0.75)',
        hoverBackgroundColor: '#034f7d',
        borderRadius: 6,
        borderSkipped: false,
      },
      {
        label: '총 매출',
        data: top10.map((d) => Math.round(Number(d.totalGrossAmount))),
        backgroundColor: 'rgba(0, 106, 106, 0.35)',
        hoverBackgroundColor: 'rgba(0, 106, 106, 0.6)',
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  }

  return (
    <div className="chart-wrapper">
      <Bar data={chartData} options={{ ...OPTIONS, plugins: { ...OPTIONS.plugins, legend: { display: true, labels: { font: { family: 'Inter', size: 11 }, color: '#434652' } } } }} />
    </div>
  )
}
