const Wallet = require('../../models/walletSchema');
const Razorpay = require('razorpay');
const crypto = require('crypto');


const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET_KEY,
});

// Get wallet page with transactions
const getWallet = async (req, res) => {
    try {
        let wallet = await Wallet.findOne({ userId: req.session.user._id });
        
        if (!wallet) {   //wallet ellengi create cheyyanam
            wallet = await Wallet.create({
                userId: req.session.user._id,
                balance: 0,
                transactions: []
            });
        }

        res.render('wallet', {
            title: 'My Wallet',
            wallet: wallet,
            user: req.session.user,
            query: req.query
        });

    } catch (error) {
        console.error('Error fetching wallet:', error);
        res.status(500).render('error', { message: 'Failed to fetch wallet details' });
    }
};

// Create Razorpay order for adding money
const createAddMoneyOrder = async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({success: false,error: 'Please enter a valid amount'});
        }

        // Check max. limit of 1 lakh
        if (amount > 100000) {
            return res.status(400).json({success: false,error: 'Maximum amount allowed is ₹1,00,000 at a time'});
        }

        const options = {
            amount: amount * 100, 
            currency: 'INR',
            receipt: 'wallet_' + Date.now()
        };

        const order = await razorpay.orders.create(options);
        res.json({success: true,order,key: process.env.RAZORPAY_KEY_ID});
        
    } catch (error) {
        console.error('Error creating add money order:', error);
        res.status(500).json({success: false, error: 'Failed to create order'});
    }
};

// Verify payment and add money to wallet
const verifyAndAddMoney = async (req, res) => {
    try {
        const {razorpay_order_id,razorpay_payment_id,razorpay_signature,amount} = req.body;

        // Verify payment signature
        const sign = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac('sha256', process.env.RAZORPAY_SECRET_KEY)
            .update(sign)
            .digest('hex');
     console.log("razorpay_signature === expectedSign",razorpay_signature === expectedSign);
     
        if (razorpay_signature === expectedSign) {
            // Add money to wallet
            const wallet = await Wallet.findOneAndUpdate(
                { userId: req.session.user._id },
                {
                    $inc: { balance: amount },
                    $push: {
                        transactions: {
                            type: 'credit',
                            amount: amount,
                            description: 'Added money to wallet',
                            orderId: razorpay_order_id,
                            paymentId: razorpay_payment_id
                        }
                    }
                },
                { new: true, upsert: true }
            );
            console.log(wallet);
            

            res.json({success: true,message: 'Money added successfully',wallet: wallet});
        } else {
            res.status(400).json({success: false,error: 'Invalid payment signature'});
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({success: false,error: 'Failed to verify payment'});
    }
};

// Get transaction history
const getTransactions = async (req, res) => {
    try {
        const wallet = await Wallet.findOne({ userId: req.session.user._id });
        if (!wallet) {
            return res.json({ transactions: [] });
        }
         
        // Sort transactions by timestamp in descending order
        const transactions = wallet.transactions.sort((a, b) => b.timestamp - a.timestamp);
        res.json({ transactions });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({success: false,error: 'Failed to fetch transactions'});
    }
};

module.exports = {
    getWallet,
    createAddMoneyOrder,
    verifyAndAddMoney,
    getTransactions
};
