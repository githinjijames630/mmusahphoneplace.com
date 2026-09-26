# Musah Mobiles Website Structure

## 1. Public Storefront

Customer-facing pages only show approved products:

- Available products
- Product photo, condition, storage, and price in KSh
- In stock, reserved, or sold status
- Product search and category filters
- Contact and WhatsApp enquiry actions

The public side must never expose entry cost, profit, expenses, owner records, or private customer information.

## 2. Owner Workspace

Protected workspace for Musah Mobiles staff:

- Dashboard overview
- Inventory management
- Sales and payment records
- Expense records
- Monthly and yearly reports
- Product photo upload
- Stock and price changes

## 3. Main Data Models

### Product

- id
- name
- brand
- category
- condition
- storage
- color
- photo
- entry price
- selling price
- quantity
- status
- created date
- updated date
- IMEI 1 and IMEI 2 where applicable
- serial number
- barcode or stock reference
- supplier
- date received

### Sale

- id
- product id
- customer name and phone
- amount paid
- payment method
- transaction reference
- product cost at time of sale
- date
- payment method
- customer phone
- receipt or transaction reference
- sold date and time

### Expense

- id
- description
- category
- amount
- date
- receipt attachment

### User

- id
- name
- role
- password hash
- last login
- active status

### Audit Event

- id
- user id
- action
- record type
- record id
- timestamp

## 4. Business Calculations

- Gross profit = selling revenue - product cost
- Net profit = gross profit - business expenses
- Stock value = available quantity x entry price
- Monthly reports are grouped by sale and expense date
- Annual reports are calculated from the monthly records

## 5. Recommended Website Layers

```text
Public UI
  -> product catalogue service
  -> public product data

Owner UI
  -> authentication service
  -> inventory service
  -> sales service
  -> expense service
  -> reports service

Backend API
  -> validation and authorization
  -> business calculations
  -> audit logging

Database and file storage
  -> products, sales, expenses, users
  -> protected image and receipt files
  -> backups
```

## 6. Security Rules

- Owner actions require server-side authentication.
- Passwords must be hashed; never stored as plain text.
- Owner-only fields must be removed from public API responses.
- Uploads must validate file type, size, and content.
- Price and stock changes must be audited.
- Production traffic must use HTTPS.
- Database backups must be automatic and tested.
- The browser `localStorage` prototype must not be used as the production data store.
- The browser-only password form is a prototype boundary, not production authentication; production password changes require a server-side endpoint.

## 7. Build Order

1. Confirm screens and data models.
2. Build the database and backend API.
3. Add authentication and roles.
4. Connect inventory and image uploads.
5. Connect sales and payments.
6. Add expenses and profit reports.
7. Connect the public storefront to approved inventory.
8. Add backups, audit logs, testing, and deployment security.
