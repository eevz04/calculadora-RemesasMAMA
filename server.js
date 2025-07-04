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

// Proxy para Bybit P2P (VES/USDT)
app.post('/api/bybit-p2p', async (req, res) => {
    try {
        const fetch = (await import('node-fetch')).default;
        
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
                        side: '1',
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
                console.log(`Bybit endpoint ${endpoint} failed:`, err.message);
                continue;
            }
        }

        if (!data) {
            throw new Error('No se pudo obtener datos de Bybit');
        }

        let orders = [];
        if (data.result && data.result.items) {
            orders = data.result.items;
        } else if (data.data) {
            orders = data.data;
        } else if (data.items) {
            orders = data.items;
        }

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

// 🆕 ACTUALIZADO: Enviar a Telegram con botones clickeables
app.post('/api/send-telegram', async (req, res) => {
    try {
        const { message, botToken, chatId, keyboard } = req.body;
        
        if (!botToken || !chatId) {
            return res.status(400).json({ error: 'Bot token y chat ID son requeridos' });
        }

        const fetch = (await import('node-fetch')).default;
        
        const payload = {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
        };

        // 🆕 Agregar botones inline si se proporcionan
        if (keyboard) {
            payload.reply_markup = keyboard;
        }
        
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.ok) {
            res.json({ success: true, message: 'Mensaje enviado a Telegram', data: data });
        } else {
            res.status(400).json({ success: false, error: 'Error enviando a Telegram', details: data });
        }
        
    } catch (error) {
        console.error('Error sending to Telegram:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error sending to Telegram',
            message: error.message 
        });
    }
});

// 🆕 NUEVO: Webhook para manejar clicks en botones de Telegram
app.post('/api/telegram-webhook', async (req, res) => {
    try {
        const { callback_query } = req.body;
        
        if (callback_query) {
            const data = callback_query.data;
            const messageId = callback_query.message.message_id;
            const chatId = callback_query.message.chat.id;
            const originalText = callback_query.message.text;
            
            let status = '';
            let emoji = '';
            
            if (data.startsWith('accept_')) {
                status = 'ACEPTADA';
                emoji = '✅';
            } else if (data.startsWith('reject_')) {
                status = 'RECHAZADA';
                emoji = '❌';
            }
            
            // Actualizar el mensaje original reemplazando "PENDIENTE" con el estado final
            const updatedText = originalText.replace('⏳ PENDIENTE', `${emoji} ${status}`);
            
            const fetch = (await import('node-fetch')).default;
            
            // Editar el mensaje para mostrar el estado y quitar los botones
            await fetch(`https://api.telegram.org/bot7582146029:AAFlsM6Pvr7sz06JIayhroy6TcCy4tFQfnk/editMessageText`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    message_id: messageId,
                    text: updatedText,
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: [] } // Quitar botones
                })
            });
            
            // Responder al callback para quitar el "loading" del botón
            await fetch(`https://api.telegram.org/bot7582146029:AAFlsM6Pvr7sz06JIayhroy6TcCy4tFQfnk/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    callback_query_id: callback_query.id,
                    text: `Operación marcada como ${status}`,
                    show_alert: false
                })
            });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error en webhook:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 🆕 NUEVO: Endpoint para configurar webhook (ejecutar una sola vez)
app.get('/setup-webhook', async (req, res) => {
    try {
        const webhookUrl = `https://${req.get('host')}/api/telegram-webhook`;
        
        const fetch = (await import('node-fetch')).default;
        
        const response = await fetch(`https://api.telegram.org/bot7582146029:AAFlsM6Pvr7sz06JIayhroy6TcCy4tFQfnk/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: webhookUrl
            })
        });
        
        const result = await response.json();
        
        res.json({
            success: result.ok,
            webhook_url: webhookUrl,
            telegram_response: result
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Webhook URL will be: https://your-app.railway.app/api/telegram-webhook`);
});
