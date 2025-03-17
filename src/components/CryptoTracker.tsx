import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  Chip,
  Stack,
  DialogActions,
  Button,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  ShowChart as ShowChartIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface CryptoData {
  id: string;
  rank: string;
  symbol: string;
  name: string;
  supply: string;
  maxSupply: string | null;
  marketCapUsd: string;
  volumeUsd24Hr: string;
  priceUsd: string;
  changePercent24Hr: string;
  vwap24Hr: string;
}

interface HistoricalData {
  priceUsd: string;
  time: number;
  date: string;
}

const TIME_RANGES = {
  '24H': { interval: 'm5', days: 1 },
  '7D': { interval: 'h1', days: 7 },
  '30D': { interval: 'h2', days: 30 },
  'ALL': { interval: 'd1', days: 2000 }
};

const CryptoTracker: React.FC = () => {
  const [selectedTimeRange, setSelectedTimeRange] = useState<keyof typeof TIME_RANGES>('7D');
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoData | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [chartData, setChartData] = useState<any>(null);

  const handleTimeRangeChange = async (
    event: React.MouseEvent<HTMLElement>,
    newRange: keyof typeof TIME_RANGES
  ) => {
    if (newRange !== null) {
      setSelectedTimeRange(newRange);
      if (selectedCrypto) {
        await fetchHistoricalData(selectedCrypto.id, newRange);
      }
    }
  };

  const fetchHistoricalData = async (cryptoId: string, range: keyof typeof TIME_RANGES) => {
    setLoadingHistory(true);
    try {
      const { interval, days } = TIME_RANGES[range];
      const response = await axios.get(`https://api.coincap.io/v2/assets/${cryptoId}/history`, {
        params: {
          interval,
          start: Date.now() - days * 24 * 60 * 60 * 1000,
          end: Date.now(),
        }
      });
      const data = response.data.data;
      setHistoricalData(data);
      
      setChartData({
        labels: data.map((item: HistoricalData) => 
          new Date(item.time).toLocaleDateString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: range === '24H' ? 'numeric' : undefined
          })
        ),
        datasets: [
          {
            label: '價格 (USD)',
            data: data.map((item: HistoricalData) => parseFloat(item.priceUsd)),
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1,
          }
        ]
      });
    } catch (error) {
      console.error('獲取歷史數據失敗:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <Box>
      <Dialog
        open={!!selectedCrypto}
        onClose={() => setSelectedCrypto(null)}
        maxWidth="md"
        fullWidth
      >
        {selectedCrypto && (
          <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">
                {selectedCrypto.name} ({selectedCrypto.symbol})
              </Typography>
              <IconButton onClick={() => setSelectedCrypto(null)}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <Stack spacing={3}>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      價格走勢
                    </Typography>
                    <ToggleButtonGroup
                      value={selectedTimeRange}
                      exclusive
                      onChange={handleTimeRangeChange}
                      size="small"
                    >
                      {Object.keys(TIME_RANGES).map((range) => (
                        <ToggleButton key={range} value={range}>
                          {range}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Box>
                  {loadingHistory ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                      <CircularProgress />
                    </Box>
                  ) : chartData ? (
                    <Box sx={{ height: 300 }}>
                      <Line
                        data={chartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              position: 'top' as const,
                            },
                          },
                          scales: {
                            y: {
                              beginAtZero: false,
                            }
                          }
                        }}
                      />
                    </Box>
                  ) : (
                    <Typography color="error">
                      無法加載價格數據
                    </Typography>
                  )}
                </Box>
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default CryptoTracker; 