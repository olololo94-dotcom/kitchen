# Kitchen Ledger

Android kitchen inventory app.

- Live camera barcode scanning, with "keep scanning" for a full shopping bag
- Product lookup from Open Food Facts: name, brand, pack size, category and picture
- Receipt reading on the phone (offline), with a review list before anything is stored
- Expiry dates, fridge / freezer / pantry, "use soon" warnings
- Recipes from TheMealDB ranked by what you have, expiring food first; "I cooked this" deducts what you used
- Shopping list that fills itself when you run out, share it to any app
- CSV export (Downloads or share) and CSV import (comma or semicolon)

## Build

Every push to `main` builds the APK on GitHub Actions. Download it from the **Releases** page of this repository.

To build on a computer instead: open the folder in Android Studio and choose *Build > Build APK(s)*.

The signing key in `app/kitchenledger.jks` is for this personal app only, so updates install over the old version. Keep the repository private.
