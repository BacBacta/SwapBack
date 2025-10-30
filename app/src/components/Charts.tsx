"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import type { ChartOptions, TooltipItem } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface VolumeChartProps {
  data: {
    labels: string[];
    volumes: number[];
  };
}

export const VolumeChart = ({ data }: VolumeChartProps) => {
  const chartData = {
    labels: data.labels,
    datasets: [
      {
        label: 'Volume ($)',
        data: data.volumes,
        borderColor: '#9945FF',
        backgroundColor: 'rgba(153, 69, 255, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#9945FF',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(20, 20, 20, 0.9)',
        titleColor: '#fff',
        bodyColor: '#9945FF',
        borderColor: 'rgba(153, 69, 255, 0.3)',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (context: TooltipItem<'line'>) =>
            `$${context.parsed.y?.toLocaleString() ?? '0'}`,
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#9CA3AF',
          font: {
            size: 11,
          },
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#9CA3AF',
          font: {
            size: 11,
          },
          callback: (value: number | string) =>
            `$${Number(value).toLocaleString()}`,
        },
      },
    },
  };

  return <Line data={chartData} options={options} />;
};

interface ActivityChartProps {
  data: {
    labels: string[];
    swaps: number[];
  };
}

export const ActivityChart = ({ data }: ActivityChartProps) => {
  const chartData = {
    labels: data.labels,
    datasets: [
      {
        label: 'Swaps',
        data: data.swaps,
        backgroundColor: [
          'rgba(153, 69, 255, 0.8)',
          'rgba(255, 107, 157, 0.8)',
          'rgba(20, 241, 149, 0.8)',
          'rgba(153, 69, 255, 0.6)',
          'rgba(255, 107, 157, 0.6)',
          'rgba(20, 241, 149, 0.6)',
          'rgba(153, 69, 255, 0.4)',
        ],
        borderColor: [
          '#9945FF',
          '#FF6B9D',
          '#14F195',
          '#9945FF',
          '#FF6B9D',
          '#14F195',
          '#9945FF',
        ],
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(20, 20, 20, 0.9)',
        titleColor: '#fff',
        bodyColor: '#14F195',
        borderColor: 'rgba(20, 241, 149, 0.3)',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (context: TooltipItem<'bar'>) =>
            `${context.parsed.y ?? 0} swaps`,
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#9CA3AF',
          font: {
            size: 11,
          },
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#9CA3AF',
          font: {
            size: 11,
          },
          stepSize: 1,
        },
      },
    },
  };

  return <Bar data={chartData} options={options} />;
};
