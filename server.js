// server.js
const express = require('express');
const pool = require('./db/pool');

const app = express();

app.use(express.json());
const PORT = process.env.PORT || 3000;

// A simple test route: when someone visits this URL, 
// ask the database "what time is it right now?" and send that back.
app.get('/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ success: true, dbTime: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});



app.get('/api/items/available', async (req, res) => {
    const { start, end } = req.query;

    if (!start || !end) {
        return res.status(400).json({
            success: false,
            error: 'Both start and end query parameters are required.'
        });
    }

    try {
        const result = await pool.query(
            `SELECT i.item_id, i.name, i.category, i.current_status
             FROM items i
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM rental_events re
                 WHERE re.asset_id = i.item_id
                 AND re.event_type IN ('checkout', 'extension')
                 AND tsrange(re.start_date, re.end_date) && tsrange($1, $2)
             )`,
            [start, end]
        );
        res.json({ success: true, items: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


app.get('/api/rentals/current', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                i.name AS item_name,
                u.first_name,
                u.last_name,
                re.start_date,
                re.end_date
             FROM rental_events re
             JOIN items i ON i.item_id = re.asset_id
             JOIN users u ON u.user_id = re.user_id
             WHERE re.event_type = 'checkout'
             AND NOT EXISTS (
                 SELECT 1
                 FROM rental_events returns
                 WHERE returns.rental_group_id = re.rental_group_id
                 AND returns.event_type IN ('early_return', 'late_return')
             )`
        );
        res.json({ success: true, rentals: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/rentals/overdue', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                i.name AS item_name,
                u.first_name,
                u.last_name,
                re.start_date,
                re.end_date
             FROM rental_events re
             JOIN items i ON i.item_id = re.asset_id
             JOIN users u ON u.user_id = re.user_id
             WHERE re.event_type = 'checkout'
             AND re.end_date < NOW()
             AND NOT EXISTS (
                 SELECT 1
                 FROM rental_events returns
                 WHERE returns.rental_group_id = re.rental_group_id
                 AND returns.event_type IN ('early_return', 'late_return')
             )`
        );
        res.json({ success: true, rentals: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


app.get('/api/items/:itemId/history', async (req, res) => {
    const { itemId } = req.params;

    try {
        const result = await pool.query(
            `SELECT 
                i.name,
                re.event_type,
                re.start_date,
                re.end_date,
                re.actual_return_date,
                re.condition_before,
                re.condition_after,
                re.condition_notes,
                re.fee_charged
             FROM items i
             JOIN rental_events re ON i.item_id = re.asset_id
             WHERE i.item_id = $1
             ORDER BY re.start_date DESC`,
            [itemId]
        );
        res.json({ success: true, history: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/rentals/overdue-fees', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                u.first_name,
                u.last_name,
                i.name AS item_name,
                i.replacement_value,
                re.end_date,
                EXTRACT(DAY FROM (NOW() - re.end_date)) AS days_late,
                ROUND(i.replacement_value * 0.10 * EXTRACT(DAY FROM (NOW() - re.end_date)), 2) AS late_fee_owed
             FROM rental_events re
             JOIN items i ON i.item_id = re.asset_id
             JOIN users u ON u.user_id = re.user_id
             WHERE re.event_type = 'checkout'
             AND re.end_date < NOW()
             AND NOT EXISTS (
                 SELECT 1
                 FROM rental_events returns
                 WHERE returns.rental_group_id = re.rental_group_id
                 AND returns.event_type IN ('early_return', 'late_return')
             )`
        );
        res.json({ success: true, fees: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// This handles checkout, returns, and extensions. It uses the rental_group_id to link
// events together, which is key for tracking extensions and returns correctly.
app.post('/api/rentals', async (req, res) => {
    const { asset_id, user_id, end_date, staff_id } = req.body;

    if (!asset_id || !user_id || !end_date) {
        return res.status(400).json({
            success: false,
            error: 'asset_id, user_id, and end_date are required.'
        });
    }

    const assetCheck = await pool.query(
        'SELECT asset_id FROM rentable_assets WHERE asset_id = $1',
        [asset_id]
    );

    if (assetCheck.rows.length === 0) {
        return res.status(404).json({
            success: false,
            error: `No asset found with id ${asset_id}.`
        });
    }

    const userCheck = await pool.query(
        'SELECT user_id FROM users WHERE user_id = $1',
        [user_id]
    );

    if (userCheck.rows.length === 0) {
        return res.status(404).json({
            success: false,
            error: `No user found with id ${user_id}.`
        });
    }

    const itemCheck = await pool.query(
        'SELECT requires_payment FROM items WHERE item_id = $1',
        [asset_id]
    );

    if (itemCheck.rows.length > 0 && itemCheck.rows[0].requires_payment === true) {
        const paymentCheck = await pool.query(
            'SELECT stripe_customer_id FROM users WHERE user_id = $1',
            [user_id]
        );

        if (paymentCheck.rows[0].stripe_customer_id === null) {
            return res.status(402).json({
                success: false,
                error: 'This item requires a payment method on file.'
            });
        }
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Generate a shared ID to tie this checkout to any future 
        // extensions/returns. Using the current timestamp + random digits 
        // keeps it simple for now — good enough for this project's scale.
        const rentalGroupId = Date.now();

        // Write #1: create the checkout event itself.
        // start_date uses NOW() — the server decides "right now," not the client.
        const insertEvent = await client.query(
            `INSERT INTO rental_events 
                (rental_group_id, asset_id, user_id, staff_id, event_type, start_date, end_date)
             VALUES ($1, $2, $3, $4, 'checkout', NOW(), $5)
             RETURNING event_id`,
            [rentalGroupId, asset_id, user_id, staff_id || null, end_date]
        );


        await client.query(
            `UPDATE items SET current_status = 'checked_out' WHERE item_id = $1`,
            [asset_id]
        );

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            event_id: insertEvent.rows[0].event_id,
            rental_group_id: rentalGroupId
        });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(409).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});


app.post('/api/rentals/:eventId/return', async (req, res) => {
    const { eventId } = req.params;
    const { condition_after, condition_notes } = req.body;

    const originalCheckout = await pool.query(
        `SELECT event_id, rental_group_id, asset_id 
         FROM rental_events 
         WHERE event_id = $1 
         AND event_type = 'checkout'
         AND NOT EXISTS (
             SELECT 1
             FROM rental_events returns
             WHERE returns.rental_group_id = rental_events.rental_group_id
             AND returns.event_type IN ('early_return', 'late_return')
         )`,
        [eventId]
    );

    if (originalCheckout.rows.length === 0) {
        return res.status(404).json({
            success: false,
            error: `No active (unreturned) checkout found with id ${eventId}.`
        });
    }

    const { rental_group_id, asset_id } = originalCheckout.rows[0];

    const rentalDetails = await pool.query(
        `SELECT re.end_date, i.replacement_value
         FROM rental_events re
         JOIN items i ON i.item_id = re.asset_id
         WHERE re.event_id = $1`,
        [eventId]
    );

    const { end_date, replacement_value } = rentalDetails.rows[0];

    const isLate = new Date(end_date) < new Date();

    let conditionFee = 0;
    if (condition_after === 'lightly_damaged_usable') {
        conditionFee = 10;
    } else if (condition_after === 'unusable') {
        conditionFee = replacement_value * 1.5;
    }

    let lateFee = 0;
    if (isLate) {
        const daysLate = Math.ceil((new Date() - new Date(end_date)) / (1000 * 60 * 60 * 24));
        lateFee = replacement_value * 0.10 * daysLate;
    }

    const totalFee = Math.round((conditionFee + lateFee) * 100) / 100;
    const eventType = isLate ? 'late_return' : 'early_return';

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query(
            `INSERT INTO rental_events 
                (rental_group_id, asset_id, user_id, event_type, start_date, end_date, 
                 actual_return_date, condition_after, condition_notes, fee_charged)
             SELECT rental_group_id, asset_id, user_id, $1, start_date, end_date, 
                    NOW(), $2, $3, $4
             FROM rental_events
             WHERE event_id = $5`,
            [eventType, condition_after, condition_notes || null, totalFee, eventId]
        );

        const newStatus = condition_after === 'unusable' ? 'unusable' : 'available';
        await client.query(
            `UPDATE items SET current_status = $1, current_condition = $2 WHERE item_id = $3`,
            [newStatus, condition_after, asset_id]
        );

        await client.query('COMMIT');

        res.status(200).json({
            success: true,
            event_type: eventType,
            condition_fee: conditionFee,
            late_fee: lateFee,
            total_fee: totalFee
        });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});


