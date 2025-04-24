import template from './sw-customer-select.html.twig';

const {Component} = Shopware;

Component.register('sw-customer-select', {
    template,
    inject: ['repositoryFactory'],
    props: {
        value: {
            type: String,
            required: false,
            default: null
        }
    },

    data() {
        return {
            selectedCustomer: this.value,
            customerOptions: [],
            isLoading: false,
            searchTerm: '',
            totalCustomers: 0,
            page: 1,
            limit: 10,

            columns: [
                {property: 'label', label: 'Name', allowResize: true},
                {property: 'customerNumber', label: 'Customer Number', allowResize: true},
                {property: 'email', label: 'Email', allowResize: true}
            ]
        };
    },

    watch: {
        value(newVal) {
            this.selectedCustomer = newVal;
        },
        selectedCustomer(newVal) {
            this.$emit('update:value', newVal);
        },
        searchTerm: {
            handler() {
                this.fetchCustomers(true);
            },
            immediate: false
        }
    },
    created() {
        this.fetchCustomers();
    },
    computed: {
        selectedItems() {
            if (!this.selectedCustomer) {
                return {};
            }

            const selectedItem = this.customerOptions.find(c => c.id === this.selectedCustomer);
            return selectedItem ? {[selectedItem.id]: selectedItem} : {};
        }
    },
    methods: {
        async fetchCustomers(reset = false) {
            if (reset) {
                this.page = 1;
            }

            this.isLoading = true;

            try {
                const criteria = this.createCriteria();

                const result = await this.repositoryFactory.create('customer').search(criteria, Shopware.Context.api);

                this.customerOptions = result.map(elem => ({
                    id: elem.id,
                    label: `${elem.firstName} ${elem.lastName}`,
                    customerNumber: elem.customerNumber,
                    email: elem.email
                }));

                this.totalCustomers = result.total;
            } catch (error) {
                console.error('Error fetching customers:', error.response?.data || error);
            } finally {
                this.isLoading = false;
            }
        },
        onSearch() {
            this.fetchCustomers(true);
        },

        onPageChange(newPageData) {
            console.log('Raw Page Change Event:', newPageData);

            if (typeof newPageData === 'object' && newPageData.page) {
                newPageData = newPageData.page;
            }

            if (typeof newPageData !== 'number' || newPageData <= 0) {
                console.error('Invalid page number:', newPageData);
                return;
            }

            console.log('Page changed to:', newPageData);
            this.page = parseInt(newPageData, 10);
            this.fetchCustomers();
        },
        onSelectCustomer(selection) {
            const selected = Object.values(selection)[0];
            if (selected) {
                this.selectedCustomer = selected.id;
                this.$emit('update:value', selected.id);
            }
        },
        createCriteria() {
            const pageNumber = Number.isInteger(this.page) && this.page > 0 ? this.page : 1;
            const criteria = new Shopware.Data.Criteria(pageNumber, this.limit);
        
            criteria.setLimit(this.limit);
            criteria.setPage(this.page);
        
            if (this.searchTerm && this.searchTerm.trim().length > 0) {
                criteria.addFilter(
                    Shopware.Data.Criteria.multi('OR', [
                        Shopware.Data.Criteria.contains('firstName', this.searchTerm),
                        Shopware.Data.Criteria.contains('lastName', this.searchTerm),
                        Shopware.Data.Criteria.contains('email', this.searchTerm),
                        Shopware.Data.Criteria.contains('customerNumber', this.searchTerm)
                    ])
                );
            }
        
            return criteria;        
        }

    }

});
