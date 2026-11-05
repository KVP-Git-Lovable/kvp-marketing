import { LightningElement, api, track } from 'lwc';

export default class RetailerAnalytics extends LightningElement {
    @api retailer;

    // Mock analytics data
    topProducts = [
        { name: 'Premium Coffee Beans', quantity: 45, revenue: '$2,250' },
        { name: 'Energy Drinks Pack', quantity: 38, revenue: '$1,900' },
        { name: 'Organic Snacks', quantity: 32, revenue: '$1,280' },
        { name: 'Fresh Milk 1L', quantity: 28, revenue: '$840' }
    ];

    enrolledSchemes = [
        { name: 'Volume Discount Program', isActive: true, enrolledDate: '2023-08-15' },
          { name: 'Seasonal Promotion', isActive: true, enrolledDate: '2023-11-01' },
        { name: 'New Product Launch', isActive: false, enrolledDate: '2023-06-10' }
    ];

    opportunityProducts = [
        { name: 'Frozen Food Items', category: 'Frozen', potential: '+$890' },
        { name: 'Health Supplements', category: 'Health', potential: '+$650' },
        { name: 'Eco-friendly Products', category: 'Green', potential: '+$420' }
    ];

    @track retailerPotential = {
        score: 78,
        factors: [
            { name: 'Location Traffic', score: 8, progressStyle: 'width: 80%' },
            { name: 'Customer Base', score: 7, progressStyle: 'width: 70%' },
            { name: 'Order Frequency', score: 9, progressStyle: 'width: 90%' },
            { name: 'Payment History', score: 8, progressStyle: 'width: 80%' },
            { name: 'Growth Potential', score: 6, progressStyle: 'width: 60%' }
        ]
    };

    get formattedRevenue() {
        if (this.retailer && this.retailer.metrics && this.retailer.metrics.revenue) {
            return `$${this.retailer.metrics.revenue.toLocaleString()}`;
        }
        return '$0';
    }
}