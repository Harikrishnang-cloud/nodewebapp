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
        console.log(orders)
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
        // format ellengil
        if (!format) {
            return res.status(400).send('Format parameter is required (pdf, csv, or excel)');
        }

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

        const orders = await Order.find({...dateFilter,status: { $nin: ['Cancelled'] } }).populate('userId').populate('items.product');

        if (!orders || orders.length === 0) {
            return res.status(404).send('No orders found for the selected period');
        }

        // Format data for reports
        const reportData = orders.map(order => {
            const userName = order.userId ? (order.userId.fullName || order.userId.name || 'N/A') : 'Deleted User';
            const products = order.items.map(item => {
                return item.product ? item.product.title : 'Product Removed';
            }).join(', ');

            return {
                'Order ID': order._id.toString(),
                'Date': moment(order.orderDate).format('YYYY-MM-DD HH:mm:ss'),
                'Customer Name': userName,
                'Products': products,
                'Discount': (order.discount || 0).toFixed(2),
                'Coupon Discount': (order.couponDiscount || 0).toFixed(2),
                'Total Amount': order.totalAmount.toFixed(2),
                'Payment Method': order.paymentMethod || 'N/A',
                'Status': order.status || 'N/A'
            };
        });

        switch (format.toLowerCase()) {
            case 'pdf':
                const doc = new PDFDocument();
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=sales_report_${moment().format('YYYY-MM-DD')}.pdf`);
                doc.pipe(res);

                // Add header
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

                // Add orders table
                doc.fontSize(14).text('Order Details', { underline: true });
                doc.moveDown();

                reportData.forEach((order, index) => {
                    doc.fontSize(10)
                        .text(`${index + 1}. Order ID: ${order['Order ID']}`)
                        .text(`   Date: ${order['Date']}`)
                        .text(`   Customer: ${order['Customer Name']}`)
                        .text(`   Products: ${order['Products']}`)
                        .text(`   Amount: ₹${order['Total Amount']}`)
                        .text(`   Status: ${order['Status']}`);
                    doc.moveDown(0.5);
                });

                doc.end();
                break;

            case 'csv':
                const fields = Object.keys(reportData[0]);
                const csv = json2csv.parse(reportData, { fields });
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=sales_report_${moment().format('YYYY-MM-DD')}.csv`);
                res.send(csv);
                break;

            case 'excel':
                const workbook = XLSX.utils.book_new();
                const worksheet = XLSX.utils.json_to_sheet(reportData);

                // Style headers
                const range = XLSX.utils.decode_range(worksheet['!ref']);
                for (let i = 0; i <= range.e.c; i++) {
                    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
                    if (!worksheet[cellRef]) continue;
                    worksheet[cellRef].s = {
                        font: { bold: true },
                        fill: { fgColor: { rgb: "CCCCCC" } }
                    };
                }

                // Set column widths
                worksheet['!cols'] = [
                    { wch: 24 },  // Order ID
                    { wch: 20 },  // Date
                    { wch: 20 },  // Customer Name
                    { wch: 40 },  // Products
                    { wch: 12 },  // Discount
                    { wch: 15 },  // Coupon Discount
                    { wch: 12 },  // Total Amount
                    { wch: 15 },  // Payment Method
                    { wch: 12 }   // Status
                ];

                XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Report');
                const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename=sales_report_${moment().format('YYYY-MM-DD')}.xlsx`);
                res.send(excelBuffer);
                break;

            default:
                res.status(400).send('Invalid format specified. Use pdf, csv, or excel');
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
