import './page/customer-specific-price-list';

Shopware.Module.register('customer-specific-price', {
  type: 'plugin',
  name: 'customer-specific-price',
  title: 'Customer Specific Price',
  description: 'Manage customer specific prices',
  color: '#ff3d3d',
  icon: 'default-shopping-paper-bag',

  routes: {
    list: {
      component: 'customer-specific-price-list',
      path: 'list',
    },
  },

  navigation: [
    {
      id: 'customer-specific-price',
      label: 'Customer Specific Price',
      color: '#ff3d3d',
      path: 'customer.specific.price.list',
      icon: 'default-shopping-paper-bag',
      parent: 'sw-customer',
      position: 50,
    },
  ],
});