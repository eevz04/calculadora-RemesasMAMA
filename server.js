// Proxy para Binance P2P (BRL/USDT y VES/USDT)
app.post('/api/binance-p2p', async (req, res) => {
    try {
        const fetch = (await import('node-fetch')).default;
        
        // Usar parámetros del request o valores por defecto
        const requestBody = {
            fiat: req.body.fiat || 'BRL',        // 'BRL' o 'VES'
            page: req.body.page || 1,
            rows: req.body.rows || 4,
            tradeType: req.body.tradeType || 'SELL',  // 'BUY' o 'SELL'
            asset: req.body.asset || 'USDT',
            countries: req.body.countries || [],
            proMerchantAds: req.body.proMerchantAds || false,
            publisherType: req.body.publisherType || null
        };

        console.log('Petición a Binance P2P:', requestBody);
        
        const response = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Origin': 'https://p2p.binance.com'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Respuesta de Binance:', data.success ? 'Exitosa' : 'Error');
        
        res.json(data);
        
    } catch (error) {
        console.error('Error fetching Binance data:', error);
        res.status(500).json({ 
            error: 'Error fetching Binance data',
            message: error.message 
        });
    }
});
