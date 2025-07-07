/*
 * Copyright (c) 2016-present, Parse, LLC
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */
import PropTypes from 'lib/PropTypes';
import React, { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import styles from './ChartVisualization.scss';

// Register necessary Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

const ChartVisualization = ({
  selectedData,
  selectedCells,
  data,
  order,
  columns
}) => {
  const [chartType, setChartType] = useState('bar');

  // Processar dados selecionados para determinar o tipo de visualização
  const chartData = useMemo(() => {
    // More rigorous initial validation
    if (!selectedData || selectedData.length === 0 || !selectedCells || !data || !Array.isArray(data)) {
      return null;
    }

    const { rowStart, rowEnd, colStart, colEnd } = selectedCells;

    // Verificar se temos dados válidos e se os índices são válidos
    if (rowStart === -1 || colStart === -1 || rowEnd >= data.length || rowStart < 0) {
      return null;
    }

    // Verificar se todos os índices de linha são válidos
    for (let rowIndex = rowStart; rowIndex <= rowEnd; rowIndex++) {
      if (!data[rowIndex] || !data[rowIndex].attributes) {
        return null; // Dados inconsistentes, abortar
      }
    }

    // Determinar se é time series de forma mais rigorosa
    // Time series se: temos múltiplas colunas E pelo menos uma coluna é data
    let isTimeSeries = false;
    let dateColumnName = null;
    let dateColumnIndex = -1;

    // Procurar por qualquer coluna de data na seleção (não apenas a primeira)
    if (colEnd > colStart && columns) {
      for (let colIndex = colStart; colIndex <= colEnd; colIndex++) {
        const columnName = order[colIndex]?.name;
        if (!columnName) {
          continue;
        }

        // Verificar o tipo da coluna no schema
        const columnType = columns[columnName]?.type;
        const isDateColumn = columnType === 'Date' ||
                            /^(date|time|created|updated|when|at)$/i.test(columnName) ||
                            columnName.toLowerCase().includes('date') ||
                            columnName.toLowerCase().includes('time');

        if (isDateColumn) {
          // Verificar se a coluna contém realmente datas válidas
          let dateCount = 0;
          const totalRows = Math.min(3, rowEnd - rowStart + 1); // Verificar até 3 linhas

          for (let rowIndex = rowStart; rowIndex < rowStart + totalRows; rowIndex++) {
            // Verificar se o índice é válido antes de acessar
            if (rowIndex >= data.length || !data[rowIndex] || !data[rowIndex].attributes) {
              continue;
            }
            const value = data[rowIndex].attributes[columnName];
            if (value instanceof Date ||
                (typeof value === 'string' && !isNaN(Date.parse(value)) && new Date(value).getFullYear() > 1900)) {
              dateCount++;
            }
          }

          if (dateCount >= totalRows * 0.6) { // 60% devem ser datas válidas
            isTimeSeries = true;
            dateColumnName = columnName;
            dateColumnIndex = colIndex;
            break; // Encontrou uma coluna de data válida
          }
        }
      }
    }

    if (isTimeSeries && colEnd > colStart) {
      // Time Series: usar a coluna de data encontrada, outras são números
      const datasets = [];
      let datasetIndex = 0;

      // Criar um dataset para cada coluna numérica (exceto a coluna de data)
      for (let colIndex = colStart; colIndex <= colEnd; colIndex++) {
        // Pular a coluna de data
        if (colIndex === dateColumnIndex) {
          continue;
        }

        const columnName = order[colIndex]?.name;
        if (!columnName) {
          continue;
        }

        const dataPoints = [];

        for (let rowIndex = rowStart; rowIndex <= rowEnd; rowIndex++) {
          // Verificar se o índice é válido
          if (rowIndex >= data.length || !data[rowIndex] || !data[rowIndex].attributes) {
            continue;
          }
          const timeValue = data[rowIndex].attributes[dateColumnName];
          const numericValue = data[rowIndex].attributes[columnName];

          if (timeValue && typeof numericValue === 'number' && !isNaN(numericValue)) {
            dataPoints.push({
              x: new Date(timeValue),
              y: numericValue
            });
          }
        }

        if (dataPoints.length > 0) {
          datasets.push({
            label: columnName,
            data: dataPoints,
            borderColor: `hsl(${datasetIndex * 60}, 70%, 50%)`,
            backgroundColor: `hsla(${datasetIndex * 60}, 70%, 50%, 0.1)`,
            tension: 0.1
          });
          datasetIndex++;
        }
      }

      return {
        type: 'timeSeries',
        datasets,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              type: 'time',
              time: {
                displayFormats: {
                  day: 'MMM dd',
                  hour: 'HH:mm'
                }
              },
              title: {
                display: true,
                text: dateColumnName
              }
            },
            y: {
              title: {
                display: true,
                text: 'Value'
              }
            }
          },
          plugins: {
            title: {
              display: true,
              text: 'Time Series Visualization'
            },
            legend: {
              display: datasets.length > 1
            }
          }
        }
      };
    } else {
      // Number Series: apenas valores numéricos
      const labels = [];
      const dataPoints = [];

      // Se múltiplas colunas, criar datasets separados para cada coluna
      if (colEnd > colStart) {
        // FIX: Instead of calculating averages, show all values
        const datasets = [];

        for (let colIndex = colStart; colIndex <= colEnd; colIndex++) {
          const columnName = order[colIndex]?.name;
          if (!columnName) {
            continue;
          }

          // Coletar todos os valores desta coluna
          const columnValues = [];
          const columnLabels = [];

          for (let rowIndex = rowStart; rowIndex <= rowEnd; rowIndex++) {
            // Verificar se o índice é válido
            if (rowIndex >= data.length || !data[rowIndex] || !data[rowIndex].attributes) {
              continue;
            }
            const value = data[rowIndex].attributes[columnName];
            if (typeof value === 'number' && !isNaN(value)) {
              columnValues.push(value);
              columnLabels.push(`Row ${rowIndex + 1}`);
            }
          }

          if (columnValues.length > 0) {
            datasets.push({
              label: columnName,
              data: columnValues,
              backgroundColor: `hsla(${(colIndex - colStart) * 60}, 70%, 60%, 0.8)`,
              borderColor: `hsl(${(colIndex - colStart) * 60}, 70%, 50%)`,
              borderWidth: 2,
              borderRadius: chartType === 'bar' ? 4 : 0,
              tension: chartType === 'line' ? 0.4 : 0
            });
          }
        }

        // Usar os labels da primeira coluna (todas devem ter o mesmo número de linhas)
        for (let rowIndex = rowStart; rowIndex <= rowEnd; rowIndex++) {
          labels.push(`Row ${rowIndex + 1}`);
        }

        return {
          type: 'numberSeries',
          data: {
            labels,
            datasets
          },
          options: {
            // ...manter as opções existentes...
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              intersect: false,
            },
            plugins: {
              title: {
                display: true,
                text: 'Selected Data Visualization',
                font: { size: 16, weight: 'bold' },
                color: '#333'
              },
              legend: {
                display: datasets.length > 1 // Mostrar legenda se múltiplas colunas
              },
              tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#fff',
                bodyColor: '#fff',
                borderColor: '#169cee',
                borderWidth: 1
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                title: { display: true, text: 'Value', font: { size: 14, weight: 'bold' }, color: '#555' },
                grid: { color: 'rgba(0, 0, 0, 0.1)' },
                ticks: { color: '#666' }
              },
              x: {
                title: { display: true, text: 'Categories', font: { size: 14, weight: 'bold' }, color: '#555' },
                grid: { color: 'rgba(0, 0, 0, 0.1)' },
                ticks: { color: '#666' }
              }
            }
          }
        };
      } else {
        // Single column: use row indices as labels (KEEP AS IS)
        const columnName = order[colStart]?.name;
        if (columnName) {
          for (let rowIndex = rowStart; rowIndex <= rowEnd; rowIndex++) {
            // Verificar se o índice é válido
            if (rowIndex >= data.length || !data[rowIndex] || !data[rowIndex].attributes) {
              continue;
            }
            labels.push(`Row ${rowIndex + 1}`);
            const value = data[rowIndex].attributes[columnName];
            dataPoints.push(typeof value === 'number' && !isNaN(value) ? value : 0);
          }
        }

        if (labels.length === 0 || dataPoints.length === 0) {
          return null;
        }

        return {
          type: 'numberSeries',
          data: {
            labels,
            datasets: [{
              label: 'Selected Values',
              data: dataPoints,
              backgroundColor: chartType === 'bar'
                ? dataPoints.map((_, index) => `hsla(${index * 360 / dataPoints.length}, 70%, 60%, 0.8)`)
                : 'rgba(22, 156, 238, 0.7)',
              borderColor: chartType === 'bar'
                ? dataPoints.map((_, index) => `hsl(${index * 360 / dataPoints.length}, 70%, 50%)`)
                : 'rgba(22, 156, 238, 1)',
              borderWidth: 2,
              borderRadius: chartType === 'bar' ? 4 : 0,
              tension: chartType === 'line' ? 0.4 : 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              intersect: false,
            },
            plugins: {
              title: {
                display: true,
                text: 'Selected Data Visualization',
                font: { size: 16, weight: 'bold' },
                color: '#333'
              },
              legend: {
                display: false // Single column doesn't need legend
              },
              tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#fff',
                bodyColor: '#fff',
                borderColor: '#169cee',
                borderWidth: 1
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                title: { display: true, text: 'Value', font: { size: 14, weight: 'bold' }, color: '#555' },
                grid: { color: 'rgba(0, 0, 0, 0.1)' },
                ticks: { color: '#666' }
              },
              x: {
                title: { display: true, text: 'Categories', font: { size: 14, weight: 'bold' }, color: '#555' },
                grid: { color: 'rgba(0, 0, 0, 0.1)' },
                ticks: { color: '#666' }
              }
            }
          }
        };
      }
    }
  }, [selectedData, selectedCells, data, order, columns]);

  const renderChart = () => {
    // Safety check to prevent crashes
    if (!chartData) {
      return null;
    }

    if (chartData.type === 'timeSeries') {
      return (
        <Line
          data={{ datasets: chartData.datasets }}
          options={chartData.options}
        />
      );
    } else {
      // For number series, support bar, line and pie charts
      if (chartType === 'pie') {
        // For pie chart, verify if we have valid data
        const values = chartData.data.datasets[0].data;
        const labels = chartData.data.labels;

        // Filter valid values (> 0) for pie chart
        const validData = [];
        const validLabels = [];
        const validColors = [];

        values.forEach((value, index) => {
          if (value && value > 0) {
            validData.push(value);
            validLabels.push(labels[index]);
            validColors.push(`hsl(${index * 360 / values.length}, 75%, 65%)`);
          }
        });

        if (validData.length === 0) {
          return <div className={styles.noData}><p>No positive values for pie chart</p></div>;
        }

        const pieData = {
          labels: validLabels,
          datasets: [{
            label: 'Values',
            data: validData,
            backgroundColor: validColors,
            borderColor: validColors.map(color => color.replace('60%', '40%')),
            borderWidth: 1
          }]
        };

        const pieOptions = {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Data Distribution',
              font: {
                size: 16,
                weight: 'bold'
              },
              color: '#333'
            },
            legend: {
              display: true,
              position: 'right',
              labels: {
                padding: 20,
                usePointStyle: true,
                font: {
                  size: 12
                }
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#fff',
              bodyColor: '#fff',
              borderColor: '#169cee',
              borderWidth: 1,
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.parsed;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = Math.round((value / total) * 100);
                  return `${label}: ${value} (${percentage}%)`;
                }
              }
            }
          }
        };

        return (
          <Pie
            data={pieData}
            options={pieOptions}
          />
        );
      } else {
        // Bar ou Line Chart
        const ChartComponent = chartType === 'bar' ? Bar : Line;

        // Melhorar as opções para dimensionamento correto
        const enhancedOptions = {
          ...chartData.options,
          responsive: true,
          maintainAspectRatio: false,
          aspectRatio: 1.6,
          layout: {
            padding: {
              top: 20,
              right: 20,
              bottom: 20,
              left: 20
            }
          },
          elements: {
            bar: {
              borderRadius: 4,
              borderWidth: 0
            },
            line: {
              borderWidth: 3,
              tension: 0.4
            },
            point: {
              radius: 5,
              borderWidth: 2,
              hoverRadius: 7
            }
          },
          plugins: {
            ...chartData.options.plugins,
            legend: {
              display: false
            },
            title: {
              display: true,
              text: 'Selected Data Visualization',
              position: 'top',
              align: 'center',
              font: {
                size: 16,
                weight: 'bold'
              },
              color: '#333',
              padding: {
                top: 10,
                bottom: 20
              }
            },
            tooltip: {
              enabled: true,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#fff',
              bodyColor: '#fff',
              borderColor: '#169cee',
              borderWidth: 1,
              cornerRadius: 6,
              displayColors: true
            }
          },
          scales: {
            ...chartData.options.scales,
            x: {
              ...chartData.options.scales.x,
              grid: {
                display: true,
                color: 'rgba(0, 0, 0, 0.1)'
              },
              ticks: {
                maxRotation: 45,
                minRotation: 0,
                font: {
                  size: 12
                }
              }
            },
            y: {
              ...chartData.options.scales.y,
              grid: {
                display: true,
                color: 'rgba(0, 0, 0, 0.1)'
              },
              ticks: {
                font: {
                  size: 12
                }
              }
            }
          }
        };

        return (
          <ChartComponent
            data={chartData.data}
            options={enhancedOptions}
          />
        );
      }
    }
  };

  // Add null check to prevent runtime errors
  if (!chartData) {
    return (
      <div className={styles.chartVisualization}>
        <div className={styles.noData}>
          <p>No valid data selected for charting.</p>
          <p>Please select numeric or date columns to visualize.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chartVisualization}>
      <div className={styles.chartControls}>
        {chartData.type === 'numberSeries' && (
          <div className={styles.chartTypeSelector}>
            <label>Chart Type:</label>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              className={styles.select}
            >
              <option value="bar">Bar Chart</option>
              <option value="line">Line Chart</option>
              <option value="pie">Pie Chart</option>
            </select>
          </div>
        )}
        <div className={styles.chartInfo}>
          {chartData.type === 'timeSeries' ? 'Time Series' : 'Number Series'} |
          {selectedData.length} values selected
        </div>
      </div>
      <div className={styles.chartContainer}>
        {renderChart()}
      </div>
    </div>
  );
};

ChartVisualization.propTypes = {
  selectedData: PropTypes.array.isRequired,
  selectedCells: PropTypes.shape({
    list: PropTypes.instanceOf(Set),
    rowStart: PropTypes.number.isRequired,
    rowEnd: PropTypes.number.isRequired,
    colStart: PropTypes.number.isRequired,
    colEnd: PropTypes.number.isRequired,
  }).isRequired,
  data: PropTypes.array.isRequired,
  order: PropTypes.array.isRequired,
  columns: PropTypes.object.isRequired
};

export default ChartVisualization;
