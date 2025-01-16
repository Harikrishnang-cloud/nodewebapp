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

        orders = await Order.find(dateFilter).populate('userId', 'name email')
            .sort({ orderDate: -1 });

        // Calculate totals
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
        const totalDiscount = orders.reduce((sum, order) => sum + (order.discount || 0), 0);

        res.render('salesReport', {
            title: 'Sales Report',
            orders,
            totalOrders,
            totalRevenue,
            totalDiscount,
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
            .populate('userId', 'name email')
            .sort({ orderDate: -1 });

        // Format the data based on requested format
        if (format === 'csv') {
            const csvData = orders.map(order => ({
                'Order ID': order._id,
                'Date': moment(order.orderDate).format('YYYY-MM-DD HH:mm:ss'),
                'Customer': order.userId.name,
                'Discount': order.discount || 0,
                'Total Amount': order.totalAmount,
                'Status': order.status,
                'Payment Method': order.paymentMethod
            }));

            // Convert to CSV
            const fields = ['Order ID', 'Date', 'Customer', 'Discount', 'Total Amount', 'Status', 'Payment Method'];
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

        // Add content to PDF
        doc.fontSize(20).text('Sales Report', { align: 'center' });
        doc.moveDown();

        orders.forEach(order => {
            doc.fontSize(12).text(`Order ID: ${order._id}`);
            doc.fontSize(10)
                .text(`Date: ${moment(order.orderDate).format('YYYY-MM-DD HH:mm:ss')}`)
                .text(`Customer: ${order.userId.name}`)
                .text(`Discount: ${order.discount || 0}`)
                .text(`Total Amount: ${order.totalAmount}`)
                .text(`Status: ${order.status}`)
                .text(`Payment Method: ${order.paymentMethod}`);
            doc.moveDown();
        });

        doc.end();

    } catch (error) {
        console.error('Error downloading sales report:', error);
        res.status(500).json({ error: 'Failed to download sales report' });
    }
};

module.exports = {
    getSalesReport,
    downloadSalesReport
};
