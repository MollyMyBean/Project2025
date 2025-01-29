// server/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paypal = require('@paypal/checkout-server-sdk');
const User = require('../models/User');

// PayPal environment config
function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  // For live environment => new paypal.core.LiveEnvironment(...)
  return new paypal.core.SandboxEnvironment(clientId, clientSecret);
}

function client() {
  return new paypal.core.PayPalHttpClient(environment());
}

/**
 * POST /api/payment/paypal/create-order
 * Initiate a PayPal checkout for unlocking content or subscription, etc.
 * Body: { itemName, amount, currency="USD" }
 */
router.post('/paypal/create-order', async (req, res) => {
  const { itemName, amount, currency = 'USD' } = req.body;
  if (!itemName || !amount) {
    return res.status(400).json({ status: 'error', message: 'Missing itemName or amount.' });
  }

  const request = new paypal.orders.OrdersCreateRequest();
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: currency,
          value: amount
        },
        description: itemName
      }
    ]
  });

  try {
    const order = await client().execute(request);
    const approveLink = order.result.links.find(link => link.rel === 'approve')?.href;
    return res.status(200).json({
      status: 'success',
      orderID: order.result.id,
      approveLink
    });
  } catch (err) {
    console.error('PayPal create-order error:', err);
    return res.status(500).json({ status: 'error', message: 'Error creating PayPal order.' });
  }
});

/**
 * GET /api/payment/paypal/capture-order
 * After user approves, PayPal redirects here. We'll capture the payment.
 * Query param => ?orderId=...
 */
router.get('/paypal/capture-order', async (req, res) => {
  const { orderId } = req.query;
  if (!orderId) {
    return res.status(400).send('Missing orderId param.');
  }

  const request = new paypal.orders.OrdersCaptureRequest(orderId);
  request.requestBody({});

  try {
    const capture = await client().execute(request);
    console.log('PayPal capture result:', capture.result);

    // TODO: if your flow is "unlock content" or "subscribe" => do it here
    // For example, update the DB to reflect "unlocked" or "validUntil"

    // Then redirect back to the front-end
    return res.redirect('http://localhost:3000/home');
  } catch (err) {
    console.error('PayPal capture error:', err);
    return res.status(500).send('Error capturing PayPal order.');
  }
});

module.exports = router;
