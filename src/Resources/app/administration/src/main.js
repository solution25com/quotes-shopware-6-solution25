import  './module/customer-specific-price';
import template from './extension/sw-quote-line-items/sw-quote-line-items.html.twig';
import './styles/base.scss'
Shopware.Component.override('sw-quote-line-items', {
    template,
    computed: {
        columns() {
            const baseColumns = this.$super('columns');
            baseColumns.unshift({
                property: 'persistPrice',
                label: 'Quote Price',
                inlineEdit: true,
                sortable: false,
                align: 'right',
                allowResize: true,
            });
            return baseColumns;
        },
    },
    methods: {
        getPersistPrice(item) {
            return item?.customFields?.persistPrice ?? false;
        },
        setPersistPrice(item, value) {
            if (!item.customFields) {
                item.customFields = {};
            }
            item.customFields.persistPrice = value;
        },
    },
});