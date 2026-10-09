# VN Crochet - Azure Deployment Setup

## Live URLs
- **Main Site:** https://yellow-ground-0181a7700.5.azurestaticapps.net/
- **Admin Desk:** https://yellow-ground-0181a7700.5.azurestaticapps.net/admin/

## Admin Credentials
- **Username:** varsha75
- **Password:** varsha2812

## Azure Resources Created
1. **Static Web App:** VN-crochets-crafters
   - Region: East Asia
   - Hosting: Free tier
   - GitHub integration: Auto-deploys from main branch

2. **Storage Account:** vncrochetstore
   - Contains:
     - `products` table (catalog data)
     - `orders` table (order history)
     - `product-images` container (uploaded images)

3. **Function App (deprecated):** vncrochetapi
   - NOT USED - Functions run inside Static Web App instead (free)

## Environment Variables Set
On Static Web App → Environment variables → Production:
- `STORAGE_CONNECTION_STRING` - Azure Storage connection
- `WHATSAPP_PHONE` - 8923646175
- `ADMIN_USERNAME` - varsha75
- `ADMIN_PASSWORD` - varsha2812
- `JWT_SECRET` - vncrochet_secret_key_2024_varsha

## API Endpoints (Auto-deployed with site)
- `GET /api/catalog` - List all products (public)
- `POST /api/catalog` - Add/update products (admin only, accepts array)
- `DELETE /api/catalog/:id` - Delete product (admin only)
- `POST /api/login` - Admin login (returns JWT token)
- `POST /api/upload` - Upload product image (admin only)
- `GET /api/orders` - List orders (admin only)
- `POST /api/orders` - Create order (public, from WhatsApp flow)

## Admin Desk Features
✅ Login with username/password (JWT-based sessions)
✅ Add/edit products
✅ Only **name** and **price** are required - all other fields optional
✅ Upload product images (up to 4MB, JPG/PNG/WebP)
✅ Toggle product active/draft status
✅ Delete products
✅ View all orders
✅ Download catalog as JSON

## How It Works
1. Push to GitHub main branch → Azure auto-builds and deploys
2. Functions run serverless inside Static Web App (no separate Function App cost)
3. Admin desk saves to Azure Storage Tables
4. Product images stored in Blob Storage
5. Shop loads products from `/api/catalog`
6. Checkout redirects to WhatsApp with order details

## Next Steps
1. Test admin desk - add real products
2. Upload actual product photos
3. Test full shop flow: browse → cart → WhatsApp checkout
4. Monitor orders in admin desk
5. Optional: Add custom domain later

## Troubleshooting
- If login fails: Check deployment status in GitHub Actions
- If API returns 500: Check environment variables are set in Azure
- If images don't load: Verify Storage container permissions
- Cache issues: Hard refresh (Ctrl+Shift+R)

---
**Last Updated:** 2024-10-09
