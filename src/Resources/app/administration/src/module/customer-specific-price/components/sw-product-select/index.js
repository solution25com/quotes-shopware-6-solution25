import template from './sw-product.select.html.twig';
const { Component } = Shopware;
Component.register('sw-product-select', {
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
      productOptions: [],
      selectedProduct: this.value,
      isLoading: false,
      searchTerm: '',
      totalProducts: 0,
      page: 1, 
      limit: 10, 
      columns: [
        { property: 'label', label: 'Product Name', allowResize: true }
      ],
    };
  },
  watch: {
    value(newVal) {
      this.selectedCustomer = newVal;
    },
    selectedProduct(newVal) {
      this.$emit('update:value', newVal);
    },
    searchTerm() {
      this.fetchProducts(true);
    }
  },
  created() {
    this.fetchProducts();
  },

  methods: {
    async fetchProducts(reset = false) {
      if (reset) {
        this.page = 1;
      }

      this.isLoading = true;

      try {
        const criteria = this.createCriteria();

        const result = await this.repositoryFactory.create('product').search(criteria, Shopware.Context.api);

        this.productOptions = result.map(elem => ({
          id: elem.id,
          label: elem.name,
        }));

        this.totalProducts = result.total; 
      } catch (error) {
      } finally {
        this.isLoading = false;
      }
    },

    createCriteria() {
      const criteria = new Shopware.Data.Criteria(this.page, this.limit);
    
      criteria.setLimit(this.limit);
      criteria.setPage(this.page);
    
      if (this.searchTerm) {
        criteria.addFilter(
          Shopware.Data.Criteria.multi(
            'OR', // Match either name or productNumber
            [
              Shopware.Data.Criteria.contains('name', this.searchTerm),
              Shopware.Data.Criteria.contains('productNumber', this.searchTerm)
            ]
          )
        );
      }
    
      return criteria;
    },

    onPageChange(newPageData) {

      if (typeof newPageData === 'object' && newPageData.page) {
        newPageData = newPageData.page;
      }

      if (typeof newPageData !== 'number' || newPageData <= 0) {
        return;
      }

      this.page = parseInt(newPageData, 10);
      this.fetchProducts();
    },

    onSearch() {
      this.fetchProducts(true); 
    },

    onSelectProduct(selection) {
      const selected = Object.values(selection)[0];
      if (selected) {
        this.selectedProduct = selected.id;
      }
    }
  }
});
