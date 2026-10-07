# VN crochet — Azure backend setup guide

Follow these steps once to create the Azure resources and wire everything up.
All commands run in PowerShell. You only need to do this once.

---

## Step 1 — Install the Azure CLI

Download and run the installer:
https://aka.ms/installazurecliwindows

After installing, close and reopen PowerShell, then log in:

```powershell
az login
```

A browser window will open. Sign in with your Azure Student account.

---

## Step 2 — Install Azure Functions Core Tools

```powershell
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

---

## Step 3 — Create a Resource Group

A resource group keeps all VN crochet resources together.

```powershell
az group create --name vncrochet-rg --location centralindia
```

---

## Step 4 — Create Cosmos DB (database for products + orders)

```powershell
az cosmosdb create `
  --name vncrochet-db `
  --resource-group vncrochet-rg `
  --kind GlobalDocumentDB `
  --default-consistency-level Session

# Get the endpoint URL
az cosmosdb show `
  --name vncrochet-db `
  --resource-group vncrochet-rg `
  --query documentEndpoint `
  --output tsv

# Get the primary key
az cosmosdb keys list `
  --name vncrochet-db `
  --resource-group vncrochet-rg `
  --query primaryMasterKey `
  --output tsv
```

Save the endpoint and key — you'll need them in Step 7.

---

## Step 5 — Create Storage Account (for product images)

```powershell
az storage account create `
  --name vncrochetstorage `
  --resource-group vncrochet-rg `
  --location centralindia `
  --sku Standard_LRS

# Get the connection string
az storage account show-connection-string `
  --name vncrochetstorage `
  --resource-group vncrochet-rg `
  --output tsv
```

Save the connection string — you'll need it in Step 7.

---

## Step 6 — Create the Azure Functions App

```powershell
# Create a consumption plan (free tier)
az functionapp create `
  --name vncrochet-api `
  --resource-group vncrochet-rg `
  --consumption-plan-location centralindia `
  --runtime node `
  --runtime-version 18 `
  --functions-version 4 `
  --storage-account vncrochetstorage `
  --os-type Windows
```

---

## Step 7 — Set environment variables on the Functions App

Replace the placeholder values with your real ones from Steps 4 and 5.
Also choose your admin username and password here — tell no one else.
The JWT_SECRET must be at least 32 random characters.

```powershell
az functionapp config appsettings set `
  --name vncrochet-api `
  --resource-group vncrochet-rg `
  --settings `
    "COSMOS_ENDPOINT=https://vncrochet-db.documents.azure.com:443/" `
    "COSMOS_KEY=YOUR-COSMOS-PRIMARY-KEY==" `
    "COSMOS_DB=vncrochet" `
    "BLOB_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=vncrochetstorage;AccountKey=YOUR-STORAGE-KEY;EndpointSuffix=core.windows.net" `
    "BLOB_CONTAINER=product-images" `
    "JWT_SECRET=replace-with-32-plus-random-chars" `
    "ADMIN_USERNAME=varsha" `
    "ADMIN_PASSWORD=your-chosen-password"
```

---

## Step 8 — Link Azure Functions to Azure Static Web Apps

In the Azure Portal:
1. Go to your Static Web App (yellow-ground-0181a7700)
2. Click **Configuration** → **Application settings** (these are only for the static site itself, not the Functions)
3. Click **Functions** → **Link a backend**
4. Choose **Azure Functions App** → select **vncrochet-api**
5. Save

This connects `/api/*` on your static site to the Functions app automatically.

Alternatively, update the GitHub Actions workflow to deploy the API folder too (Step 9).

---

## Step 9 — Update GitHub Actions to deploy Functions

Open `.github/workflows/azure-static-web-apps-yellow-ground-0181a7700.yml`
and change the `api_location` line:

```yaml
api_location: "api"        # ← change from "" to "api"
```

Commit and push — the next deploy will publish both the static site and the Functions.

---

## Step 10 — Install API dependencies locally (for local dev)

```powershell
cd "c:\Users\bisht\Desktop\Varsha Website\api"
npm install
```

Copy the example settings file:
```powershell
Copy-Item local.settings.json.example local.settings.json
```

Fill in `local.settings.json` with your real values from Steps 4 and 5.

To run locally:
```powershell
# Terminal 1 — static site
cd "c:\Users\bisht\Desktop\Varsha Website"
python -m http.server 8000

# Terminal 2 — Functions
cd "c:\Users\bisht\Desktop\Varsha Website\api"
func start
```

Open http://localhost:8000 — the site and API both run locally.

---

## Environment variable reference

| Variable | Where to get it |
|---|---|
| `COSMOS_ENDPOINT` | Step 4 — Cosmos DB endpoint |
| `COSMOS_KEY` | Step 4 — Cosmos DB primary key |
| `COSMOS_DB` | Always `vncrochet` |
| `BLOB_CONNECTION_STRING` | Step 5 — Storage connection string |
| `BLOB_CONTAINER` | Always `product-images` |
| `JWT_SECRET` | Make up: 32+ random characters |
| `ADMIN_USERNAME` | Your choice (e.g. `varsha`) |
| `ADMIN_PASSWORD` | Your choice — keep it private |

---

## When you get a custom domain

1. Add the domain in Azure Static Web Apps → Custom domains
2. Update `index.html` canonical URL and OG tags from `https://vncrochet.com/` to your real domain
3. Update `robots.txt` and `sitemap.xml` with the real domain
4. Redeploy

---

## Admin desk access

Once deployed, go to:
`https://yellow-ground-0181a7700.5.azurestaticapps.net/admin`

Log in with the username and password you set in Step 7.
Your sister can access this from her phone — it works on mobile.
The session lasts 8 hours, then she logs in again.
