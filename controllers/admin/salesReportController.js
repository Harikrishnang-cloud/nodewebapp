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
            return {
                'Order ID': order._id.toString(),
                'Date': moment(order.orderDate).format('YYYY-MM-DD HH:mm:ss'),
                'Customer Name': userName,
                'Discount': (order.discount || 0).toFixed(2),
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
                    .text(`Total Discounts: ₹${orders.reduce((sum, order) => sum + (order.discount || 0), 0).toFixed(2)}`);
                doc.moveDown();

                // Table header
                const startX = 50;
                let startY = doc.y + 10;
                const rowHeight = 25;
                const colWidths = {
                    orderID: 140,
                    date: 80,
                    customer: 110,
                    discount: 70,
                    amount: 70,
                    status: 80
                };

                const totalWidth = Object.values(colWidths).reduce((sum, width) => sum + width, 0);
                let pageNumber = 1;

                // Function to add page number
                const addPageNumber = () => {
                    const bottom = doc.page.height - 50;
                    doc.fontSize(8)
                       .text(`Page ${pageNumber}`, 
                            startX, 
                            bottom, 
                            { align: 'center', width: totalWidth });
                };

                // Function to draw table header
                const drawTableHeader = (yPosition) => {
                    // Add some spacing at the top of each page
                    if (yPosition === 50) {
                        yPosition += 20;
                    }

                    doc.fontSize(9);
                    doc.rect(startX, yPosition, totalWidth, rowHeight).stroke();

                    let headerX = startX;
                    const headers = [
                        { text: 'Order ID', width: colWidths.orderID },
                        { text: 'Date', width: colWidths.date },
                        { text: 'Customer', width: colWidths.customer },
                        { text: 'Discount', width: colWidths.discount },
                        { text: 'Amount', width: colWidths.amount },
                        { text: 'Status', width: colWidths.status }
                    ];

                    headers.forEach(header => {
                        if (headerX > startX) {
                            doc.moveTo(headerX, yPosition)
                               .lineTo(headerX, yPosition + rowHeight)
                               .stroke();
                        }

                        doc.text(header.text,
                            headerX + 5,
                            yPosition + 8,
                            {
                                width: header.width - 10,
                                align: 'center'
                            }
                        );
                        headerX += header.width;
                    });

                    return yPosition + rowHeight;
                };

                // Draw initial header
                startY = drawTableHeader(startY);

                // Table rows
                doc.fontSize(8);

                reportData.forEach((order, i) => {
                    // Check if there's enough space for the next row
                    if (startY + rowHeight > doc.page.height - 70) {
                        // addPageNumber();
                        doc.addPage();
                        pageNumber++;
                        startY = 50;
                        startY = drawTableHeader(startY);
                    }

                    // Draw row background and vertical lines
                    doc.rect(startX, startY, totalWidth, rowHeight).stroke();
                    let currentX = startX;

                    const rowData = [
                        { 
                            text: order['Order ID'],
                            width: colWidths.orderID,
                            align: 'left'
                        },
                        { 
                            text: moment(order['Date']).format('DD-MM-YYYY'),
                            width: colWidths.date,
                            align: 'center'
                        },
                        { 
                            text: order['Customer Name'],
                            width: colWidths.customer,
                            align: 'left'
                        },
                        { 
                            text: '₹' + order['Discount'],
                            width: colWidths.discount,
                            align: 'right'
                        },
                        { 
                            text: '₹' + order['Total Amount'],
                            width: colWidths.amount,
                            align: 'right'
                        },
                        { 
                            text: order['Status'],
                            width: colWidths.status,
                            align: 'center'
                        }
                    ];

                    rowData.forEach(cell => {
                        if (currentX > startX) {
                            doc.moveTo(currentX, startY)
                               .lineTo(currentX, startY + rowHeight)
                               .stroke();
                        }

                        doc.text(cell.text,
                            currentX + 5,
                            startY + 8,
                            {
                                width: cell.width - 10,
                                align: cell.align
                            }
                        );
                        currentX += cell.width;
                    });

                    startY += rowHeight;
                });

                // Add page number to the last page
                // addPageNumber();
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
                    { wch: 12 },  // Discount
                    { wch: 12 },  // Total Amount
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
