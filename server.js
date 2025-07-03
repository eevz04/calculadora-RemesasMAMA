const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Servir el HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Proxy para Bybit P2P
app.post('/api/bybit-p2p', async (req, res) => {
    try {
        const fetch = (await import('node-fetch')).default;
        
        // Intentar varios endpoints posibles de Bybit
        const endpoints = [
            'https://api2.bybit.com/fiat/otc/item/online',
            'https://api.bybit.com/fiat/otc/item/online',
            'https://www.bybit.com/fiat/otc/item/online'
        ];
        
        let response;
        let data;
        
        for (const endpoint of endpoints) {
            try {
                response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'application/json',
                        'Origin': 'https://www.bybit.com',
                        'Referer': 'https://www.bybit.com/fiat/trade/otc/'
                    },
                    body: JSON.stringify({
                        tokenId: 'USDT',
                        currencyId: 'VES',
                        side: '1', // 1=Buy orders
                        size: '10',
                        page: '1'
                    })
                });

                if (response.ok) {
                    data = await response.json();
                    if (data && (data.result || data.data || data.items)) {
                        break;
                    }
                }
            } catch (err) {
                console.log(`Endpoint ${endpoint} failed:`, err.message);
                continue;
            }
        }

        if (!data) {
            throw new Error('No se pudo obtener datos de ningún endpoint de Bybit');
        }

        // Procesar respuesta
        let orders = [];
        if (data.result && data.result.items) {
            orders = data.result.items;
        } else if (data.data) {
            orders = data.data;
        } else if (data.items) {
            orders = data.items;
        }

        // Transformar a formato compatible
        const transformedData = {
            success: true,
            data: orders.slice(0, 4).map(order => ({
                adv: {
                    price: order.price || order.unitPrice || order.rate,
                    surplusAmount: order.quantity || order.amount || order.availableAmount || '100'
                }
            }))
        };

        res.json(transformedData);
        
    } catch (error) {
        console.error('Error fetching Bybit data:', error);
        res.status(500).json({ 
            error: 'Error fetching Bybit data',
            message: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
