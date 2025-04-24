import template from './sw-data-csv.html.twig'
const { Component, Mixin } = Shopware;

Component.register('sw-data-csv',
    {
    template,
    inject: ["repositoryFactory"],
        mixins: [Mixin.getByName('notification')],
    emits: ["import-complete"],
    data() {
        return {
            isProcessing: false,
            isExporting: false,
        };
    },
    methods: {
        triggerFileUpload() {
            this.$refs.csvFileInput.click();
        },

        async handleFileUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
    
            this.$emit("import-start");
            await this.$nextTick();
    
            await new Promise((resolve) => setTimeout(resolve, 100));
    
            const reader = new FileReader();
            reader.onload = async (e) => {
                const csvData = e.target.result;
                const parsedData = this.parseCSV(csvData);
                await this.processCSVData(parsedData);
                this.$emit("import-finish"); 
            };
            reader.readAsText(file);
        },

        parseCSV(csvData) {
            const lines = csvData.split("\n");
            const headers = lines[0].split(",").map((header) => header.trim());

            return lines.slice(1).map((line) => {
                const values = line.split(",");
                return headers.reduce((acc, header, index) => {
                    acc[header] = values[index] ? values[index].trim() : "";
                    return acc;
                }, {});
            }).filter(row => row["Customer ID"] && row["SKU"] && row["Custom WS Price"]);
        },

        async processCSVData(parsedData) {
            try {
                for (const row of parsedData) {
                    const customerId = await this.getCustomerUUID(row["Customer ID"]);
                    const productId = await this.getProductUUID(row["SKU"]);
                    const price = parseFloat(row["Custom WS Price"]);
    
                    if (customerId && productId && !isNaN(price)) {
                        await this.saveCustomPrice(customerId, productId, price);
                    }
                }
    
                this.$emit("import-finish"); 
                this.createNotificationSuccess({
                    title: "Import Success",
                    message: "CSV data has been imported successfully!",
                });
            } catch (error) {
                console.error("Import Error:", error);
                this.createNotificationError({
                    title: "Import Error",
                    message: "There was an issue importing the CSV file. Please try again.",
                });
            }
        },

        async getCustomerUUID(uuid) {
            const customerRepository = this.repositoryFactory.create("customer");
            const criteria = new Shopware.Data.Criteria(1, 1);
            criteria.addFilter(Shopware.Data.Criteria.equals("id", uuid));
            const customers = await customerRepository.search(criteria, Shopware.Context.api);
            return customers.total > 0 ? customers.first().id : null;
        },

        async getProductUUID(sku) {
            const productRepository = this.repositoryFactory.create("product");
            const criteria = new Shopware.Data.Criteria(1, 1);
            criteria.addFilter(Shopware.Data.Criteria.equals("productNumber", sku));
            const products = await productRepository.search(criteria, Shopware.Context.api);
            return products.total > 0 ? products.first().id : null;
        },

        async saveCustomPrice(customerId, productId, netPrice) {
            const customPriceRepository = this.repositoryFactory.create("custom_price");
            const taxRepository = this.repositoryFactory.create("tax");
            const productRepository = this.repositoryFactory.create("product");

            const product = await productRepository.get(productId, Shopware.Context.api);
            const tax = await taxRepository.get(product.taxId, Shopware.Context.api);
            const taxRate = tax.taxRate || 0;
            const grossPrice = netPrice * (1 + taxRate / 100);


            const existingCriteria = new Shopware.Data.Criteria(1, 1);
            existingCriteria.addFilter(Shopware.Data.Criteria.equals("customerId", customerId));
            existingCriteria.addFilter(Shopware.Data.Criteria.equals("productId", productId));

            const existingPrices = await customPriceRepository.search(existingCriteria, Shopware.Context.api);

            let customPrice;
            if (existingPrices.total > 0) {
                customPrice = existingPrices.first();
            } else {
                customPrice = customPriceRepository.create(Shopware.Context.api);
                customPrice.customerId = customerId;
                customPrice.productId = productId;
            }

            customPrice.price = [
                {
                    quantityStart: 1,
                    quantityEnd: null,
                    price: [
                        {
                            currencyId: Shopware.Context.app.systemCurrencyId,
                            net: netPrice.toFixed(2),
                            gross: grossPrice.toFixed(2),
                            linked: true,
                        },
                    ],
                },
            ];

            await customPriceRepository.save(customPrice, Shopware.Context.api);
        },

        async exportCSV() {
            this.isExporting = true;
        
            const customPriceRepository = this.repositoryFactory.create("custom_price");
            const criteria = new Shopware.Data.Criteria();
            criteria.addAssociation("customer");
            criteria.addAssociation("product");
        
            const customPrices = await customPriceRepository.search(criteria, Shopware.Context.api);
        
            if (!customPrices || customPrices.total === 0) {
                this.isExporting = false;
                return;
            }
        
            const csvHeader = "Customer ID,Customer Tier Name,SKU,Product Name,Custom MSRP,Custom WS Price\n";
            const csvRows = customPrices.map((priceData) => {
                const customerId = priceData.customerId || "N/A";
                const customerName = priceData.customer ? `${priceData.customer.firstName} ${priceData.customer.lastName}` : "Unknown Customer";
                const sku = priceData.product?.productNumber || "N/A";
                const msrp = ''
                const productName = priceData.product?.name ? `"${priceData.product.name}"` : "Unknown Product";
        
                let netPrice = "N/A";
                if (
                    priceData.price &&
                    Array.isArray(priceData.price) &&
                    priceData.price.length > 0 &&
                    Array.isArray(priceData.price[0]) &&
                    priceData.price[0].length > 0
                ) {
                    netPrice = priceData.price[0][0].net || "0.00";
                }
        
                return `${customerId},"${customerName}",${sku},${productName},${msrp},${netPrice}`;
            });
        
            const csvContent = csvHeader + csvRows.join("\n");
        
            const blob = new Blob([csvContent], { type: "text/csv" });
            const date = new Date();
            const formattedDate = `${date.getMonth() + 1}.${date.getDate()}.${date.getFullYear().toString().slice(2)}`; // Formatting the date as m.d.y
            const fileName = `M2 VB Display All Mageworx Custom Pricing - ${formattedDate}.csv`; // Custom file name with date
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        
            this.isExporting = false;
        }
    }
    })