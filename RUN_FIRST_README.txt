Excel Crop Care — Google Policy + Cool Theme Update

How to run on Windows:
1) Open this folder in VS Code: ExcelCropCare_Google_Policy_Cool_Update
2) Open terminal inside this SAME folder where package.json is visible.
3) Run: npm install
4) Run: npm start
5) Open: http://localhost:3000

Admin:
- Use the same admin system already present in the website.
- Default credentials are controlled by .env. If no .env is used, server.js default is admin / excel2026.

Important changes added:
- Cool green/gold agriculture theme.
- Uploaded agriculture images added as local assets.
- Hero slider uses your uploaded agriculture photos.
- Flash sale background uses your uploaded field sprayer image.
- Promo cards use your uploaded farm/crop/business images.
- Category cards now show grouped product images from products in the same category.
- Added Google Merchant Center/Search-friendly visible policy content:
  Return & Refund, Shipping & Delivery, Payment Methods, Terms, Privacy, Contact.
- Footer/top links now connect to policy pages instead of empty # links.

Important note:
Do not run npm install in the parent Desktop folder. Run it only inside the folder where package.json exists.


LATEST UI UPDATE:
- Removed emojis from visible website UI except cart icon.
- Home page improved with cooler agriculture theme and logo watermark background.
- Category cards now show grouped product collages from the same category.
- Products are hidden by default and show only after category selection, search, or Shop Now.


PRODUCT IMAGE UPDATE v3:
- Products.zip photos were added under public/assets/product-images/.
- Matching products in data/products.seed.json and public/index.html now use these real product photos.
- Category cards use real same-category product photos as grouped collage icons.
