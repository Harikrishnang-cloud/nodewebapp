const Order = require('../../models/orderSchema');
const moment = require('moment');

const getChartData = async (req, res) => {
    try {
        const timeFilter = req.query.timeFilter || 'daily';
        const currentDate = moment();
        let chartData = {};

        if (timeFilter === 'daily') {
            // Get data for last 7 days
            const days = [];
            const dailyData = [];

            for (let i = 0; i < 7; i++) {
                const startOfDay = moment().subtract(i, 'days').startOf('day');
                const endOfDay = moment().subtract(i, 'days').endOf('day');

                const daySales = await Order.aggregate([
                    {
                        $match: {
                            orderDate: {
                                $gte: startOfDay.toDate(),
                                $lte: endOfDay.toDate()
                            },
                            status: 'Delivered'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalSales: { $sum: 1 }
                        }
                    }
                ]);

                days.unshift(startOfDay.format('DD MMM')); // Format: "25 Jan"
                dailyData.unshift(daySales[0]?.totalSales || 0);
            }

            chartData = {
                labels: days,
                data: dailyData
            };
        } else if (timeFilter === 'weekly') {
            // Get data for last 4 weeks
            const weeks = [];
            const weeklyData = [];

            for (let i = 0; i < 4; i++) {
                const startOfWeek = moment().subtract(i, 'weeks').startOf('week');
                const endOfWeek = moment().subtract(i, 'weeks').endOf('week');

                const weekSales = await Order.aggregate([
                    {
                        $match: {
                            orderDate: {
                                $gte: startOfWeek.toDate(),
                                $lte: endOfWeek.toDate()
                            },
                            status: 'Delivered'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalSales: { $sum: 1 }
                        }
                    }
                ]);

                weeks.unshift(`Week ${4-i}`);
                weeklyData.unshift(weekSales[0]?.totalSales || 0);
            }

            chartData = {
                labels: weeks,
                data: weeklyData
            };
        } else if (timeFilter === 'monthly') {
            // Get data for last 12 months
            const months = [];
            const monthlyData = [];

            for (let i = 0; i < 12; i++) {
                const startOfMonth = moment().subtract(i, 'months').startOf('month');
                const endOfMonth = moment().subtract(i, 'months').endOf('month');

                const monthSales = await Order.aggregate([
                    {
                        $match: {
                            orderDate: {
                                $gte: startOfMonth.toDate(),
                                $lte: endOfMonth.toDate()
                            },
                            status: 'Delivered'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalSales: { $sum: 1 }
                        }
                    }
                ]);

                months.unshift(startOfMonth.format('MMM'));
                monthlyData.unshift(monthSales[0]?.totalSales || 0);
            }

            chartData = {
                labels: months,
                data: monthlyData
            };
        }

        res.json(chartData);
    } catch (error) {
        console.error('Error fetching chart data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getChartData
};
