const Order = require('../../models/orderSchema');
const moment = require('moment');
const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');
const XLSX = require('xlsx');
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
        const { format, period, startDate, endDate } = req.query;
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

        const orders = await Order.find({
            ...dateFilter,
            status: { $nin: ['Cancelled'] }
        }).populate('userId').populate('items.product');

        if (!orders || orders.length === 0) {
            return res.status(404).send('No orders found for the selected period');
        }

        const reportData = orders.map(order => ({
            OrderID: order._id,
            CustomerName: order.userId.name,
            OrderDate: moment(order.orderDate).format('YYYY-MM-DD'),
            Products: order.items.map(item => item.product.title).join(', '),
            Amount: order.totalAmount,
            PaymentMethod: order.paymentMethod,
            Status: order.status
        }));

        switch (format) {
            case 'pdf':
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
                    .text(`Total Orders: ${orders.length}`)
                    .text(`Total Revenue: ₹${orders.reduce((sum, order) => sum + order.totalAmount, 0).toFixed(2)}`)
                    .text(`Total Discounts: ₹${orders.reduce((sum, order) => sum + (order.discount || 0) + (order.couponDiscount || 0), 0).toFixed(2)}`);
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
                break;

            case 'csv':
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
                break;

            case 'excel':
                const workbook = XLSX.utils.book_new();
                const worksheet = XLSX.utils.json_to_sheet(reportData);

                // Add headers
                const headers = [
                    'Order ID', 'Customer Name', 'Order Date', 
                    'Products', 'Amount', 'Payment Method', 'Status'
                ];
                XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: 'A1' });

                // Style the headers
                const range = XLSX.utils.decode_range(worksheet['!ref']);
                for (let i = 0; i <= range.e.c; i++) {
                    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
                    worksheet[cellRef].s = {
                        font: { bold: true },
                        fill: { fgColor: { rgb: "CCCCCC" } }
                    };
                }

                // Auto-size columns
                const max_width = reportData.reduce((w, r) => Math.max(w, r.CustomerName.length), 10);
                worksheet['!cols'] = [ 
                    { wch: 24 }, // Order ID
                    { wch: max_width }, // Customer Name
                    { wch: 12 }, // Order Date
                    { wch: 40 }, // Products
                    { wch: 10 }, // Amount
                    { wch: 15 }, // Payment Method
                    { wch: 12 }  // Status
                ];

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Report');

                // Set the response headers
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename=sales_report_${moment().format('YYYY-MM-DD')}.xlsx`);

                // Write to response
                const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
                res.send(excelBuffer);
                break;

            default:
                res.status(400).send('Invalid format specified');
        }
    } catch (error) {
        console.error('Error generating sales report:', error);
        res.status(500).send('Error generating sales report');
    }
};

module.exports = {
    getSalesReport,
    downloadSalesReport
};
