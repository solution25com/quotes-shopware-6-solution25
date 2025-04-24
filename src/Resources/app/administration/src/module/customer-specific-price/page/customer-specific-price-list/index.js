import template from './customer-specific-price-list.html.twig'
import '../../components/sw-customer-select'
import '../../components/sw-product-select'
import '../../components/sw-data-csv'

const {Component, Mixin} = Shopware;
Component.register('customer-specific-price-list', {
    template,
    inject: ['repositoryFactory'],
    mixins: [Mixin.getByName('notification')],
    data() {
        return {
            isLoading: false,
            isImporting: false,
            prices: [],
            total: 0,
            page: 1,
            limit: 10,
            showDeleteModal: false,
            deleteRecordId: null,
            showAddCustomPriceModal: false,
            showEditCustomPriceModal: false,
            selectedTab: 'customer',
            selectedCustomer: null,
            selectedProduct: null,
            newCustomerAmount: null,
            
            columns: [
                {property: 'id', label: '#ID', visible: false},
                {property: 'customerName', label: 'Customer Name', sortable: true},
                {property: 'product', label: 'Product', sortable: true},
                {property: 'netPrice', label: 'Net Price', sortable: true},
                {property: 'grossPrice', label: 'Gross Price', sortable: true},
                {property: 'created_at', label: 'Created At', sortable: true},
            ],
        }
    },

    created() {
        this.fetchCustomPrices();
    },

    watch: {
        selectedCustomer(newCustomer) {
            this.fetchExistingPrice();
        },
        selectedProduct(newProduct) {
            this.fetchExistingPrice();
        }
    },


    methods: {
        handleImportFinish() {
            this.isImporting = false;
            this.fetchCustomPrices(); 
        },
        resetForm() {
            this.selectedCustomer = null;
            this.selectedProduct = null;
            this.newCustomerAmount = null;
            this.showAddCustomPriceModal = false;
        },

        onPageChange(newPageData) {
            if (typeof newPageData === 'object') {
                if (newPageData.page) {
                    this.page = parseInt(newPageData.page, 10);
                }
                if (newPageData.limit) {
                    this.limit = parseInt(newPageData.limit, 10);
                }
            } else if (typeof newPageData === 'number' && newPageData > 0) {
                this.page = parseInt(newPageData, 10);
            } else {
                return;
            }

            this.fetchCustomPrices();
        },

        openAddCustomPriceModal() {
            this.showAddCustomPriceModal = true
        },

        async confirmDelete() {
            try {
                const repository = this.repositoryFactory.create('custom_price');
                await repository.delete(this.deleteRecordId, Shopware.Context.api);

                this.createNotificationSuccess({
                    title: 'Success',
                    message: 'The custom price has been deleted successfully.'
                });

                this.fetchCustomPrices();
            } catch (error) {
                this.createNotificationError({
                    title: 'Error',
                    message: 'Failed to delete the custom price. Please try again.'
                });
            }

            this.closeDeleteModal();
        },
        openDeleteModal(recordId) {
            this.deleteRecordId = recordId;
            this.showDeleteModal = true;
        },
        closeDeleteModal() {
            this.showDeleteModal = false;
            this.deleteRecordId = null;
        },

        openEditCustomPriceModal(item) {
            this.selectedCustomer = item.customerId;
            this.selectedProduct = item.productId;

            if (item.netPrice) {
                this.newCustomerAmount = parseFloat(item.netPrice);
            } else {
                this.newCustomerAmount = null;
            }

            this.showEditCustomPriceModal = true;
        },

        async fetchCustomPrices() {
            this.isLoading = true;
        
            try {
                const repository = this.repositoryFactory.create("custom_price");
                const criteria = this.createCriteria();
                const result = await repository.search(criteria, Shopware.Context.api);
        
        
                this.prices = result.map(elem => ({
                    id: elem.id,
                    customerId: elem.customerId,
                    customerName: elem.customer ? `${elem.customer.firstName} ${elem.customer.lastName}` : "N/A",
                    productId: elem.productId,
                    product: elem.product?.translated?.name || elem.product?.name || "N/A", 
                    netPrice: elem.price?.[0]?.[0]?.net?.toFixed(2) || "N/A",
                    grossPrice: elem.price?.[0]?.[0]?.gross?.toFixed(2) || "N/A",
                    created_at: elem.createdAt ? new Date(elem.createdAt).toLocaleDateString() : "N/A"
                }));
        
        
                this.total = result.total || 0;
            } catch (error) {
                console.error("Failed to fetch custom prices:", error);
                this.createNotificationError({
                    title: "Error",
                    message: "Failed to fetch custom prices. Please try again."
                });
            } finally {
                this.isLoading = false;
            }
        },

        createCriteria() {
            return new Shopware.Data.Criteria(this.page, this.limit)
                .addAssociation("customer") 
                .addAssociation("product") 
                .addSorting(Shopware.Data.Criteria.sort("createdAt", "DESC"));
        },

        async fetchExistingPrice() {
            if (!this.selectedCustomer || !this.selectedProduct) {
                this.newCustomerAmount = null;
                return;
            }

            try {
                const repository = this.repositoryFactory.create('custom_price');
                const criteria = new Shopware.Data.Criteria(1, 1)
                    .addFilter(Shopware.Data.Criteria.equals('customerId', this.selectedCustomer))
                    .addFilter(Shopware.Data.Criteria.equals('productId', this.selectedProduct));

                const existingPrices = await repository.search(criteria, Shopware.Context.api);

                this.newCustomerAmount = existingPrices.total > 0
                    ? parseFloat(existingPrices.first()?.price?.[0]?.[0]?.net || null)
                    : null;
            } catch {
                this.newCustomerAmount = null;
            }
        },

        async addOrUpdateCustomPrice(isUpdate = false) {
            if (!this.selectedCustomer || !this.selectedProduct || !this.newCustomerAmount) {
                this.createNotificationError({title: 'Error', message: 'Please enter all required fields.'});
                return;
            }

            this.isLoading = true;

            try {
                const repository = this.repositoryFactory.create('custom_price');
                const product = await this.repositoryFactory.create('product').get(this.selectedProduct, Shopware.Context.api);
                const taxRate = product.taxId ? (await this.repositoryFactory.create('tax').get(product.taxId, Shopware.Context.api))?.taxRate || 0 : 0;

                const netPrice = parseFloat(this.newCustomerAmount);
                const grossPrice = netPrice * (1 + taxRate / 100);
                const currencyId = Shopware.Context.app.systemCurrencyId;

                const criteria = new Shopware.Data.Criteria(1, 1)
                    .addFilter(Shopware.Data.Criteria.equals('customerId', this.selectedCustomer))
                    .addFilter(Shopware.Data.Criteria.equals('productId', this.selectedProduct));

                const existingPrices = await repository.search(criteria, Shopware.Context.api);
                let customPrice = existingPrices.total > 0 ? existingPrices.first() : repository.create(Shopware.Context.api);

                customPrice.customerId = this.selectedCustomer;
                customPrice.productId = this.selectedProduct;
                customPrice.price = [
                    {
                        quantityStart: 1,
                        quantityEnd: null,
                        price: [{
                            currencyId,
                            net: netPrice.toFixed(2),
                            gross: grossPrice.toFixed(2),
                            linked: true
                        }]
                    }
                ];


                await repository.save(customPrice, Shopware.Context.api);

                this.createNotificationSuccess({
                    title: 'Success',
                    message: isUpdate ? 'Custom price updated successfully.' : 'Custom price added successfully.'
                });

                this.fetchCustomPrices();
                this.showAddCustomPriceModal = false;
                this.showEditCustomPriceModal = false;
                this.resetForm();
            } catch {
                this.createNotificationError({title: 'Error', message: 'Failed to save the custom price.'});
            } finally {
                this.isLoading = false;
            }
        }
    }
})