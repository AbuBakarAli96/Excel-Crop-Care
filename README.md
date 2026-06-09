# Excel Crop Care Backend v10

This is the next version with a real Node.js backend added to the Excel Crop Care website.

## Included backend features

- Admin login with JWT token
- Password hashed with bcryptjs
- Product database using SQLite
- Product image upload using Multer
- Public product API used by the website
- Orders saved in the database
- Admin order panel at `/admin.html`
- Admin can update order status
- Accounts summary API for sales and product-wise revenue

## How to run

1. Install Node.js.
2. Open this folder in VS Code terminal.
3. Run:

```bash
npm install
npm start
```

4. Open:

```text
http://localhost:3000
```

5. Admin panel:

```text
http://localhost:3000/admin.html
```

Default admin:

```text
Username: admin
Password: excel2026
```

Before public deployment, copy `.env.example` to `.env` and change `JWT_SECRET` and `ADMIN_PASSWORD`.

## Important

This version uses SQLite so it is easy to run locally. For a real public business deployment, you can later migrate the same database structure to PostgreSQL.
