import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  Slider,
  CircularProgress,
  Paper,
  Avatar,
  Chip,
  Stack,
  useTheme,
  alpha,
  Pagination,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  ShowChart as ShowChartIcon,
  TrendingUp as TrendingUpIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
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
  Tooltip as ChartTooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend
);

interface CryptoData {
  id: string;
  name: string;
  symbol: string;
  priceUsd: string;
  changePercent24Hr: string;
  marketCapUsd: string;
  volumeUsd24Hr: string;
  supply: string;
  maxSupply: string;
  volumeUsd24HrChange?: string;
  potentialScore?: number;
}

interface FilterParams {
  minVolume: number;
  minMarketCap: number;
  maxMarketCap: number;
  maxResults: number;
}

const TIME_RANGES = {
  '24H': { interval: 'm5', days: 1 },
  '7D': { interval: 'h1', days: 7 },
  '30D': { interval: 'h2', days: 30 },
  'ALL': { interval: 'd1', days: 2000 }
};

const PotentialList: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [filterParams] = useState<FilterParams>({
    minVolume: 1000000,
    minMarketCap: 1000000,
    maxMarketCap: 5000000000,
    maxResults: 100
  });
  const [selectedTimeRange, setSelectedTimeRange] = useState<keyof typeof TIME_RANGES>('7D');
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoData | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [data, setData] = useState<CryptoData[]>([]);
  const [loading, setLoading] = useState(true);

  const calculatePotentialScore = (coin: CryptoData): number => {
    try {
      const marketCap = parseFloat(coin.marketCapUsd);
      const volume = parseFloat(coin.volumeUsd24Hr);
      const changePercent = parseFloat(coin.changePercent24Hr);
      const supply = parseFloat(coin.supply);
      const maxSupply = parseFloat(coin.maxSupply);

      // 市值評分 (0-30分)
      let marketCapScore = 0;
      if (marketCap >= 1000000 && marketCap <= 5000000000) {
        marketCapScore = 30 * (1 - (Math.log(marketCap) - Math.log(1000000)) / (Math.log(5000000000) - Math.log(1000000)));
      }

      // 交易量評分 (0-25分)
      let volumeScore = 0;
      if (volume > 0) {
        const volumeRatio = volume / marketCap;
        volumeScore = Math.min(25, volumeRatio * 100);
      }

      // 供應量評分 (0-20分)
      let supplyScore = 0;
      if (!isNaN(supply) && !isNaN(maxSupply) && maxSupply > 0) {
        const supplyRatio = supply / maxSupply;
        supplyScore = 20 * (1 - supplyRatio);
      }

      // 價格趨勢評分 (0-25分)
      let trendScore = 0;
      if (!isNaN(changePercent)) {
        trendScore = Math.min(25, Math.max(0, changePercent));
      }

      return Math.round(marketCapScore + volumeScore + supplyScore + trendScore);
    } catch (err) {
      console.error('計算潛力評分錯誤:', err);
      return 0;
    }
  };

  const filterData = useCallback((data: CryptoData[]) => {
    try {
      const filteredData = data
        .filter((coin: CryptoData) => {
          try {
            const volumeUsd = parseFloat(coin.volumeUsd24Hr);
            const marketCap = parseFloat(coin.marketCapUsd);
            const changePercent = parseFloat(coin.changePercent24Hr);

            const isValid = 
              coin &&
              !isNaN(volumeUsd) &&
              volumeUsd >= filterParams.minVolume &&
              !isNaN(marketCap) &&
              marketCap >= filterParams.minMarketCap &&
              marketCap <= filterParams.maxMarketCap &&
              !isNaN(changePercent);

            if (!isValid) {
              console.debug('Filtered out coin:', coin.symbol, {
                volume: volumeUsd,
                marketCap: marketCap,
                change24h: changePercent
              });
            }

            return isValid;
          } catch (err) {
            console.error('數據驗證錯誤:', err);
            return false;
          }
        })
        .map(coin => ({
          ...coin,
          potentialScore: calculatePotentialScore(coin)
        }))
        .sort((a: CryptoData, b: CryptoData) => {
          try {
            return (b.potentialScore || 0) - (a.potentialScore || 0);
          } catch (err) {
            console.error('排序錯誤:', err);
            return 0;
          }
        })
        .slice(0, filterParams.maxResults);

      if (filteredData.length === 0) {
        setError('沒有找到符合條件的數據');
      } else {
        setError(null);
      }
      
      return filteredData;
    } catch (err) {
      console.error('過濾數據錯誤:', err);
      return [];
    }
  }, [filterParams]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get('https://api.coincap.io/v2/assets');
      const filteredData = filterData(response.data.data);
      setData(filteredData);
      setError(null);
    } catch (err) {
      console.error('獲取數據錯誤:', err);
      setError('獲取數據失敗，請稍後重試');
    } finally {
      setLoading(false);
    }
  }, [filterData]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // 每分鐘更新一次
    return () => clearInterval(interval);
  }, [fetchData]);

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
      setHistoricalData(response.data.data);
    } catch (error) {
      console.error('獲取歷史數據失敗:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCryptoClick = async (crypto: CryptoData) => {
    setSelectedCrypto(crypto);
    await fetchHistoricalData(crypto.id, selectedTimeRange);
  };

  const chartData = useMemo(() => {
    if (!historicalData.length) return null;
    
    return {
      labels: historicalData.map(item => 
        new Date(item.time).toLocaleDateString('zh-CN', {
          month: 'short',
          day: 'numeric',
          hour: selectedTimeRange === '24H' ? 'numeric' : undefined
        })
      ),
      datasets: [
        {
          label: '價格 (USD)',
          data: historicalData.map(item => parseFloat(item.priceUsd)),
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1,
        }
      ]
    };
  }, [historicalData, selectedTimeRange]);

  const formatters = {
    formatNumber: (num: number) => {
      return new Intl.NumberFormat('zh-TW', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    },
    formatMarketCap: (num: number) => {
      if (num >= 1e9) {
        return `$${(num / 1e9).toFixed(2)}B`;
      }
      if (num >= 1e6) {
        return `$${(num / 1e6).toFixed(2)}M`;
      }
      return `$${num.toFixed(2)}`;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          潛力榜
        </Typography>
        <Tooltip title="刷新數據">
          <IconButton onClick={fetchData} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Typography color="error" align="center" gutterBottom>
          {error}
        </Typography>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {data.map((crypto) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={crypto.id}>
              <Paper
                onClick={() => handleCryptoClick(crypto)}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar
                    src={`https://assets.coincap.io/assets/icons/${crypto.symbol.toLowerCase()}@2x.png`}
                    alt={crypto.name}
                    sx={{ width: 32, height: 32, mr: 1 }}
                  />
                  <Box>
                    <Typography variant="subtitle1" component="div">
                      {crypto.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {crypto.symbol}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ mb: 1 }}>
                  <Typography variant="h6" component="div">
                    ${formatters.formatNumber(parseFloat(crypto.priceUsd))}
                  </Typography>
                  <Typography
                    color={parseFloat(crypto.changePercent24Hr) >= 0 ? 'success.main' : 'error.main'}
                    variant="body2"
                  >
                    {formatters.formatNumber(parseFloat(crypto.changePercent24Hr))}%
                  </Typography>
                </Box>

                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    潛力評分
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={crypto.potentialScore || 0}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.1),
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {crypto.potentialScore}/100
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog
        open={!!selectedCrypto}
        onClose={() => setSelectedCrypto(null)}
        maxWidth="md"
        fullWidth
      >
        {selectedCrypto && (
          <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar
                  src={`https://assets.coincap.io/assets/icons/${selectedCrypto.symbol.toLowerCase()}@2x.png`}
                  alt={selectedCrypto.name}
                />
                <Typography variant="h6">
                  {selectedCrypto.name} ({selectedCrypto.symbol})
                </Typography>
              </Box>
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

export default PotentialList;