# Cost estimate for northlight.cloud.json

Estimate for the design in [northlight.cloud.json](northlight.cloud.json): one resource group, a Linux web app (Basic B1) and a Hot LRS storage account, all in North Europe (Ireland).

**Source and date.** Prices are pay-as-you-go list prices in EUR from Microsoft's public Azure Retail Prices API (the data behind the Azure pricing calculator), queried on 2026-11-27. Prices change, so treat this as a snapshot. It excludes tax, support plans, custom domains and certificates.

## Assumptions (change these to match real use)

| Item | Assumption |
|---|---|
| Web app | 1 instance running all month (730 hours) |
| Storage stored | 5 GB |
| Storage writes | 100,000 operations a month |
| Storage reads | 1,000,000 operations a month |
| Network traffic out | Under the free monthly allowance, so not costed |

## Estimate

| Resource | Price used | Quantity | Monthly cost (EUR) |
|---|---|---|---|
| Resource group | free | - | 0.0000 |
| Web app, App Service Basic B1 (Linux) | 0.0162 per hour | 730 hours | 11.8260 |
| Storage, Hot LRS data stored | 0.0197 per GB per month | 5 GB | 0.0985 |
| Storage, Hot LRS write operations | 0.0449 per 10,000 | 10 units | 0.4490 |
| Storage, Hot read operations | 0.0036 per 10,000 | 100 units | 0.3600 |
| **Total** | | | **about 12.73** |

The web app is almost the whole bill (about 93%). If the site stays static, the Free F1 App Service tier or Azure Static Web Apps Free would cost nothing, at the price of limits such as shared compute and no always-on.

## Reproduce it in the Azure pricing calculator

1. Open `https://azure.microsoft.com/pricing/calculator/`.
2. Add **App Service**: region North Europe, operating system Linux, tier Basic, instance B1, 1 instance, 730 hours.
3. Add **Storage Accounts**: region North Europe, type Block Blob Storage, StorageV2, Standard, LRS, Hot access tier, 5 GB capacity, 100,000 write operations, 1,000,000 read operations.
4. Resource groups cost nothing and are not added.
5. Choose EUR. The total should land close to the table above; small differences come from rounding and the calculator's own defaults.
