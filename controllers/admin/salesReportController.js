const Order = require('../../models/orderSchema');
const moment = require('moment');
const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');
const json2csv = new Parser();

// Get sales report page
const getSalesReport = async (req, res) => {
    try {
        const { period, startDate, endDate } = req.query;
        let orders;
        let dateFilter = {};

        if (period) {
            const today = moment().startOf('day');
            
            switch (period) {
                case 'daily':
                    dateFilter = {
                        orderDate: {
                            $gte: today.toDate(),
                            $lt: moment(today).endOf('day').toDate()
                        }
                    };
                    break;

                case 'weekly':
                    dateFilter = {
                        orderDate: {
                            $gte: moment(today).subtract(7, 'days').toDate(),
                            $lt: moment(today).endOf('day').toDate()
                        }
                    };
                    break;

                case 'monthly':
                    dateFilter = {
                        orderDate: {
                            $gte: moment(today).subtract(30, 'days').toDate(),
                            $lt: moment(today).endOf('day').toDate()
                        }
                    };
                    break;
                    
                case 'yearly':
                    dateFilter = {
                        orderDate: {
                            $gte: moment(today).subtract(1, 'year').toDate(),
                            $lt: moment(today).endOf('day').toDate()
                        }
                    };
                    break;
            }
        } 
        else if (startDate && endDate) {
            dateFilter = {
                orderDate: {
                    $gte: moment(startDate).startOf('day').toDate(),
                    $lt: moment(endDate).endOf('day').toDate()
                }
            };
        }

        orders = await Order.find(dateFilter).populate('userId', 'fullName email')
            .sort({ orderDate: -1 });

        // Calculate totals
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
        const totalDiscount = orders.reduce((sum, order) => sum + (order.discount || 0), 0);
        const totalCouponDiscount = orders.reduce((sum, order) => sum + (order.couponDiscount || 0), 0);
        const grossAmount = orders.reduce((sum, order) => sum + order.totalAmount + (order.discount || 0) + (order.couponDiscount || 0), 0);

        res.render('salesReport', {
            title: 'Sales Report',
            orders,
            totalOrders,
            totalRevenue,
            totalDiscount,
            totalCouponDiscount,
            grossAmount,
            moment,
            period: period || 'custom',
            startDate: startDate || '',
            endDate: endDate || ''
        });

    } catch (error) {
        console.error('Error generating sales report:', error);
        res.status(500).render('error', { message: 'Failed to generate sales report' });
    }
};

// Generate and download sales report
const downloadSalesReport = async (req, res) => {
    try {
        const { period, startDate, endDate, format } = req.query;
        let dateFilter = {};

        // Apply date filters similar to getSalesReport
        if (period) {
            const today = moment().startOf('day');
            switch (period) {
                case 'daily':
                    dateFilter = {
                        orderDate: {
                            $gte: today.toDate(),
                            $lt: moment(today).endOf('day').toDate()
                        }
                    };
                    break;
                case 'weekly':
                    dateFilter = {
                        orderDate: {
                            $gte: moment(today).subtract(7, 'days').toDate(),
                            $lt: moment(today).endOf('day').toDate()
                        }
                    };
                    break;
                case 'monthly':
                    dateFilter = {
                        orderDate: {
                            $gte: moment(today).subtract(30, 'days').toDate(),
                            $lt: moment(today).endOf('day').toDate()
                        }
                    };
                    break;
                case 'yearly':
                    dateFilter = {
                        orderDate: {
                            $gte: moment(today).subtract(1, 'year').toDate(),
                            $lt: moment(today).endOf('day').toDate()
                        }
                    };
                    break;
            }
        } 
        else if (startDate && endDate) {
            dateFilter = {
                orderDate: {
                    $gte: moment(startDate).startOf('day').toDate(),
                    $lt: moment(endDate).endOf('day').toDate()
                }
            };
        }

        const orders = await Order.find(dateFilter)
            .populate('userId', 'fullName email')
            .sort({ orderDate: -1 });

        if (!orders || orders.length === 0) {
            return res.status(404).json({ error: 'No orders found for the selected period' });
        }

        // Calculate totals
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
        const totalDiscount = orders.reduce((sum, order) => sum + (order.discount || 0) + (order.couponDiscount || 0), 0);

        // Format the data based on requested format
        if (format === 'csv') {
            const csvData = orders.map(order => ({
                'Order ID': order._id,
                'Date': moment(order.orderDate).format('YYYY-MM-DD HH:mm:ss'),
                'Customer': order.userId?.fullName || 'N/A',
                'Discount': order.discount || 0,
                'Coupon Discount': order.couponDiscount || 0,
                'Total Amount': order.totalAmount,
                'Status': order.status,
                'Payment Method': order.paymentMethod
            }));

            // Convert to CSV
            const fields = ['Order ID', 'Date', 'Customer', 'Discount', 'Coupon Discount', 'Total Amount', 'Status', 'Payment Method'];
            const csv = json2csv.parse(csvData, { fields });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=sales-report-${moment().format('YYYY-MM-DD')}.csv`);
            return res.send(csv);
        }

        // Default to PDF if format not specified or not CSV
        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=sales-report-${moment().format('YYYY-MM-DD')}.pdf`);

        doc.pipe(res);

        // Add header to PDF
        doc.fontSize(20).text('Sales Report', { align: 'center' });
        doc.moveDown();

        // Add summary
        doc.fontSize(14).text('Summary', { underline: true });
        doc.fontSize(12)
            .text(`Report Period: ${period || 'Custom Range'}`)
            .text(`Total Orders: ${totalOrders}`)
            .text(`Total Revenue: ₹${totalRevenue.toFixed(2)}`)
            .text(`Total Discounts: ₹${totalDiscount.toFixed(2)}`);
        doc.moveDown();

        // Add orders table header
        doc.fontSize(14).text('Order Details', { underline: true });
        doc.moveDown();

        // Add each order
        orders.forEach((order, index) => {
            doc.fontSize(12).text(`Order ${index + 1}:`, { underline: true });
            doc.fontSize(10)
                .text(`Order ID: ${order._id}`)
                .text(`Date: ${moment(order.orderDate).format('YYYY-MM-DD HH:mm:ss')}`)
                .text(`Customer: ${order.userId?.fullName || 'N/A'}`)
                .text(`Discount: ₹${(order.discount || 0).toFixed(2)}`)
                .text(`Coupon Discount: ₹${(order.couponDiscount || 0).toFixed(2)}`)
                .text(`Total Amount: ₹${order.totalAmount.toFixed(2)}`)
                .text(`Status: ${order.status}`)
                .text(`Payment Method: ${order.paymentMethod}`);
            doc.moveDown();
        });

        // Add footer
        doc.fontSize(10)
            .text(`Generated on: ${moment().format('YYYY-MM-DD HH:mm:ss')}`, { align: 'right' });

        doc.end();

    } catch (error) {
        console.error('Error downloading sales report:', error);
        res.status(500).json({ error: 'Failed to download sales report. Please try again.' });
    }
};

module.exports = {
    getSalesReport,
    downloadSalesReport
};
