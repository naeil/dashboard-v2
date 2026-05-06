import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler)

const KW = (n) => '₩' + Math.round(Number(n ?? 0)).toLocaleString('ko-KR')

export default function ProductChart({ data, loading }) {
  if (loading) return <div className="state-box"><div className="spinner" /></div>
  if (!data?.length) return <div className="state-box">데이터가 없습니다</div>

  const top8 = [...data].slice(0, 8)

  const chartData = {
    labels: top8.map((d) => d.productName.length > 14 ? d.productName.slice(0, 14) + '…' : d.productName),
    datasets: [
      {
        label: '순 매출',
        data: top8.map((d) => Math.round(Number(d.totalNetRevenue))),
        fill: true,
        borderColor: '#00385b',
        backgroundColor: 'rgba(0, 56, 91, 0.08)',
        pointBackgroundColor: '#45d8ed',
        pointBorderColor: '#00385b',
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.4,
        borderWidth: 2.5,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (ctx) => ' ' + KW(ctx.parsed.y) },
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
        ticks: { font: { family: 'Inter', size: 10 }, color: '#434652', maxRotation: 30 },
      },
      y: {
        grid: { color: 'rgba(195,198,212,0.10)' },
        ticks: {
          font: { family: 'Inter', size: 11 }, color: '#434652',
          callback: (v) => '₩' + (v / 1_000_000).toFixed(0) + 'M',
        },
      },
    },
  }

  return (
    <div className="chart-wrapper">
      <Line data={chartData} options={options} />
    </div>
  )
}
