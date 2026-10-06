# Future pages

This directory is reserved for route-level pages once the storefront grows beyond the single entry point. Likely future pages include `shop.html`, `product.html`, `custom-order.html`, and `checkout.html`.

Keep shared catalogue data in `js/data.js`, browser state in `js/store.js`, and shared visual rules in `css/styles.css`. A page should own its markup and page-specific orchestration without duplicating product data or cart rules.