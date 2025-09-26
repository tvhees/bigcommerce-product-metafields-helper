# BigCommerce Product Metafield CLI

Manage product metafields in BigCommerce - create from CSV files or delete by various criteria.

## Prerequisites

- Node.js and Yarn
- Access to the BigCommerce Management API (`store hash` and `access token`)
- Products already created in BigCommerce

## Installation

```sh
yarn install
```

View available commands:

```sh
yarn start
```

## Creating Metafields

### Requirements for Creation

- CSV files in the `csv` folder
  - Must have `id` and `sku` columns
  - Each row must have the ID for an existing BigCommerce product
  - Metafield columns use format: `namespace.key`
  - Maximum of 50 rows per CSV recommended

### Example CSV

```csv
id,sku,namespace_1.key_1,namespace_1.key_2,namespace_2.key_1
123,SKU0001,Value 11,Value 21,Value 31
234,SKU0004,Value 12,,Value32
```

### Create Command

```sh
yarn mf:create [options]
```

Options:

- `-a, --access-token <token>` - BigCommerce API access token
- `-s, --store-hash <hash>` - BigCommerce store hash
- `--dry-run <boolean>` - Preview without API calls (default: true)
- `--skip <number>` - Skip N files before processing
- `--limit <number>` - Limit number of files to process
- `--batch-size <number>` - Batch size for creation (default: 50)

### Example Create Commands

Dry run (preview what will be created):

```sh
yarn mf:create -s store-hash -a access-token
```

Create metafields:

```sh
yarn mf:create -s store-hash -a access-token --dry-run false
```

Create from first 10 CSV files:

```sh
yarn mf:create --limit 10 -s store-hash -a access-token --dry-run false
```

## Deleting Metafields

### Delete Command

```sh
yarn mf:delete [options]
```

Options:

- `-a, --access-token <token>` - BigCommerce API access token
- `-s, --store-hash <hash>` - BigCommerce store hash
- `--dry-run <boolean>` - Preview without API calls (default: true)
- `-k, --key <keys...>` - Delete by key(s)
- `-n, --namespace <namespaces...>` - Delete by namespace(s)
- `-p, --product-id <ids...>` - Delete by product ID(s)
- `--all` - Delete all metafields (use with caution)
- `--batch-size <number>` - Batch size for deletion (default: 50)

### Example Delete Commands

Delete by key:

```sh
yarn mf:delete --key short_description_mf price_meta -s store-hash -a access-token --dry-run false
```

Delete by namespace:

```sh
yarn mf:delete --namespace custom -s store-hash -a access-token --dry-run false
```

Delete for specific products:

```sh
yarn mf:delete --product-id 100 101 102 -s store-hash -a access-token --dry-run false
```

## Notes

- Metafield creation will fail if the product/namespace/key combination already exists (no 'upsert' endpoint)
- You can process a subset of files with the `--skip` and `--limit` flags
- Operations are batched to optimize API usage and prevent timeouts
- Errors in one product don't block processing of other products
- Both create and delete operations run in dry-run mode by default for safety
