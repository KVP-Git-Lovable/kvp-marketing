import { LightningElement, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class VisitPlanner extends NavigationMixin(LightningElement) {
    @track searchTerm = '';
    @track selectedPriority = '';
    @track showAnalytics = false;
    @track selectedRetailer = {};

    // Mock data - replace with Apex calls
    @track retailers = [
        {
            id: '1',
            name: 'Corner Store Plus',
            location: 'Downtown District',
            accountType: 'Premium',
            priority: 'high',
            lastVisitDate: '2024-01-15',
            avgOrders3M: '$2,450',
            avgOrderPerVisit: '$875',
            visitsCount3M: '8',
            metrics: {
                revenue: 15420,
                orders: 28,
                growth: 12.5
            }
        },
        {
            id: '2',
            name: 'Metro Market',
            location: 'Business Center',
            accountType: 'Standard',
            priority: 'medium',
            lastVisitDate: '2024-01-10',
            avgOrders3M: '$1,850',
            avgOrderPerVisit: '$620',
            visitsCount3M: '6',
            metrics: {
                revenue: 12300,
                orders: 22,
                growth: 8.3
            }
        },
        {
            id: '3',
            name: 'Quick Mart Express',
            location: 'Suburb Area',
            accountType: 'Basic',
            priority: 'low',
            lastVisitDate: '2024-01-08',
            avgOrders3M: '$980',
            avgOrderPerVisit: '$245',
            visitsCount3M: '4',
            metrics: {
                revenue: 5680,
                orders: 12,
                growth: 3.2
            }
        }
    ];

    get priorityOptions() {
        return [
            { label: 'All Priorities', value: '' },
            { label: 'High Priority', value: 'high' },
            { label: 'Medium Priority', value: 'medium' },
            { label: 'Low Priority', value: 'low' }
        ];
    }

    get filteredRetailers() {
        let filtered = this.retailers;

        // Filter by search term
        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            filtered = filtered.filter(retailer => 
                retailer.name.toLowerCase().includes(searchLower) ||
                retailer.location.toLowerCase().includes(searchLower)
            );
        }

        // Filter by priority
        if (this.selectedPriority) {
            filtered = filtered.filter(retailer => retailer.priority === this.selectedPriority);
        }

        // Add computed properties for template conditionals
        return filtered.map(retailer => ({
            ...retailer,
            isPriorityHigh: retailer.priority === 'high',
            isPriorityMedium: retailer.priority === 'medium',
            isPriorityLow: retailer.priority === 'low'
        }));
    }

    get totalRetailers() {
        return this.filteredRetailers.length;
    }

    get highPriorityCount() {
        return this.filteredRetailers.filter(r => r.priority === 'high').length;
    }

    get mediumPriorityCount() {
        return this.filteredRetailers.filter(r => r.priority === 'medium').length;
    }

    get lowPriorityCount() {
        return this.filteredRetailers.filter(r => r.priority === 'low').length;
    }

    handleSearchChange(event) {
        this.searchTerm = event.target.value;
    }

    handlePriorityChange(event) {
        this.selectedPriority = event.target.value;
    }

    handleScheduleVisit(event) {
        const retailerId = event.target.dataset.retailerId;
        const retailer = this.retailers.find(r => r.id === retailerId);
        
        // Show success toast
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Visit Scheduled',
                message: `Visit scheduled for ${retailer.name}`,
                variant: 'success'
            })
        );

        // Navigate to visit detail or calendar
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: 'Visit__c',
                actionName: 'new'
            },
            state: {
                defaultFieldValues: `Retailer__c=${retailerId}`
            }
        });
    }

    handleViewAnalytics(event) {
        const retailerId = event.target.dataset.retailerId;
        this.selectedRetailer = this.retailers.find(r => r.id === retailerId);
        this.showAnalytics = true;
    }

    handleCloseAnalytics() {
        this.showAnalytics = false;
        this.selectedRetailer = {};
    }
}