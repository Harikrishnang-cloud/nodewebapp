const Product = require('../../models/productSchema');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const User = require('../../models/userSchema'); 

const getPlaceOrderPage = async (req, res) => {
    try {
        // Check if user is logged in
        if (!req.session.user || !req.session.user._id) {
            return res.redirect('/login'); // Redirect to login if not logged in
        }

        const cart = await Cart.findOne({ userId: req.session.user._id }).populate('books.product');
        const cartItems = cart ? cart.books : [];
        const user = await User.findById(req.session.user._id);
        
        if (!user) {
            return res.redirect('/login'); // Redirect if user not found in database
        }

        console.log("User data:", user); // Debug log
        
        res.render('placeOrder', { 
            products: cartItems.map(item => ({
                ...item.product.toObject(),
                quantity: item.quantity
            })),
            // user: {
            //     name: user.name || '',
            //     mobile: user.mobile || '',
            //     address: user.address || '',
            //     pincode: user.pincode || ''
            // },
            user:req.session.user,
            title: 'Place Order'  
        });
    } catch (error) {
        console.error('Error fetching cart items:', error);
        res.status(500).send('Internal Server Error');
    }
};

const placeOrder = async (req, res) => {
    try {
        console.log(req.body);
        const { items, addressIndex, paymentMethod } = req.body;
        const userId = req.session.user._id;
        const user = await User.findById(userId);

        if (!user || !user.address || !user.address[addressIndex]) {
            return res.status(400).json({ message: 'Invalid address selected' });
        }

        const selectedAddress = user.address[addressIndex];
        console.log("ADdress", selectedAddress)
        selectedAddress.country = "India"
        // Fetch product details and calculate total
        let totalAmount = 40; // Base delivery fee
        const orderItems = [];

        for (const item of JSON.parse(items)) {
            const product = await Product.findById(item.productId);
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            orderItems.push({
                product: item.productId,
                productName: product.productName,
                productDescription: product.description,    
                productImage: product.productImage[0],
                quantity: item.quantity,
                price: product.salePrice
            });

            totalAmount = totalAmount + (product.salePrice * item.quantity);
        }
        console.log("orderItems",orderItems)
        // Create new order with payment method
        const newOrder = new Order({
            userId: userId,
            items: orderItems,
            totalAmount,
            status: 'Pending',
            deliveryFee: 40,
            orderDate: new Date(),
            address: selectedAddress,
            paymentMethod: paymentMethod
        });

        await newOrder.save();
        
        // Clear the user's cart after successful order
        await Cart.findOneAndUpdate(
            { userId: userId },
            { $set: { books: [] } }
        );

        // Redirect to order confirmation page
        res.status(200).json({
            success: true,
            message: 'Order placed successfully',
            orderId: newOrder._id
        });

    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({ error: 'Failed to place order' });
    }
};

const getOrderConfirmation = async (req, res) => {
    try {
        console.log("order confirm controller hit")
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)

            .populate('userId', 'name email');

        if (!order) {
            return res.redirect('/pageNotFound');
        }

        res.render('orderConfirm', {
            title: 'Order Confirmation',
            order: order
        });
    } catch (error) {
        console.error('Error fetching order confirmation:', error);
        res.status(500).send('Internal Server Error');
    }
};

module.exports = {
    getPlaceOrderPage,
    placeOrder,
    getOrderConfirmation
};
